import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import {
  AUTH_STORAGE_EVENT,
  cancelCampaign,
  checkReviewStatus,
  confirmCampaignReceipt,
  clearStoredAuth,
  createCampaign,
  deliverCampaign,
  devLogin,
  fetchCampaigns,
  fetchCampaignChatMessages,
  fetchCategories,
  fetchHostDashboard,
  fetchMyHostedCampaigns,
  fetchMyJoinedCampaigns,
  fetchMyParticipation,
  fetchReadNotifications,
  fetchStores,
  fetchUnreadNotifications,
  getFrontendBaseUrl,
  getBackendBaseUrl,
  getStoredToken,
  getStoredUser,
  hostReviseCampaign,
  joinCampaign,
  kickCampaignParticipant,
  LINE_LOGIN_SUCCESS_MESSAGE,
  markParticipantNoShow,
  markNotificationRead,
  openLineLoginPopup,
  raiseCampaignDispute,
  reviseCampaign,
  setStoredAuth,
  unlockCampaignRevision,
  updateCampaignImageOrder,
  withdrawCampaign,
  updateCurrentUserProfile,
} from './api';
import { EXPIRE_PRESET_OPTIONS, LABELS, PAGE_SIZE, TYPE_OPTIONS } from './homeConfig';
import {
  formatCountdown,
  formatDateTime,
  getCampaignImageOrderName,
  getSuggestedMeetupTime,
  getInitialCampaignForm,
  getScenarioLabel,
  getTypeClass,
  isHoduoClosingSoon,
  isWithinHoduoBusinessHours,
  mapCampaign,
  normalizeUser,
  parseLocalDateTime,
  resolveExpireDate,
  resolveExpireTime,
} from './homeUtils';
import HomeTopBar from './HomeTopBar';
import LoginModal from './LoginModal';
import ProfileModal from './ProfileModal';
import ChatRoomsModal from './ChatRoomsModal';
import NotificationsModal from './NotificationsModal';
import CreateCampaignModal from './CreateCampaignModal';
import CreateCampaignSuccessModal from './CreateCampaignSuccessModal';
import JoinCampaignModal from './JoinCampaignModal';
import DealCard from './DealCard';
import ImageGalleryModal from './ImageGalleryModal';
import CampaignChatModal from './CampaignChatModal';
import ParticipationActionModal from './ParticipationActionModal';
import ReviewModal from './ReviewModal';
import { AvatarIcon, CardViewIcon, CompactViewIcon, DiagonalExpandIcon, SearchIcon } from './Icons';

const MINE_CAMPAIGN_BUCKET_LABELS = {
  ACTIVE: '進行中',
  COMPLETED: '已完成',
  FAILED: '失敗',
  ISSUE: '異常',
  CANCELLED: '已取消',
};

const MARKET_STATUS_OPTIONS = [
  { value: 'ALL', label: '全部' },
  { value: 'OPEN', label: '可跟' },
];

const DEAL_VIEW_MODE_KEYS = {
  market: 'deal_view_mode_market',
  mine: 'deal_view_mode_mine',
  mobile: 'deal_view_mode_mobile',
};
const MARKET_HIDE_FULL_KEY = 'market_hide_full';
const NOTIFICATION_SOUND_ENABLED_KEY = 'notification_sound_enabled';
const CHAT_ROOM_PAGE_SIZE = 100;
const COMPLETED_CHAT_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
const CHAT_ROOM_LAST_READ_KEY_PREFIX = 'chat_room_last_read';

function getChatRoomLastReadStorageKey(userId) {
  return `${CHAT_ROOM_LAST_READ_KEY_PREFIX}:${userId ?? 'guest'}`;
}

function getStoredChatRoomLastReads(userId) {
  if (!userId) {
    return {};
  }

  const storageKey = getChatRoomLastReadStorageKey(userId);
  const raw = localStorage.getItem(storageKey);

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    localStorage.removeItem(storageKey);
    return {};
  }
}

function setStoredChatRoomLastReads(userId, nextState) {
  if (!userId) {
    return;
  }

  const storageKey = getChatRoomLastReadStorageKey(userId);
  const normalizedEntries = Object.entries(nextState ?? {}).filter(([, value]) => typeof value === 'string' && value);

  if (normalizedEntries.length === 0) {
    localStorage.removeItem(storageKey);
    return;
  }

  localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(normalizedEntries)));
}

function getChatMessageTimestampValue(message) {
  return message?.timestamp ?? message?.createdAt ?? message?.created_at ?? '';
}

function getComparableTime(value) {
  const date = parseLocalDateTime(value);
  return date ? date.getTime() : 0;
}

function normalizeReadTimestamp(currentValue, nextValue) {
  const currentTime = getComparableTime(currentValue);
  const nextTime = getComparableTime(nextValue) || Date.now();
  return nextTime >= currentTime ? new Date(nextTime).toISOString() : currentValue;
}

function countUnreadChatMessages(messages, currentUserId, lastReadAt = '') {
  const lastReadTime = getComparableTime(lastReadAt);

  return (Array.isArray(messages) ? messages : []).reduce((count, message) => {
    const messageType = (message?.type ?? message?.messageType ?? message?.message_type ?? '')
      .toString()
      .toUpperCase();

    if (messageType === 'SYSTEM') {
      return count;
    }

    if (isSameUserId(message?.senderId ?? message?.sender_id, currentUserId)) {
      return count;
    }

    const messageTime = getComparableTime(getChatMessageTimestampValue(message));
    if (!messageTime) {
      return lastReadTime === 0 ? count + 1 : count;
    }

    return messageTime > lastReadTime ? count + 1 : count;
  }, 0);
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    })
  );

  return results;
}

function getInitialMarketHideFullEnabled() {
  return localStorage.getItem(MARKET_HIDE_FULL_KEY) === 'true';
}

function getInitialNotificationSoundEnabled() {
  return localStorage.getItem(NOTIFICATION_SOUND_ENABLED_KEY) !== 'false';
}

function getStoredDealViewModePreference(scope) {
  const savedMode = localStorage.getItem(DEAL_VIEW_MODE_KEYS[scope]);
  return savedMode === 'card' || savedMode === 'compact' ? savedMode : '';
}

function getInitialDealViewModePreferences() {
  return {
    market: getStoredDealViewModePreference('market'),
    mine: getStoredDealViewModePreference('mine'),
    mobile: getStoredDealViewModePreference('mobile'),
  };
}

function getAudioContextConstructor() {
  return window.AudioContext ?? window.webkitAudioContext ?? null;
}

function getNotificationAudioContext(audioContextRef) {
  const AudioContextConstructor = getAudioContextConstructor();

  if (!AudioContextConstructor) {
    return null;
  }

  if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
    audioContextRef.current = new AudioContextConstructor();
  }

  return audioContextRef.current;
}

async function unlockNotificationAudio(audioContextRef) {
  const audioContext = getNotificationAudioContext(audioContextRef);

  if (!audioContext || audioContext.state !== 'suspended') {
    return;
  }

  try {
    await audioContext.resume();
  } catch {
    // Browser audio policies can block unlock until a direct user gesture.
  }
}

async function playNotificationSound(audioContextRef) {
  const audioContext = getNotificationAudioContext(audioContextRef);

  if (!audioContext) {
    return;
  }

  if (audioContext.state === 'suspended') {
    await unlockNotificationAudio(audioContextRef);
  }

  if (audioContext.state !== 'running') {
    return;
  }

  const startAt = audioContext.currentTime;
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.08, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.34);
  gain.connect(audioContext.destination);

  [660, 880].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    oscillator.connect(gain);
    oscillator.start(startAt + index * 0.11);
    oscillator.stop(startAt + 0.18 + index * 0.11);
  });
}

function getDealViewKey(deal, index = 0) {
  return String(
    deal?.id ??
      deal?.campaignId ??
      `${deal?.mineSource ?? 'campaign'}-${deal?.itemName ?? 'item'}-${deal?.expireTime ?? index}`
  );
}

function areUsersEquivalent(left, right) {
  if (left === right) {
    return true;
  }

  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    String(left.id ?? '') === String(right.id ?? '') &&
    (left.displayName ?? '') === (right.displayName ?? '') &&
    (left.profileImageUrl ?? '') === (right.profileImageUrl ?? '') &&
    Boolean(left.hasCostcoMembership) === Boolean(right.hasCostcoMembership)
  );
}

function CompactDealRow({
  deal,
  index,
  labels,
  countdownNow,
  formatCountdown,
  formatDateTime,
  getScenarioLabel,
  getTypeClass,
  isHighlighted,
  onExpand,
  onOpenGallery,
  onOpenUserProfile,
}) {
  const viewKey = getDealViewKey(deal, index);
  const hostName = deal.host?.displayName ?? labels.noValue;
  const deadlineValue = deal.expireTime ?? deal.meetupTime;

  return (
    <article className={isHighlighted ? 'compact-market-row compact-market-row-highlighted' : 'compact-market-row'}>
      <button
        type="button"
        className="compact-market-image-button"
        onClick={() => onOpenGallery?.(deal, 0)}
        aria-label={`查看 ${deal.itemName} 圖片`}
      >
        <img src={deal.image} alt={deal.itemName} className="compact-market-image" />
      </button>

      <div className="compact-market-main">
        <div className="compact-market-title-row">
          <strong className="compact-market-title">{deal.itemName}</strong>
          <span className={`compact-market-type ${getTypeClass(deal.scenarioType)}`}>
            {getScenarioLabel(deal.scenarioType)}
          </span>
        </div>
        <div className="compact-market-meta">
          <span>NT$ {deal.pricePerUnit}</span>
          <span>剩 {deal.availableQuantity} 件</span>
          <span>{deal.storeName || labels.noValue}</span>
        </div>
        <div className="compact-market-bottom">
          <button
            type="button"
            className="compact-market-host"
            onClick={() =>
              onOpenUserProfile?.({
                id: deal.host?.id,
                displayName: deal.host?.displayName,
                profileImageUrl: deal.host?.profileImageUrl,
                creditScore: deal.host?.creditScore,
              })
            }
            disabled={!deal.host?.id || !onOpenUserProfile}
            aria-label={`查看 ${hostName} 的個人資料`}
            title="查看個人資料"
          >
            <span className="compact-host-avatar">
              {deal.host?.profileImageUrl ? (
                <img src={deal.host.profileImageUrl} alt="" className="avatar-image" />
              ) : (
                <AvatarIcon />
              )}
            </span>
            <span>{hostName}</span>
          </button>
          <span className="compact-market-deadline">
            <span className="compact-market-countdown">{formatCountdown(deadlineValue, countdownNow)}</span>
            <span>{formatDateTime(deadlineValue)}</span>
          </span>
        </div>
      </div>

      <button
        type="button"
        className="compact-expand-button"
        onClick={() => onExpand(viewKey)}
        aria-label={`放大 ${deal.itemName} 團購卡片`}
        title="放大"
      >
        <DiagonalExpandIcon />
      </button>
    </article>
  );
}

function CompactMineDealRow({ deal, index, labels, isHighlighted, onExpand, onOpenGallery, onOpenUserProfile }) {
  const statusBucket = getMineCampaignBucket(deal);
  const statusLabel = MINE_CAMPAIGN_BUCKET_LABELS[statusBucket] ?? statusBucket;
  const viewKey = getDealViewKey(deal, index);
  const hostName = deal.host?.displayName ?? labels.noValue;

  return (
    <article className={isHighlighted ? 'compact-deal-row compact-deal-row-highlighted' : 'compact-deal-row'}>
      <button
        type="button"
        className="compact-deal-image-button"
        onClick={() => onOpenGallery?.(deal, 0)}
        aria-label={`查看 ${deal.itemName} 圖片`}
      >
        <img src={deal.image} alt={deal.itemName} className="compact-deal-image" />
      </button>

      <div className="compact-deal-main">
        <strong className="compact-deal-title">{deal.itemName}</strong>
        <div className="compact-deal-host">
          <button
            type="button"
            className="compact-host-avatar"
            onClick={() =>
              onOpenUserProfile?.({
                id: deal.host?.id,
                displayName: deal.host?.displayName,
                profileImageUrl: deal.host?.profileImageUrl,
                creditScore: deal.host?.creditScore,
              })
            }
            disabled={!deal.host?.id || !onOpenUserProfile}
            aria-label={`查看 ${hostName} 的個人資料`}
            title="查看個人資料"
          >
            {deal.host?.profileImageUrl ? (
              <img src={deal.host.profileImageUrl} alt="" className="avatar-image" />
            ) : (
              <AvatarIcon />
            )}
          </button>
          <span>{hostName}</span>
        </div>
      </div>

      <span className={`compact-deal-status ${statusBucket.toLowerCase()}`}>{statusLabel}</span>

      <button
        type="button"
        className="compact-expand-button"
        onClick={() => onExpand(viewKey)}
        aria-label={`放大 ${deal.itemName} 團購卡片`}
        title="放大"
      >
        <DiagonalExpandIcon />
      </button>
    </article>
  );
}

function getCampaignLifecycle(rawCampaign) {
  const statusSource = [
    rawCampaign?.status,
    rawCampaign?.campaignStatus,
    rawCampaign?.campaign_status,
    rawCampaign?.state,
  ]
    .find(Boolean)
    ?.toString()
    .toUpperCase();

  if (statusSource?.includes('CANCEL')) {
    return 'CANCELLED';
  }

  if (statusSource?.includes('COMPLETE') || statusSource?.includes('FINISH') || statusSource?.includes('ENDED')) {
    return 'COMPLETED';
  }

  const expireValue = rawCampaign?.expireTime ?? rawCampaign?.expire_time ?? rawCampaign?.meetupTime ?? rawCampaign?.meetup_time;
  const expireDate = parseLocalDateTime(expireValue);
  if (expireDate && expireDate.getTime() <= Date.now()) {
    return 'COMPLETED';
  }

  return 'ACTIVE';
}

function isViewableParticipantStatus(status) {
  return ['JOINED', 'CONFIRMED', 'DELIVERED', 'COMPLETED'].includes((status ?? '').toString().toUpperCase());
}

function getMineCampaignBucket(rawCampaign) {
  const statusSource = [
    rawCampaign?.status,
    rawCampaign?.campaignStatus,
    rawCampaign?.campaign_status,
    rawCampaign?.state,
  ]
    .find(Boolean)
    ?.toString()
    .toUpperCase();
  const participantStatusSource = [
    rawCampaign?.myParticipantStatus,
    rawCampaign?.my_participant_status,
    rawCampaign?.participantStatus,
    rawCampaign?.participant_status,
  ]
    .find(Boolean)
    ?.toString()
    .toUpperCase();

  const source = (rawCampaign?.mineSource ?? rawCampaign?.__mineSource ?? '').toString().toUpperCase();

  if (source === 'HOSTED') {
    if (['OPEN', 'FULL'].includes(statusSource)) {
      return 'ACTIVE';
    }

    if (['DELIVERED', 'COMPLETED'].includes(statusSource)) {
      return 'COMPLETED';
    }

    if (['CANCELLED', 'FAILED'].includes(statusSource)) {
      return 'FAILED';
    }

    if (['HOST_NO_SHOW'].includes(statusSource)) {
      return 'ISSUE';
    }
  }

  if (source === 'JOINED') {
    if (['JOINED'].includes(participantStatusSource)) {
      return 'ACTIVE';
    }

    if (['CONFIRMED', 'COMPLETED'].includes(participantStatusSource)) {
      return 'COMPLETED';
    }

    if (['DISPUTED', 'NO_SHOW'].includes(participantStatusSource)) {
      return 'ISSUE';
    }
  }

  return getCampaignLifecycle(rawCampaign);
}

function canOpenReadonlyParticipationFromDeal(deal) {
  const source = (deal?.mineSource ?? deal?.__mineSource ?? '').toString().toUpperCase();
  const participantStatus = (
    deal?.myParticipantStatus ??
    deal?.my_participant_status ??
    deal?.participantStatus ??
    deal?.participant_status ??
    ''
  )
    .toString()
    .toUpperCase();
  const quantity = Number(deal?.quantity ?? deal?.joinQuantity ?? deal?.join_quantity ?? deal?.joinedQuantity ?? deal?.joined_quantity ?? 0);

  return (
    source === 'JOINED' &&
    getMineCampaignBucket(deal) === 'COMPLETED' &&
    isViewableParticipantStatus(participantStatus) &&
    quantity > 0
  );
}

function normalizeNotification(notification) {
  const type = notification.type ?? 'NOTICE';
  const typeLabelMap = {
    CAMPAIGN_FULL: '團購已滿團',
    CAMPAIGN_CANCELLED: '團購已取消',
    CAMPAIGN_DELIVERED: '已標記交付',
    CAMPAIGN_COMPLETED: '團購已完成',
    NOTICE: '通知',
  };

  return {
    id: notification.id ?? notification.notificationId ?? notification.notification_id ?? null,
    type,
    typeLabel: typeLabelMap[type] ?? type,
    referenceId: notification.referenceId ?? notification.reference_id ?? null,
    content: notification.content ?? '',
    createdAt: notification.createdAt ?? notification.created_at ?? '',
  };
}

function getLiveNotificationKey(notification) {
  return String(
    notification?.id ??
      `${notification?.type ?? 'NOTICE'}-${notification?.referenceId ?? 'none'}-${notification?.createdAt ?? ''}-${notification?.content ?? ''}`
  );
}

function getLiveNotificationTone(notification) {
  const type = (notification?.type ?? '').toString().toUpperCase();

  if (type.includes('CANCEL') || type.includes('KICK') || type.includes('FAIL') || type.includes('NO_SHOW') || type.includes('DISPUT')) {
    return 'danger';
  }

  if (type.includes('COMPLETE') || type.includes('CONFIRM')) {
    return 'success';
  }

  if (type.includes('FULL') || type.includes('DELIVER')) {
    return 'primary';
  }

  return 'neutral';
}

function normalizeHostParticipant(participant, index = 0) {
  return {
    participantId: participant?.participantId ?? participant?.id ?? participant?.userId ?? participant?.user_id ?? null,
    participantsId: participant?.participantsId ?? participant?.participants_id ?? null,
    userId: participant?.userId ?? participant?.user_id ?? participant?.memberId ?? null,
    displayName:
      participant?.displayName ??
      participant?.userDisplayName ??
      participant?.user?.displayName ??
      `團員 ${index + 1}`,
    quantity: Number(participant?.quantity ?? participant?.joinedQuantity ?? participant?.joined_quantity ?? 0),
    status:
      participant?.status ??
      participant?.participantStatus ??
      participant?.participant_status ??
      participant?.joinStatus ??
      '',
  };
}

function normalizeHostDashboard(dashboard) {
  const participants = Array.isArray(dashboard?.participants)
    ? dashboard.participants.map((participant, index) => normalizeHostParticipant(participant, index))
    : [];

  return {
    ...dashboard,
    status: dashboard?.status ?? '',
    allowRevision: Boolean(dashboard?.allowRevision ?? dashboard?.allow_revision ?? false),
    totalPhysicalQuantity: Number(dashboard?.totalPhysicalQuantity ?? dashboard?.total_physical_quantity ?? 0),
    openQuantity: Number(dashboard?.openQuantity ?? dashboard?.open_quantity ?? 0),
    hostReservedQuantity: Number(dashboard?.hostReservedQuantity ?? dashboard?.host_reserved_quantity ?? 0),
    alreadySoldQuantity: Number(dashboard?.alreadySoldQuantity ?? dashboard?.already_sold_quantity ?? 0),
    availableQuantity: Number(dashboard?.availableQuantity ?? dashboard?.available_quantity ?? 0),
    participants,
  };
}

function normalizeNotificationList(data) {
  const items = Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : [];
  return items.map(normalizeNotification);
}

function getReviewKey(campaignId, revieweeId) {
  return `${Number(campaignId)}:${Number(revieweeId)}`;
}

function isReviewAlreadyCompleted(data) {
  return Boolean(
    data?.reviewed ??
      data?.isReviewed ??
      data?.alreadyReviewed ??
      data?.exists ??
      data?.checked
  );
}

function getCampaignListSignature(items) {
  return JSON.stringify(Array.isArray(items) ? items : []);
}

function buildMineCampaigns(hostedData, joinedData, activeMyCampaignScope, activeMyCampaignFilter) {
  const hostedItems = (Array.isArray(hostedData?.content) ? hostedData.content : Array.isArray(hostedData) ? hostedData : []).map(
    (campaign) => ({
      ...campaign,
      mineSource: 'HOSTED',
    })
  );
  const joinedItems = (Array.isArray(joinedData?.content) ? joinedData.content : Array.isArray(joinedData) ? joinedData : []).map(
    (campaign) => ({
      ...campaign,
      mineSource: 'JOINED',
    })
  );
  const mergedCampaigns = [...hostedItems, ...joinedItems];
  const campaignMap = new Map();

  mergedCampaigns.forEach((campaign, index) => {
    const key =
      campaign.id ??
      campaign.campaignId ??
      `${campaign.mineSource ?? 'campaign'}-${campaign.itemName ?? campaign.item_name ?? 'campaign'}-${campaign.expireTime ?? campaign.expire_time ?? index}`;
    if (!campaignMap.has(key)) {
      campaignMap.set(key, campaign);
    }
  });

  let items = Array.from(campaignMap.values());

  if (activeMyCampaignScope !== 'ALL') {
    items = items.filter((campaign) => campaign.mineSource === activeMyCampaignScope);
  }

  if (activeMyCampaignFilter !== 'ALL') {
    items = items.filter((campaign) => getMineCampaignBucket(campaign) === activeMyCampaignFilter);
  }

  return items.map(mapCampaign);
}

function buildHostParticipationCampaign(deal, dashboard) {
  const normalizedDashboard = normalizeHostDashboard(dashboard);

  return {
    ...deal,
    managementMode: 'HOST',
    dashboard: normalizedDashboard,
    status: normalizedDashboard.status || deal.status,
    allowRevision: normalizedDashboard.allowRevision,
    totalPhysicalQuantity: normalizedDashboard.totalPhysicalQuantity,
    hostReservedQuantity: normalizedDashboard.hostReservedQuantity,
    openQuantity: normalizedDashboard.openQuantity,
    alreadySoldQuantity: normalizedDashboard.alreadySoldQuantity,
  };
}

function canOpenCampaignChat(campaign) {
  const statusSource = [
    campaign?.status,
    campaign?.campaignStatus,
    campaign?.campaign_status,
    campaign?.state,
  ]
    .find(Boolean)
    ?.toString()
    .toUpperCase();

  if (!statusSource) {
    return Number(campaign?.availableQuantity) <= 0;
  }

  return ['FULL', 'DELIVERED', 'COMPLETED', 'CONFIRMED'].some((status) => statusSource.includes(status));
}

function canDisplayMarketCampaign(campaign, activeType, hideFull = false) {
  if (campaign?.scenarioType !== activeType) {
    return false;
  }

  const statusSource = getCampaignStatusValue(campaign);
  const isFull = statusSource.includes('FULL') || Number(campaign?.availableQuantity) <= 0;

  if (hideFull && isFull) {
    return false;
  }

  if (!statusSource) {
    return Number.isFinite(Number(campaign?.availableQuantity));
  }

  return ['OPEN', 'FULL'].some((status) => statusSource.includes(status));
}

function getCampaignStatusValue(campaign) {
  return (campaign?.status ?? campaign?.campaignStatus ?? campaign?.campaign_status ?? campaign?.state ?? '')
    .toString()
    .toUpperCase();
}

function getCampaignCompletedAtValue(campaign) {
  return campaign?.completedAt ?? campaign?.completed_at ?? campaign?.completedTime ?? campaign?.completed_time ?? '';
}

function getCampaignChatExpiresAtValue(campaign) {
  return (
    campaign?.chatExpiresAt ??
    campaign?.chat_expires_at ??
    campaign?.chatExpiredAt ??
    campaign?.chat_expired_at ??
    campaign?.chatEndAt ??
    campaign?.chat_end_at ??
    ''
  );
}

function getCampaignEstablishedAtValue(campaign) {
  return (
    campaign?.establishedAt ??
    campaign?.established_at ??
    campaign?.formedAt ??
    campaign?.formed_at ??
    campaign?.fullAt ??
    campaign?.full_at ??
    campaign?.campaignFullAt ??
    campaign?.campaign_full_at ??
    campaign?.chatCreatedAt ??
    campaign?.chat_created_at ??
    campaign?.chatOpenedAt ??
    campaign?.chat_opened_at ??
    ''
  );
}

function hasClosedChatFlag(campaign) {
  const stopped = campaign?.chatStopped ?? campaign?.chat_stopped ?? campaign?.chatClosed ?? campaign?.chat_closed;
  if (stopped === true) {
    return true;
  }

  const available =
    campaign?.chatAvailable ?? campaign?.chat_available ?? campaign?.chatEnabled ?? campaign?.chat_enabled ?? campaign?.canChat;
  return available === false;
}

function isPastDateTime(value) {
  const date = parseLocalDateTime(value);
  return Boolean(date && date.getTime() <= Date.now());
}

function isCampaignCompletedChatExpired(campaign) {
  if (getCampaignStatusValue(campaign) !== 'COMPLETED') {
    return false;
  }

  const completedDate = parseLocalDateTime(getCampaignCompletedAtValue(campaign));
  if (!completedDate) {
    return false;
  }

  return Date.now() >= completedDate.getTime() + COMPLETED_CHAT_RETENTION_MS;
}

function isCampaignChatClosed(campaign) {
  return (
    hasClosedChatFlag(campaign) ||
    isPastDateTime(getCampaignChatExpiresAtValue(campaign)) ||
    isCampaignCompletedChatExpired(campaign)
  );
}

function canListCampaignChatRoom(campaign) {
  return canOpenCampaignChat(campaign) && !isCampaignChatClosed(campaign);
}

function getChatRoomSortTime(campaign) {
  const date = parseLocalDateTime(
    getCampaignEstablishedAtValue(campaign) ||
      getCampaignChatExpiresAtValue(campaign) ||
      getCampaignCompletedAtValue(campaign) ||
      campaign?.meetupTime ||
      campaign?.meetup_time ||
      campaign?.expireTime ||
      campaign?.expire_time
  );

  return date ? date.getTime() : 0;
}

function buildOpenChatRooms(hostedData, joinedData) {
  return buildMineCampaigns(hostedData, joinedData, 'ALL', 'ALL')
    .filter(canListCampaignChatRoom)
    .sort((first, second) => getChatRoomSortTime(second) - getChatRoomSortTime(first));
}

function isSameUserId(firstUserId, secondUserId) {
  if (firstUserId == null || secondUserId == null) {
    return false;
  }

  return Number(firstUserId) === Number(secondUserId);
}

function isCampaignHostForUser(campaign, currentUser) {
  const source = (campaign?.mineSource ?? campaign?.__mineSource ?? '').toString().toUpperCase();

  return (
    campaign?.managementMode === 'HOST' ||
    source === 'HOSTED' ||
    Boolean(campaign?.isHost) ||
    isSameUserId(campaign?.host?.id, currentUser?.id)
  );
}

function areStringArraysEqual(first = [], second = []) {
  return first.length === second.length && first.every((item, index) => item === second[index]);
}

function reorderList(items, fromIndex, toIndex) {
  if (
    !Array.isArray(items) ||
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

function getCampaignImageOrderNames(campaign, images) {
  const imageRefs =
    Array.isArray(campaign?.imageRefs) && campaign.imageRefs.length === images.length
      ? campaign.imageRefs
      : images;

  return imageRefs.map(getCampaignImageOrderName);
}

function canReorderCampaignImages(campaign, currentUser) {
  const images = Array.isArray(campaign?.imageUrls) ? campaign.imageUrls : [];
  const orderNames = getCampaignImageOrderNames(campaign, images);

  return (
    isCampaignHostForUser(campaign, currentUser) &&
    getMineCampaignBucket(campaign) === 'ACTIVE' &&
    images.length > 1 &&
    orderNames.length === images.length &&
    orderNames.every(Boolean)
  );
}

function isFullCampaignNotification(notification) {
  return notification?.type === 'CAMPAIGN_FULL' && notification?.referenceId != null;
}

function isReviewCampaignNotification(notification) {
  return notification?.type === 'CAMPAIGN_COMPLETED' && notification?.referenceId != null;
}

const PROFILE_RETURN_CONTEXT_KEY = 'profile_return_context';
const SWIPE_HINT_SEEN_KEY = 'home_swipe_hint_seen';

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const swipeTabs = ['MINE', ...TYPE_OPTIONS.map((option) => option.value), 'REQUEST'];
  const localizedMyCampaignScopes = [
    { value: 'ALL', label: '全部' },
    { value: 'HOSTED', label: '我的團購' },
    { value: 'JOINED', label: '我參加的' },
  ];
  const localizedMyCampaignOptions = [
    { value: 'ALL', label: '全部' },
    { value: 'ACTIVE', label: '進行中' },
    { value: 'COMPLETED', label: '已完成' },
    { value: 'FAILED', label: '失敗' },
    { value: 'ISSUE', label: '異常' },
  ];
  const localizedExpirePresetOptions = EXPIRE_PRESET_OPTIONS.map((option) => {
    if (option.value === '10m') {
      return { ...option, label: '10 分鐘後' };
    }

    if (option.value === '20m') {
      return { ...option, label: '20 分鐘後' };
    }

    if (option.value === '30m') {
      return { ...option, label: '30 分鐘後' };
    }

    if (option.value === 'custom') {
      return { ...option, label: '自訂' };
    }

    return option;
  });

  const uiLabels = {
    ...LABELS,
    joinCampaign: '\u52a0\u5165\u5718\u8cfc',
    purchaseQuantity: '\u8a8d\u8cfc\u6578\u91cf',
    confirmJoinCampaign: '\u78ba\u8a8d\u52a0\u5165',
    submittingJoinCampaign: '\u9001\u51fa\u4e2d...',
    soldOut: '\u5df2\u984d\u6eff',
    totalQuantityLabel: '\u7e3d\u6578\u91cf',
  };

  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [referenceError, setReferenceError] = useState('');
  const [isReferenceLoading, setIsReferenceLoading] = useState(true);
  const [activeType, setActiveType] = useState('INSTANT');
  const [activeCategory, setActiveCategory] = useState(0);
  const [hideFullCampaigns, setHideFullCampaigns] = useState(getInitialMarketHideFullEnabled);
  const [activeMarketStatus, setActiveMarketStatus] = useState('ALL');
  const [activeMyCampaignScope, setActiveMyCampaignScope] = useState('ALL');
  const [activeMyCampaignFilter, setActiveMyCampaignFilter] = useState('ALL');
  const [activeStore, setActiveStore] = useState(0);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [campaigns, setCampaigns] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [campaignError, setCampaignError] = useState('');
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState(() => normalizeUser(getStoredUser()));
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isChatRoomsOpen, setIsChatRoomsOpen] = useState(false);
  const [chatRooms, setChatRooms] = useState([]);
  const [chatRoomsError, setChatRoomsError] = useState('');
  const [isChatRoomsLoading, setIsChatRoomsLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readNotifications, setReadNotifications] = useState([]);
  const [notificationsError, setNotificationsError] = useState('');
  const [readNotificationsError, setReadNotificationsError] = useState('');
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [isReadNotificationsLoading, setIsReadNotificationsLoading] = useState(false);
  const [liveNotifications, setLiveNotifications] = useState([]);
  const [isNotificationSoundEnabled, setIsNotificationSoundEnabled] = useState(getInitialNotificationSoundEnabled);
  const [successToast, setSuccessToast] = useState(null);
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [profileDraft, setProfileDraft] = useState(
    normalizeUser(getStoredUser()) ?? {
      displayName: '',
      hasCostcoMembership: false,
    }
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [campaignForm, setCampaignForm] = useState(getInitialCampaignForm);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [createCampaignError, setCreateCampaignError] = useState('');
  const [createdCampaignSummary, setCreatedCampaignSummary] = useState(null);
  const [selectedDealToJoin, setSelectedDealToJoin] = useState(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState('1');
  const [purchaseError, setPurchaseError] = useState('');
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);
  const [participationCampaign, setParticipationCampaign] = useState(null);
  const [participationQuantityDraft, setParticipationQuantityDraft] = useState('1');
  const [participationError, setParticipationError] = useState('');
  const [isSubmittingParticipation, setIsSubmittingParticipation] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewedReviewKeys, setReviewedReviewKeys] = useState({});
  const [chatReviewState, setChatReviewState] = useState({
    isParticipantReviewed: false,
    isHostAllReviewed: false,
  });
  const [chatCampaign, setChatCampaign] = useState(null);
  const [chatStatusEvent, setChatStatusEvent] = useState(null);
  const [galleryState, setGalleryState] = useState({
    isOpen: false,
    title: '',
    campaignId: null,
    images: [],
    imageOrderNames: [],
    originalImageOrderNames: [],
    activeIndex: 0,
    canReorder: false,
    hasOrderChanges: false,
    isSavingOrder: false,
    orderMessage: '',
    orderError: '',
  });
  useEffect(() => {
    const syncAuthState = () => {
      const nextToken = getStoredToken();
      const nextUser = normalizeUser(getStoredUser());

      setToken((current) => (current === nextToken ? current : nextToken));
      setUser((current) => (areUsersEquivalent(current, nextUser) ? current : nextUser));
    };

    const handleStorageChange = (event) => {
      if (event.key && !['jwt_token', 'refresh_token', 'current_user'].includes(event.key)) {
        return;
      }

      syncAuthState();
    };

    window.addEventListener(AUTH_STORAGE_EVENT, syncAuthState);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(AUTH_STORAGE_EVENT, syncAuthState);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  const [referenceRefreshKey, setReferenceRefreshKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [focusedCampaignId, setFocusedCampaignId] = useState('');
  const [dealViewModePreferences, setDealViewModePreferences] = useState(getInitialDealViewModePreferences);
  const [expandedCompactDealId, setExpandedCompactDealId] = useState('');
  const [isDealViewControlVisible, setIsDealViewControlVisible] = useState(true);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => window.matchMedia('(min-width: 700px)').matches);
  const [pageTransitionDirection, setPageTransitionDirection] = useState('forward');
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [themeMode, setThemeMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme_mode');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const sentinelRef = useRef(null);
  const createSummaryTimerRef = useRef(null);
  const pullStartYRef = useRef(null);
  const swipeStartXRef = useRef(null);
  const canPullRef = useRef(false);
  const gestureLockRef = useRef('');
  const searchInputRef = useRef(null);
  const notificationClientRef = useRef(null);
  const liveNotificationTimersRef = useRef(new Map());
  const successToastTimerRef = useRef(null);
  const dealViewControlTimerRef = useRef(null);
  const notificationAudioContextRef = useRef(null);
  const notificationSoundEnabledRef = useRef(isNotificationSoundEnabled);
  const lastHandledChatNotificationRef = useRef('');
  const pendingProfileReturnRef = useRef(null);
  const profileRestoreAppliedRef = useRef(false);
  const campaignsSignatureRef = useRef('[]');
  const wsUrl = useMemo(() => new URL('/ws', getBackendBaseUrl()).toString(), []);
  const chatUnreadRoomCount = useMemo(
    () => chatRooms.reduce((count, room) => count + (Number(room?.unreadMessageCount ?? 0) > 0 ? 1 : 0), 0),
    [chatRooms]
  );

  const dismissLiveNotification = useCallback((notificationKey) => {
    const timerId = liveNotificationTimersRef.current.get(notificationKey);
    if (timerId) {
      window.clearTimeout(timerId);
      liveNotificationTimersRef.current.delete(notificationKey);
    }

    setLiveNotifications((current) => current.filter((notification) => notification.toastKey !== notificationKey));
  }, []);

  const pushLiveNotification = useCallback(
    (notification) => {
      if (!notification) {
        return;
      }

      const toastKey = getLiveNotificationKey(notification);
      setLiveNotifications((current) => [
        {
          ...notification,
          toastKey,
        },
        ...current.filter((item) => item.toastKey !== toastKey),
      ]);

      const existingTimerId = liveNotificationTimersRef.current.get(toastKey);
      if (existingTimerId) {
        window.clearTimeout(existingTimerId);
      }

      const nextTimerId = window.setTimeout(() => {
        liveNotificationTimersRef.current.delete(toastKey);
        setLiveNotifications((current) => current.filter((item) => item.toastKey !== toastKey));
      }, 5000);

      liveNotificationTimersRef.current.set(toastKey, nextTimerId);
    },
    []
  );

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem('theme_mode', themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem(MARKET_HIDE_FULL_KEY, String(hideFullCampaigns));
  }, [hideFullCampaigns]);

  useEffect(() => {
    notificationSoundEnabledRef.current = isNotificationSoundEnabled;
  }, [isNotificationSoundEnabled]);

  useEffect(() => {
    campaignsSignatureRef.current = getCampaignListSignature(campaigns);
  }, [campaigns]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 700px)');
    const syncDesktopViewport = () => setIsDesktopViewport(mediaQuery.matches);

    syncDesktopViewport();
    mediaQuery.addEventListener('change', syncDesktopViewport);

    return () => mediaQuery.removeEventListener('change', syncDesktopViewport);
  }, []);

  useEffect(() => {
    return () => {
      liveNotificationTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      liveNotificationTimersRef.current.clear();
      if (successToastTimerRef.current) {
        window.clearTimeout(successToastTimerRef.current);
      }
      if (dealViewControlTimerRef.current) {
        window.clearTimeout(dealViewControlTimerRef.current);
      }
      if (notificationAudioContextRef.current) {
        void notificationAudioContextRef.current.close();
        notificationAudioContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isNotificationSoundEnabled) {
      return undefined;
    }

    const unlockAudio = () => {
      void unlockNotificationAudio(notificationAudioContextRef);
    };
    const events = ['pointerdown', 'touchstart', 'keydown'];

    events.forEach((eventName) => window.addEventListener(eventName, unlockAudio, { passive: true }));

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, unlockAudio));
    };
  }, [isNotificationSoundEnabled]);

  useEffect(() => {
    if (activeType === 'REQUEST' || isSearchExpanded) {
      setIsDealViewControlVisible(false);
      return undefined;
    }

    setIsDealViewControlVisible(true);

    const hideUntilIdle = () => {
      setIsDealViewControlVisible(false);

      if (dealViewControlTimerRef.current) {
        window.clearTimeout(dealViewControlTimerRef.current);
      }

      dealViewControlTimerRef.current = window.setTimeout(() => {
        setIsDealViewControlVisible(true);
      }, 3500);
    };

    const events = ['scroll', 'wheel', 'touchmove'];
    events.forEach((eventName) => window.addEventListener(eventName, hideUntilIdle, { passive: true }));

    return () => {
      if (dealViewControlTimerRef.current) {
        window.clearTimeout(dealViewControlTimerRef.current);
        dealViewControlTimerRef.current = null;
      }

      events.forEach((eventName) => window.removeEventListener(eventName, hideUntilIdle));
    };
  }, [activeType, isSearchExpanded]);

  useEffect(() => {
    if (profileRestoreAppliedRef.current) {
      return;
    }

    profileRestoreAppliedRef.current = true;

    try {
      const raw = sessionStorage.getItem(PROFILE_RETURN_CONTEXT_KEY);
      if (!raw) {
        return;
      }

      const context = JSON.parse(raw);
      pendingProfileReturnRef.current = context;
      sessionStorage.removeItem(PROFILE_RETURN_CONTEXT_KEY);

      if (context?.ui) {
        if (context.ui.activeType) {
          setActiveType(context.ui.activeType);
        }
        if (typeof context.ui.activeCategory === 'number') {
          setActiveCategory(context.ui.activeCategory);
        }
        if (typeof context.ui.hideFullCampaigns === 'boolean') {
          setHideFullCampaigns(context.ui.hideFullCampaigns);
        }
        if (typeof context.ui.activeStore === 'number') {
          setActiveStore(context.ui.activeStore);
        }
        if (context.ui.activeMyCampaignFilter) {
          setActiveMyCampaignFilter(context.ui.activeMyCampaignFilter);
        }
        if (context.ui.activeMyCampaignScope) {
          setActiveMyCampaignScope(context.ui.activeMyCampaignScope);
        }
        if (typeof context.ui.search === 'string') {
          setSearch(context.ui.search);
        }
      }

      if (context?.source === 'chat' && context?.campaign) {
        setChatCampaign(context.campaign);
      }
    } catch {
      sessionStorage.removeItem(PROFILE_RETURN_CONTEXT_KEY);
      pendingProfileReturnRef.current = null;
    }
  }, []);

  useEffect(() => {
    const pendingContext = pendingProfileReturnRef.current;
    if (!pendingContext || isInitialLoading) {
      return;
    }

    if (pendingContext.source === 'chat' && pendingContext.campaign && !chatCampaign) {
      return;
    }

    const targetScrollY = Number(pendingContext.scrollY ?? 0);
    const timerId = window.setTimeout(() => {
      window.scrollTo({ top: Math.max(targetScrollY, 0), behavior: 'auto' });
      pendingProfileReturnRef.current = null;
    }, 60);

    return () => window.clearTimeout(timerId);
  }, [campaigns, chatCampaign, isInitialLoading]);

  useEffect(() => {
    const targetCampaignId = location.state?.focusCampaignId;
    if (!targetCampaignId) {
      return;
    }

    setFocusedCampaignId(String(targetCampaignId));
    switchActiveType('MINE');
    setActiveMyCampaignScope('ALL');
    setActiveMyCampaignFilter('ALL');
    window.history.replaceState({}, document.title);
  }, [location.state]);

  useEffect(() => {
    if (!focusedCampaignId || isInitialLoading) {
      return;
    }

    const node = document.getElementById(`deal-card-${focusedCampaignId}`);
    if (!node) {
      return;
    }

    const timerId = window.setTimeout(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);

    const clearTimerId = window.setTimeout(() => {
      setFocusedCampaignId('');
    }, 2200);

    return () => {
      window.clearTimeout(timerId);
      window.clearTimeout(clearTimerId);
    };
  }, [campaigns, focusedCampaignId, isInitialLoading]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [referenceRefreshKey]);

  useEffect(() => {
    if (!createdCampaignSummary) {
      return undefined;
    }

    createSummaryTimerRef.current = window.setTimeout(() => {
      setCreatedCampaignSummary(null);
    }, 10000);

    return () => {
      if (createSummaryTimerRef.current) {
        window.clearTimeout(createSummaryTimerRef.current);
        createSummaryTimerRef.current = null;
      }
    };
  }, [createdCampaignSummary]);

  useEffect(() => {
    setCampaignForm((current) => {
      const nextExpirePreset = current.scenarioType === 'SCHEDULED' ? 'custom' : current.expirePreset || '10m';
      const nextSuggestedMeetupTime = getSuggestedMeetupTime({ ...current, expirePreset: nextExpirePreset });

      if (current.expirePreset === nextExpirePreset && current.meetupTime === nextSuggestedMeetupTime) {
        return current;
      }

      return {
        ...current,
        expirePreset: nextExpirePreset,
        meetupTime: nextSuggestedMeetupTime,
      };
    });
  }, [campaignForm.scenarioType, campaignForm.expirePreset, campaignForm.expireTime]);

  useEffect(() => {
    const handleLineLoginMessage = (event) => {
      if (event.origin !== getFrontendBaseUrl()) {
        return;
      }

      if (event.data?.type !== LINE_LOGIN_SUCCESS_MESSAGE) {
        return;
      }

      const nextUser = normalizeUser(event.data.user);
      setStoredAuth({
        token: event.data.token,
        refreshToken: event.data.refreshToken,
        user: nextUser,
      });
      setToken(event.data.token);
      setUser(nextUser);
      setProfileDraft(nextUser ?? { displayName: '', hasCostcoMembership: false });
      setAuthLoading(false);
      setAuthError('');
      setIsLoginModalOpen(false);
      setIsProfileOpen(true);
      setIsNotificationsOpen(false);
      setIsChatRoomsOpen(false);
      setIsCreateCampaignOpen(false);
    };

    window.addEventListener('message', handleLineLoginMessage);
    return () => window.removeEventListener('message', handleLineLoginMessage);
  }, []);

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setReadNotifications([]);
      setChatRooms([]);
      setChatRoomsError('');
      setIsChatRoomsLoading(false);
      setIsChatRoomsOpen(false);
      setNotificationsError('');
      setReadNotificationsError('');
      setIsNotificationsLoading(false);
      setIsReadNotificationsLoading(false);
      return undefined;
    }

    let cancelled = false;

    setIsNotificationsLoading(true);
    setIsReadNotificationsLoading(true);
    setNotificationsError('');
    setReadNotificationsError('');

    fetchUnreadNotifications(token)
      .then((data) => {
        if (!cancelled) {
          setNotifications(normalizeNotificationList(data));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setNotificationsError(error.message);
          setNotifications([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsNotificationsLoading(false);
        }
      });

    fetchReadNotifications({ page: 0, size: 20 }, token)
      .then((data) => {
        if (!cancelled) {
          setReadNotifications(normalizeNotificationList(data));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setReadNotificationsError(error.message);
          setReadNotifications([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsReadNotificationsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let disposed = false;

    const connect = async () => {
      try {
        const sockJsModule = await import('sockjs-client/dist/sockjs');
        const SockJS = sockJsModule.default;

        if (disposed) {
          return;
        }

        const client = new Client({
          webSocketFactory: () => new SockJS(wsUrl),
          connectHeaders: {
            Authorization: `Bearer ${token}`,
          },
          reconnectDelay: 5000,
          debug: () => {},
          onConnect: () => {
            client.subscribe('/user/queue/notifications', (frame) => {
              try {
                const incomingNotification = normalizeNotification(JSON.parse(frame.body));

                if (!disposed) {
                  if (notificationSoundEnabledRef.current) {
                    void playNotificationSound(notificationAudioContextRef);
                  }

                  pushLiveNotification(incomingNotification);
                }

                fetchUnreadNotifications(token)
                  .then((data) => {
                    if (!disposed) {
                      setNotifications(normalizeNotificationList(data));
                      setNotificationsError('');
                    }
                  })
                  .catch((error) => {
                    if (!disposed) {
                      setNotificationsError(error.message);
                    }
                  });
              } catch {
                setNotificationsError('通知資料解析失敗');
              }
            });
          },
          onStompError: (frame) => {
            setNotificationsError(frame.headers.message || '通知連線發生錯誤');
          },
        });

        client.activate();
        notificationClientRef.current = client;
      } catch (error) {
        setNotificationsError(error instanceof Error ? error.message : '通知連線初始化失敗');
      }
    };

    connect();

    return () => {
      disposed = true;
      notificationClientRef.current?.deactivate();
      notificationClientRef.current = null;
    };
  }, [pushLiveNotification, token, wsUrl]);

  useEffect(() => {
    let cancelled = false;

    const loadReferenceData = async () => {
      setIsReferenceLoading(true);
      setReferenceError('');

      try {
        const [storesData, categoriesData] = await Promise.all([fetchStores(), fetchCategories()]);

        if (cancelled) {
          return;
        }

        setStores(Array.isArray(storesData) ? storesData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      } catch (error) {
        if (!cancelled) {
          setReferenceError(error.message);
        }
      } finally {
        if (!cancelled) {
          setIsReferenceLoading(false);
        }
      }
    };

    loadReferenceData();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadCampaignPage = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setIsInitialLoading(true);
      }
      setCampaignError('');

      try {
        if (activeType === 'REQUEST') {
          setCampaigns([]);
          setPage(0);
          setHasMore(false);
          return;
        }

        if (activeType === 'MINE') {
          const mineQuery = {
            page: 0,
            size: PAGE_SIZE,
          };

          if (!token) {
            setCampaigns([]);
            setPage(0);
            setHasMore(false);
            setCampaignError(LABELS.loginRequiredForMine);
            return;
          }

          const [hostedData, joinedData] = await Promise.all([
            fetchMyHostedCampaigns(mineQuery, token),
            fetchMyJoinedCampaigns(mineQuery, token),
          ]);
          const nextCampaigns = buildMineCampaigns(
            hostedData,
            joinedData,
            activeMyCampaignScope,
            activeMyCampaignFilter
          );
          const nextSignature = getCampaignListSignature(nextCampaigns);

          if (nextSignature !== campaignsSignatureRef.current) {
            setCampaigns(nextCampaigns);
          }
          setPage(0);
          setHasMore(false);
          return;
        }

        const data = await fetchCampaigns({
          page: 0,
          size: PAGE_SIZE,
          storeId: activeStore || undefined,
          categoryId: activeCategory || undefined,
          keyword: deferredSearch.trim() || undefined,
        });

        const items = Array.isArray(data?.content)
          ? data.content.map(mapCampaign).filter((item) => canDisplayMarketCampaign(item, activeType, hideFullCampaigns))
          : [];
        const nextSignature = getCampaignListSignature(items);

        if (nextSignature !== campaignsSignatureRef.current) {
          setCampaigns(items);
        }
        setPage(0);
        setHasMore(Boolean(data) && !data.last);
      } catch (error) {
        setCampaignError(error.message);
        if (!silent) {
          setCampaigns([]);
          setHasMore(false);
        }
      } finally {
        if (!silent) {
          setIsInitialLoading(false);
        }
      }
    },
    [activeCategory, activeMyCampaignFilter, activeMyCampaignScope, activeStore, activeType, deferredSearch, hideFullCampaigns, token]
  );

  useEffect(() => {
    void loadCampaignPage();
  }, [loadCampaignPage, refreshKey]);

  const refreshMineCampaignsBeforeOpen = useCallback(
    async (deal) => {
      if (activeType !== 'MINE' || !token || !deal?.id) {
        return deal;
      }

      const mineQuery = {
        page: 0,
        size: PAGE_SIZE,
      };
      const [hostedData, joinedData] = await Promise.all([
        fetchMyHostedCampaigns(mineQuery, token),
        fetchMyJoinedCampaigns(mineQuery, token),
      ]);
      const nextCampaigns = buildMineCampaigns(hostedData, joinedData, activeMyCampaignScope, activeMyCampaignFilter);
      const nextSignature = getCampaignListSignature(nextCampaigns);

      if (nextSignature !== campaignsSignatureRef.current) {
        setCampaigns(nextCampaigns);
      }

      return (
        nextCampaigns.find((campaign) => Number(campaign.id) === Number(deal.id)) ??
        deal
      );
    },
    [activeMyCampaignFilter, activeMyCampaignScope, activeType, token]
  );

  useEffect(() => {
    if (!isRefreshing) {
      return;
    }

    if (!isReferenceLoading && !isInitialLoading && !isLoadingMore) {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, isReferenceLoading, isInitialLoading, isLoadingMore]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || activeType === 'MINE' || activeType === 'REQUEST' || !hasMore || isInitialLoading || isLoadingMore) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }

        setIsLoadingMore(true);

        fetchCampaigns({
          page: page + 1,
          size: PAGE_SIZE,
          storeId: activeStore || undefined,
          categoryId: activeCategory || undefined,
          keyword: deferredSearch.trim() || undefined,
        })
          .then((data) => {
            const nextItems = Array.isArray(data?.content)
              ? data.content
                  .map((item, index) => mapCampaign(item, campaigns.length + index))
                  .filter((item) => canDisplayMarketCampaign(item, activeType, hideFullCampaigns))
              : [];

            setCampaigns((current) => [...current, ...nextItems]);
            setPage((current) => current + 1);
            setHasMore(Boolean(data) && !data.last);
          })
          .catch((error) => {
            setCampaignError(error.message);
            setHasMore(false);
          })
          .finally(() => {
            setIsLoadingMore(false);
          });
      },
      { rootMargin: '200px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [activeCategory, activeStore, activeType, campaigns.length, deferredSearch, hasMore, hideFullCampaigns, isInitialLoading, isLoadingMore, page]);

  const openProfile = () => {
    setAuthError('');
    if (!token) {
      setIsLoginModalOpen(true);
      setIsProfileOpen(false);
      return;
    }

    handleOpenUserProfile(
      {
        id: user?.id,
        displayName: user?.displayName,
        profileImageUrl: user?.profileImageUrl,
      },
      'profile'
    );
  };

  const handleLineLogin = () => {
    setAuthError('');
    setAuthLoading(true);

    try {
      openLineLoginPopup();
    } catch (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    }
  };

  const handleDevLogin = async (userId) => {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      setAuthError('請輸入開發者登入 userId');
      return;
    }

    setAuthError('');
    setAuthLoading(true);

    try {
      const data = await devLogin(normalizedUserId);
      const nextUser = normalizeUser({
        id: data.userId ?? normalizedUserId,
        displayName: `開發者 ${data.userId ?? normalizedUserId}`,
      });

      setStoredAuth({
        token: data.token,
        refreshToken: data.refreshToken,
        user: nextUser,
      });
      setToken(data.token);
      setUser(nextUser);
      setProfileDraft(nextUser ?? { displayName: '', hasCostcoMembership: false });
      setIsLoginModalOpen(false);
      setIsProfileOpen(false);
      setIsNotificationsOpen(false);
      setIsChatRoomsOpen(false);
      setIsCreateCampaignOpen(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '開發者登入失敗');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearStoredAuth();
    setToken('');
    setUser(null);
    setProfileDraft({ displayName: '', hasCostcoMembership: false });
    setIsProfileOpen(false);
    setIsNotificationsOpen(false);
    setIsChatRoomsOpen(false);
    setChatRooms([]);
    setChatRoomsError('');
    setIsCreateCampaignOpen(false);
  };

  const handleToggleNotificationSound = () => {
    const nextEnabled = !isNotificationSoundEnabled;

    setIsNotificationSoundEnabled(nextEnabled);
    localStorage.setItem(NOTIFICATION_SOUND_ENABLED_KEY, String(nextEnabled));

    if (nextEnabled) {
      void unlockNotificationAudio(notificationAudioContextRef);
    }
  };

  const markChatRoomAsRead = useCallback(
    (campaignId, readAt = new Date().toISOString()) => {
      if (!user?.id || campaignId == null) {
        return;
      }

      const currentReads = getStoredChatRoomLastReads(user.id);
      const roomKey = String(campaignId);
      const nextReadAt = normalizeReadTimestamp(currentReads[roomKey], readAt);

      if (currentReads[roomKey] === nextReadAt) {
        return;
      }

      setStoredChatRoomLastReads(user.id, {
        ...currentReads,
        [roomKey]: nextReadAt,
      });

      setChatRooms((current) =>
        current.map((room) =>
          Number(room?.id ?? room?.campaignId) === Number(campaignId)
            ? {
                ...room,
                unreadMessageCount: 0,
              }
            : room
        )
      );
    },
    [user?.id]
  );

  const markNotificationAsRead = async (notificationId, sourceNotification = null) => {
    if (!token) {
      return;
    }

    if (notificationId == null) {
      setNotificationsError('通知 ID 缺失，無法標記已讀');
      return;
    }

    try {
      await markNotificationRead(notificationId, token);
      const notificationToMove =
        sourceNotification ?? notifications.find((notification) => notification.id === notificationId) ?? null;
      setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
      if (notificationToMove) {
        setReadNotifications((current) => {
          if (current.some((notification) => notification.id === notificationToMove.id)) {
            return current;
          }

          return [notificationToMove, ...current].slice(0, 20);
        });
      }
    } catch (error) {
      setNotificationsError(error.message);
    }
  };

  const markCampaignChatNotificationsAsRead = async (campaignId) => {
    const matchedNotifications = notifications.filter(
      (notification) =>
        isFullCampaignNotification(notification) && Number(notification.referenceId) === Number(campaignId)
    );

    if (matchedNotifications.length === 0) {
      return;
    }

    await Promise.all(matchedNotifications.map((notification) => markNotificationAsRead(notification.id)));
  };

  const findCampaignForNotification = async (campaignId, { forceRemote = false } = {}) => {
    const normalizedCampaignId = Number(campaignId);
    const currentCampaign = campaigns.find((campaign) => Number(campaign.id) === normalizedCampaignId);

    if (currentCampaign && !forceRemote) {
      return currentCampaign;
    }

    const query = { page: 0, size: 100 };
    const [hostedData, joinedData] = await Promise.all([
      fetchMyHostedCampaigns(query, token),
      fetchMyJoinedCampaigns(query, token),
    ]);

    const hostedItems = (Array.isArray(hostedData?.content) ? hostedData.content : Array.isArray(hostedData) ? hostedData : []).map(
      (campaign) => ({
        ...campaign,
        mineSource: 'HOSTED',
      })
    );
    const joinedItems = (Array.isArray(joinedData?.content) ? joinedData.content : Array.isArray(joinedData) ? joinedData : []).map(
      (campaign) => ({
        ...campaign,
        mineSource: 'JOINED',
      })
    );
    const matchedCampaign = [...hostedItems, ...joinedItems].find(
      (campaign) => Number(campaign.id ?? campaign.campaignId) === normalizedCampaignId
    );

    return matchedCampaign ? mapCampaign(matchedCampaign) : null;
  };

  const loadOpenChatRooms = useCallback(async ({ silent = false } = {}) => {
    if (!token) {
      setChatRooms([]);
      setChatRoomsError('');
      setIsChatRoomsLoading(false);
      return;
    }

    if (!silent) {
      setIsChatRoomsLoading(true);
    }
    setChatRoomsError('');

    try {
      const query = { page: 0, size: CHAT_ROOM_PAGE_SIZE };
      const [hostedData, joinedData] = await Promise.all([
        fetchMyHostedCampaigns(query, token),
        fetchMyJoinedCampaigns(query, token),
      ]);

      const openRooms = buildOpenChatRooms(hostedData, joinedData);
      const roomsWithUnreadCounts = await mapWithConcurrency(openRooms, 4, async (room) => {
        const roomId = room?.id ?? room?.campaignId;

        if (roomId == null) {
          return {
            ...room,
            unreadMessageCount: 0,
          };
        }

        try {
          const messages = await fetchCampaignChatMessages(roomId, token);
          const lastReadAt = getStoredChatRoomLastReads(user?.id)[String(roomId)];

          return {
            ...room,
            unreadMessageCount: countUnreadChatMessages(messages, user?.id, lastReadAt),
          };
        } catch {
          return {
            ...room,
            unreadMessageCount: 0,
          };
        }
      });

      setChatRooms(roomsWithUnreadCounts);
    } catch (error) {
      setChatRooms([]);
      setChatRoomsError(error instanceof Error ? error.message : '聊天室列表載入失敗');
    } finally {
      if (!silent) {
        setIsChatRoomsLoading(false);
      }
    }
  }, [token, user?.id]);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadOpenChatRooms({ silent: true });
  }, [loadOpenChatRooms, refreshKey, token]);

  const handleOpenChatRooms = () => {
    if (!token) {
      setIsLoginModalOpen(true);
      return;
    }

    setIsChatRoomsOpen(true);
    void loadOpenChatRooms();
  };

  const handleOpenChatRoom = async (room) => {
    setIsChatRoomsOpen(false);
    await handleOpenChat(room);
  };

  const handleNotificationAction = async (notification) => {
    if (!token || !notification) {
      return;
    }

    const isChatNotification = isFullCampaignNotification(notification);
    const isReviewNotification = isReviewCampaignNotification(notification);

    if (!isChatNotification && !isReviewNotification) {
      await markNotificationAsRead(notification.id, notification);
      return;
    }

    await markNotificationAsRead(notification.id, notification);

    try {
      const targetCampaign = await findCampaignForNotification(notification.referenceId);

      if (!targetCampaign) {
        setNotificationsError('找不到這筆團購，無法開啟聊天室。');
        return;
      }

      if (isReviewNotification) {
        setIsNotificationsOpen(false);

        if ((targetCampaign.mineSource ?? '').toString().toUpperCase() === 'HOSTED') {
          const dashboard = await fetchHostDashboard(targetCampaign.id, token);
          const nextCampaign = buildHostParticipationCampaign(
            { ...targetCampaign, initialHostView: 'participants' },
            dashboard
          );
          setParticipationCampaign({ ...nextCampaign, initialHostView: 'participants' });
          setParticipationQuantityDraft(String(nextCampaign.hostReservedQuantity));
          return;
        }

        if (targetCampaign.host?.id != null) {
          handleOpenReview({
            campaignId: targetCampaign.id,
            revieweeId: targetCampaign.host.id,
            revieweeName: targetCampaign.host.displayName,
            source: 'participant',
          });
          return;
        }

        setNotificationsError('找不到可評價的對象');
        return;
      }

      if (!canOpenCampaignChat(targetCampaign)) {
        setNotificationsError('這筆團購目前無法開啟聊天室。');
        return;
      }

      await markCampaignChatNotificationsAsRead(targetCampaign.id);
      setIsNotificationsOpen(false);
      setChatCampaign(targetCampaign);
    } catch (error) {
      setNotificationsError(error.message);
    }
  };

  const handleSaveProfile = async () => {
    if (!token) {
      setAuthError('請先登入後再更新個人資料。');
      return;
    }

    setIsSavingProfile(true);
    setAuthError('');

    try {
      await updateCurrentUserProfile(
        {
          displayName: profileDraft.displayName,
          hasCostcoMembership: profileDraft.hasCostcoMembership,
        },
        token
      );

      const nextUser = normalizeUser({
        ...user,
        ...profileDraft,
      });

      setUser(nextUser);
      setStoredAuth({ token, user: nextUser });
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleOpenCreateCampaign = (scenarioType = 'SCHEDULED') => {
    if (!token) {
      setIsLoginModalOpen(true);
      setCreateCampaignError('');
      return;
    }

    setCreateCampaignError('');
    setCampaignForm((current) => ({
      ...getInitialCampaignForm(),
      storeId: current.storeId || stores[0]?.id?.toString() || '',
      categoryId: current.categoryId || categories[0]?.id?.toString() || '',
      scenarioType,
      expirePreset: scenarioType === 'SCHEDULED' ? 'custom' : current.expirePreset || '10m',
    }));
    setIsCreateCampaignOpen(true);
  };

  const refreshHome = useCallback(() => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setReferenceRefreshKey((current) => current + 1);
    setRefreshKey((current) => current + 1);
  }, [isRefreshing]);

  const renderPageDots = () => (
    showSwipeHint ? (
      <div className="swipe-cue" aria-label="可左右滑動切換頁面">
        <span className="swipe-cue-arrow left" aria-hidden="true">&lt;</span>
        <span className="swipe-cue-arrow right" aria-hidden="true">&gt;</span>
      </div>
    ) : (
      null
    )
  );

  const switchActiveType = (nextType) => {
    setActiveType((current) => {
      const resolvedType = typeof nextType === 'function' ? nextType(current) : nextType;
      if (!resolvedType || resolvedType === current) {
        return current;
      }

      const currentIndex = swipeTabs.findIndex((value) => value === current);
      const nextIndex = swipeTabs.findIndex((value) => value === resolvedType);
      setPageTransitionDirection(nextIndex >= currentIndex ? 'forward' : 'backward');
      return resolvedType;
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (window.localStorage.getItem(SWIPE_HINT_SEEN_KEY) === 'true') {
      return undefined;
    }

    let hasShown = false;
    let idleTimerId;
    let hideTimerId;

    const hideHint = () => {
      setShowSwipeHint(false);
      if (hideTimerId) {
        window.clearTimeout(hideTimerId);
      }
    };

    const showHint = () => {
      if (hasShown) {
        return;
      }

      hasShown = true;
      window.localStorage.setItem(SWIPE_HINT_SEEN_KEY, 'true');
      setShowSwipeHint(true);
      hideTimerId = window.setTimeout(hideHint, 4200);
    };

    const resetIdleTimer = () => {
      if (hasShown) {
        hideHint();
        return;
      }

      window.clearTimeout(idleTimerId);
      idleTimerId = window.setTimeout(showHint, 3000);
    };

    const events = ['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'];
    events.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      window.clearTimeout(idleTimerId);
      window.clearTimeout(hideTimerId);
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return undefined;
    }

    if (activeType === 'MINE' || activeType === 'REQUEST') {
      return undefined;
    }

    const refreshIntervalMs = activeType === 'SCHEDULED' ? 60000 : 15000;

    const refreshIfVisible = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      void loadCampaignPage({ silent: true });
    };

    const intervalId = window.setInterval(refreshIfVisible, refreshIntervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadCampaignPage({ silent: true });
      }
    };
    const handleWindowFocus = () => {
      refreshIfVisible();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [activeType, loadCampaignPage]);

  const switchActiveTypeBySwipe = (direction) => {
    if (window.innerWidth >= 700) {
      return;
    }

    switchActiveType((current) => {
      const currentIndex = swipeTabs.findIndex((value) => value === current);
      if (currentIndex === -1) {
        return current;
      }

      const nextIndex =
        direction === 'left' ? Math.min(currentIndex + 1, swipeTabs.length - 1) : Math.max(currentIndex - 1, 0);

      return swipeTabs[nextIndex] ?? current;
    });
  };

  const handleTouchStart = (event) => {
    const gestureTarget = event.target;
    if (
      gestureTarget instanceof Element &&
      gestureTarget.closest('.category-strip, .category-select, .market-checkbox-filter, .store-selector, .search-box')
    ) {
      swipeStartXRef.current = null;
      pullStartYRef.current = null;
      gestureLockRef.current = '';
      canPullRef.current = false;
      return;
    }

    const touch = event.touches[0];
    swipeStartXRef.current = touch?.clientX ?? null;
    pullStartYRef.current = touch?.clientY ?? null;
    gestureLockRef.current = '';

    if (window.innerWidth >= 700 || window.scrollY > 0 || isRefreshing) {
      canPullRef.current = false;
      return;
    }

    canPullRef.current = true;
  };

  const handleTouchMove = (event) => {
    const touch = event.touches[0];
    if (!touch || swipeStartXRef.current == null || pullStartYRef.current == null) {
      return;
    }

    const deltaX = touch.clientX - swipeStartXRef.current;
    const deltaY = touch.clientY - pullStartYRef.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (!gestureLockRef.current && (absDeltaX > 12 || absDeltaY > 12)) {
      gestureLockRef.current = absDeltaX > absDeltaY ? 'horizontal' : 'vertical';
      if (gestureLockRef.current === 'horizontal') {
        canPullRef.current = false;
        setPullDistance(0);
      }
    }

    if (gestureLockRef.current !== 'vertical' || !canPullRef.current) {
      return;
    }

    const delta = deltaY;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }

    setPullDistance(Math.min(delta * 0.45, 84));
  };

  const handleTouchEnd = (event) => {
    const startX = swipeStartXRef.current;
    const startY = pullStartYRef.current;
    const endTouch = event.changedTouches?.[0] ?? null;
    const deltaX = startX != null && endTouch ? endTouch.clientX - startX : 0;
    const deltaY = startY != null && endTouch ? endTouch.clientY - startY : 0;
    const isHorizontalSwipe = Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY);

    swipeStartXRef.current = null;
    pullStartYRef.current = null;
    gestureLockRef.current = '';

    if (isHorizontalSwipe) {
      switchActiveTypeBySwipe(deltaX < 0 ? 'left' : 'right');
      canPullRef.current = false;
      setPullDistance(0);
      return;
    }

    if (!canPullRef.current) {
      return;
    }

    canPullRef.current = false;

    if (pullDistance >= 60) {
      refreshHome();
      return;
    }

    setPullDistance(0);
  };

  const handleTouchCancel = () => {
    canPullRef.current = false;
    swipeStartXRef.current = null;
    pullStartYRef.current = null;
    gestureLockRef.current = '';
    setPullDistance(0);
  };

  const handleSubmitCreateCampaign = async () => {
    if (!token) {
      setCreateCampaignError('請先登入後再發起團購。');
      return;
    }

    if (campaignForm.scenarioType === 'INSTANT') {
      if (!isWithinHoduoBusinessHours()) {
        window.alert('現在非營業時間，但仍可建立即時團。');
      } else if (isHoduoClosingSoon()) {
        window.alert('賣場即將打烊，請留意截止與面交時間。');
      }
    }

    const requiredChecks = [
      ['店面', campaignForm.storeId],
      ['類別', campaignForm.categoryId],
      ['團購類型', campaignForm.scenarioType],
      ['商品名稱', campaignForm.itemName.trim()],
      ['商品圖片', campaignForm.images.length > 0 ? 'ok' : ''],
      ['單價', campaignForm.pricePerUnit],
      ['總數量', campaignForm.productTotalQuantity],
      ['待認購數量', campaignForm.openQuantity],
      ['截止時間', campaignForm.expirePreset === 'custom' ? campaignForm.expireTime : campaignForm.expirePreset],
      ['面交時間', campaignForm.meetupTime],
      ['面交地點', campaignForm.meetupLocation.trim()],
    ];

    if (campaignForm.scenarioType !== 'INSTANT') {
      requiredChecks[9][1] = 'ok';
    }

    const missingField = requiredChecks.find(([, value]) => !value);
    if (missingField) {
      setCreateCampaignError(`${missingField[0]}為必填`);
      return;
    }

    if (campaignForm.images.length > 3) {
      setCreateCampaignError('圖片最多只能上傳 3 張');
      return;
    }

    if (campaignForm.expirePreset === 'custom' && !resolveExpireTime(campaignForm)) {
      setCreateCampaignError('請選擇有效的截止時間');
      return;
    }

    if (Number(campaignForm.openQuantity) > Number(campaignForm.productTotalQuantity)) {
      setCreateCampaignError('待認購數量不能大於總數量');
      return;
    }

    const expireDate = resolveExpireDate(campaignForm);
    const meetupDate = parseLocalDateTime(campaignForm.meetupTime);
    if (!expireDate || !meetupDate) {
      setCreateCampaignError('\u8acb\u9078\u64c7\u6709\u6548\u7684\u622a\u6b62\u6642\u9593\u8207\u9762\u4ea4\u6642\u9593');
      return;
    }

    if (meetupDate.getTime() < expireDate.getTime()) {
      setCreateCampaignError('\u9762\u4ea4\u6642\u9593\u4e0d\u80fd\u65e9\u65bc\u622a\u6b62\u6642\u9593');
      return;
    }

    setIsCreatingCampaign(true);
    setCreateCampaignError('');

    try {
      const resolvedExpireTime = resolveExpireTime(campaignForm);
      const payload = {
        ...campaignForm,
        expireTime: resolvedExpireTime,
        storeId: Number(campaignForm.storeId),
        categoryId: Number(campaignForm.categoryId),
        pricePerUnit: Number(campaignForm.pricePerUnit),
        productTotalQuantity: Number(campaignForm.productTotalQuantity),
        openQuantity: Number(campaignForm.openQuantity),
      };
      delete payload.expirePreset;

      await createCampaign(payload, token);

      setIsCreateCampaignOpen(false);
      switchActiveType(campaignForm.scenarioType);
      setCampaignForm(getInitialCampaignForm());
      setCreatedCampaignSummary({
        itemName: payload.itemName,
        scenarioType: payload.scenarioType,
        storeName: stores.find((store) => store.id === payload.storeId)?.name || LABELS.noValue,
        categoryName: categories.find((category) => category.id === payload.categoryId)?.name || LABELS.noValue,
        productTotalQuantity: payload.productTotalQuantity,
        openQuantity: payload.openQuantity,
        pricePerUnit: payload.pricePerUnit,
        expireTime: payload.expireTime,
        meetupTime: payload.meetupTime,
        meetupLocation: payload.meetupLocation,
        imageCount: payload.images.length,
      });
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setCreateCampaignError(error.message);
    } finally {
      setIsCreatingCampaign(false);
    }
  };

  const handleLiveNotificationAction = async (notification) => {
    if (!notification) {
      return;
    }

    dismissLiveNotification(notification.toastKey ?? getLiveNotificationKey(notification));

    if (isFullCampaignNotification(notification) || isReviewCampaignNotification(notification)) {
      await handleNotificationAction(notification);
      return;
    }

    setIsNotificationsOpen(true);
  };

  const showSuccessToast = (title, message) => {
    setSuccessToast({ title, message });

    if (successToastTimerRef.current) {
      window.clearTimeout(successToastTimerRef.current);
    }

    successToastTimerRef.current = window.setTimeout(() => {
      setSuccessToast(null);
      successToastTimerRef.current = null;
    }, 3600);
  };

  const handleOpenJoinCampaign = (deal) => {
    if (!token) {
      setIsLoginModalOpen(true);
      return;
    }

    setSelectedDealToJoin(deal);
    setPurchaseQuantity(deal.availableQuantity > 0 ? '1' : '0');
    setPurchaseError('');
  };

  const handleCloseJoinCampaign = () => {
    if (isSubmittingPurchase) {
      return;
    }

    setSelectedDealToJoin(null);
    setPurchaseQuantity('1');
    setPurchaseError('');
  };

  const handleSubmitJoinCampaign = async () => {
    if (!selectedDealToJoin) {
      return;
    }

    const normalizedQuantity = Number(purchaseQuantity);
    if (!Number.isInteger(normalizedQuantity)) {
      setPurchaseError('\u8acb\u8f38\u5165\u6b63\u6574\u6578\u7684\u8a8d\u8cfc\u6578\u91cf');
      return;
    }

    if (normalizedQuantity <= 0) {
      setPurchaseError('\u8a8d\u8cfc\u6578\u91cf\u4e0d\u80fd\u70ba 0 \u6216\u8ca0\u6578');
      return;
    }

    if (normalizedQuantity > selectedDealToJoin.availableQuantity) {
      setPurchaseError('\u8a8d\u8cfc\u6578\u91cf\u4e0d\u80fd\u8d85\u904e\u5f85\u8a8d\u8cfc\u6578\u91cf');
      return;
    }

    setIsSubmittingPurchase(true);
    setPurchaseError('');

    try {
      const joinResponse = await joinCampaign(
        selectedDealToJoin.id,
        { quantity: normalizedQuantity },
        token
      );

      setCampaigns((current) => {
        const nextCampaigns = current.map((campaign) =>
          campaign.id === selectedDealToJoin.id
            ? {
                ...campaign,
                availableQuantity:
                  joinResponse?.availableQuantity ??
                  joinResponse?.available_quantity ??
                  campaign.availableQuantity - normalizedQuantity,
              }
            : campaign
        );

        return activeType === 'MINE'
          ? nextCampaigns
          : nextCampaigns.filter((campaign) => canDisplayMarketCampaign(campaign, activeType, hideFullCampaigns));
      });
      setSelectedDealToJoin(null);
      setPurchaseQuantity('1');
      setPurchaseError('');
      showSuccessToast('已加入團購', `認購 ${normalizedQuantity} 件，請留意後續通知。`);
    } catch (error) {
      setPurchaseError(error.message);
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  const patchCampaignImages = (campaignId, images, imageOrderNames) => {
    const applyImageOrder = (campaign) =>
      campaign && Number(campaign.id ?? campaign.campaignId) === Number(campaignId)
        ? {
            ...campaign,
            imageUrls: images,
            imageRefs: imageOrderNames,
            image: images[0] ?? campaign.image,
          }
        : campaign;

    setCampaigns((current) => current.map(applyImageOrder));
    setChatCampaign((current) => (current ? applyImageOrder(current) : current));
    setParticipationCampaign((current) => (current ? applyImageOrder(current) : current));
  };

  const handleOpenGallery = (deal, startIndex = 0) => {
    const images = (Array.isArray(deal.imageUrls) && deal.imageUrls.length > 0 ? deal.imageUrls : [deal.image]).filter(Boolean);
    const orderNames = getCampaignImageOrderNames({ ...deal, imageUrls: images }, images);
    const canReorder = canReorderCampaignImages({ ...deal, imageUrls: images }, user);

    setGalleryState({
      isOpen: true,
      title: deal.itemName,
      campaignId: deal.id ?? deal.campaignId ?? null,
      images,
      imageOrderNames: canReorder ? orderNames : [],
      originalImageOrderNames: canReorder ? orderNames : [],
      activeIndex: Math.min(Math.max(startIndex, 0), images.length - 1),
      canReorder,
      hasOrderChanges: false,
      isSavingOrder: false,
      orderMessage: '',
      orderError: '',
    });
  };

  const handleOpenImageOrderFromParticipation = (campaign) => {
    if (!campaign) {
      return;
    }

    handleOpenGallery(campaign, 0);
    setParticipationCampaign(null);
    setParticipationQuantityDraft('1');
    setParticipationError('');
  };

  const handleCloseGallery = () => {
    setGalleryState((current) => ({
      ...current,
      isOpen: false,
    }));
  };

  const handleSelectGalleryImage = (nextIndex) => {
    setGalleryState((current) => ({
      ...current,
      activeIndex: nextIndex,
    }));
  };

  const handleStepGallery = (direction) => {
    setGalleryState((current) => {
      if (!current.images.length) {
        return current;
      }

      const step = direction === 'next' ? 1 : -1;
      const nextIndex = (current.activeIndex + step + current.images.length) % current.images.length;

      return {
        ...current,
        activeIndex: nextIndex,
      };
    });
  };

  const handleMoveGalleryImage = (fromIndex, toIndex) => {
    setGalleryState((current) => {
      if (!current.canReorder || current.isSavingOrder) {
        return current;
      }

      const nextImages = reorderList(current.images, fromIndex, toIndex);
      const nextOrderNames = reorderList(current.imageOrderNames, fromIndex, toIndex);

      if (nextImages === current.images || nextOrderNames === current.imageOrderNames) {
        return current;
      }

      return {
        ...current,
        images: nextImages,
        imageOrderNames: nextOrderNames,
        activeIndex: toIndex,
        hasOrderChanges: !areStringArraysEqual(nextOrderNames, current.originalImageOrderNames),
        orderMessage: '',
        orderError: '',
      };
    });
  };

  const handleMoveGalleryImageToFront = (fromIndex) => {
    handleMoveGalleryImage(fromIndex, 0);
  };

  const handleSaveGalleryImageOrder = async () => {
    const {
      campaignId,
      images,
      imageOrderNames,
      canReorder,
      hasOrderChanges,
      isSavingOrder,
    } = galleryState;

    if (!canReorder || !hasOrderChanges || isSavingOrder || !campaignId) {
      return;
    }

    if (!token) {
      setGalleryState((current) => ({
        ...current,
        orderError: '請先登入後再儲存圖片順序。',
      }));
      setIsLoginModalOpen(true);
      return;
    }

    if (imageOrderNames.length !== images.length || imageOrderNames.some((name) => !name)) {
      setGalleryState((current) => ({
        ...current,
        orderError: '圖片資料不完整，請重新整理後再試一次。',
      }));
      return;
    }

    setGalleryState((current) => ({
      ...current,
      isSavingOrder: true,
      orderMessage: '',
      orderError: '',
    }));

    try {
      const response = await updateCampaignImageOrder(campaignId, imageOrderNames, token);

      patchCampaignImages(campaignId, images, imageOrderNames);
      setGalleryState((current) =>
        Number(current.campaignId) === Number(campaignId)
          ? {
              ...current,
              originalImageOrderNames: imageOrderNames,
              hasOrderChanges: false,
              isSavingOrder: false,
              orderMessage: response?.message ?? '圖片順序已成功更新',
              orderError: '',
            }
          : current
      );
      showSuccessToast('圖片順序已更新', '新的封面與排序已儲存。');
    } catch (error) {
      setGalleryState((current) => ({
        ...current,
        isSavingOrder: false,
        orderError: error instanceof Error ? error.message : '圖片順序更新失敗',
      }));
    }
  };

  const handleOpenUserProfile = (profileUser, source = 'card') => {
    if (!profileUser?.id) {
      return;
    }

    sessionStorage.setItem(
      PROFILE_RETURN_CONTEXT_KEY,
      JSON.stringify({
        source,
        scrollY: window.scrollY,
        ui: {
          activeType,
          activeCategory,
          hideFullCampaigns,
          activeStore,
          activeMyCampaignScope,
          activeMyCampaignFilter,
          search,
        },
        campaign: source === 'chat' ? chatCampaign : null,
      })
    );

    navigate(`/users/${profileUser.id}`, {
      state: {
        user: profileUser,
      },
    });
  };

  const handleOpenChat = async (deal) => {
    if (!token) {
      setIsLoginModalOpen(true);
      return;
    }

    let nextDeal = deal;
    try {
      nextDeal = await refreshMineCampaignsBeforeOpen(deal);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : '團購資料刷新失敗');
    }

    if (!canOpenCampaignChat(nextDeal)) {
      return;
    }

    await markCampaignChatNotificationsAsRead(nextDeal.id);
    markChatRoomAsRead(nextDeal.id);
    setChatCampaign(nextDeal);
  };

  const handleOpenParticipationFromChat = async (deal) => {
    await handleOpenParticipation(deal);
    setChatCampaign(null);
  };

  const handleOpenChatFromParticipation = async (deal) => {
    setParticipationCampaign(null);
    setParticipationQuantityDraft('1');
    setParticipationError('');
    await handleOpenChat(deal);
  };

  const handleOpenReview = (target) => {
    if (!token) {
      setIsLoginModalOpen(true);
      return;
    }

    setReviewTarget(target ?? null);
  };

  const handleCloseReview = () => {
    setReviewTarget(null);
  };

  const handleReviewSubmitted = (target) => {
    if (target?.campaignId != null && target?.revieweeId != null) {
      setReviewedReviewKeys((current) => ({
        ...current,
        [getReviewKey(target.campaignId, target.revieweeId)]: true,
      }));

      setChatReviewState((current) => {
        if (target.source === 'participant') {
          return {
            ...current,
            isParticipantReviewed: true,
          };
        }

        if (target.source === 'host') {
          const participants = Array.isArray(participationCampaign?.dashboard?.participants)
            ? participationCampaign.dashboard.participants
            : [];
          const nextReviewedKeys = {
            ...reviewedReviewKeys,
            [getReviewKey(target.campaignId, target.revieweeId)]: true,
          };
          const reviewableParticipants = participants.filter((participant) => participant.userId != null);

          return {
            ...current,
            isHostAllReviewed:
              reviewableParticipants.length > 0 &&
              reviewableParticipants.every((participant) =>
                Boolean(nextReviewedKeys[getReviewKey(target.campaignId, participant.userId)])
              ),
          };
        }

        return current;
      });
    }

    handleCloseReview();
  };

  const loadReviewStatusesForCampaign = useCallback(
    async (campaign) => {
      if (!token || !campaign?.id) {
        return;
      }

      const isHostCampaign = isSameUserId(campaign.host?.id, user?.id) || campaign.isHost;

      if (isHostCampaign) {
        const dashboard = campaign.dashboard?.participants ? campaign.dashboard : await fetchHostDashboard(campaign.id, token);
        const participants = Array.isArray(dashboard?.participants)
          ? dashboard.participants.map((participant, index) => normalizeHostParticipant(participant, index))
          : [];
        const reviewableParticipants = participants.filter((participant) => participant.userId != null);

        if (reviewableParticipants.length === 0) {
          setChatReviewState((current) => ({
            ...current,
            isHostAllReviewed: false,
          }));
          return;
        }

        const results = await Promise.all(
          reviewableParticipants.map(async (participant) => {
            try {
              const data = await checkReviewStatus(campaign.id, participant.userId, token);
              return {
                key: getReviewKey(campaign.id, participant.userId),
                reviewed: isReviewAlreadyCompleted(data),
              };
            } catch {
              return {
                key: getReviewKey(campaign.id, participant.userId),
                reviewed: false,
              };
            }
          })
        );

        setReviewedReviewKeys((current) => {
          const next = { ...current };
          results.forEach((result) => {
            next[result.key] = result.reviewed;
          });
          return next;
        });
        setChatReviewState((current) => ({
          ...current,
          isHostAllReviewed: results.length > 0 && results.every((result) => result.reviewed),
        }));
        return;
      }

      if (campaign.host?.id == null) {
        return;
      }

      try {
        const data = await checkReviewStatus(campaign.id, campaign.host.id, token);
        const reviewed = isReviewAlreadyCompleted(data);
        setReviewedReviewKeys((current) => ({
          ...current,
          [getReviewKey(campaign.id, campaign.host.id)]: reviewed,
        }));
        setChatReviewState((current) => ({
          ...current,
          isParticipantReviewed: reviewed,
        }));
      } catch {
        setChatReviewState((current) => ({
          ...current,
          isParticipantReviewed: false,
        }));
      }
    },
    [token, user?.id]
  );

  useEffect(() => {
    if (!chatCampaign) {
      setChatReviewState({
        isParticipantReviewed: false,
        isHostAllReviewed: false,
      });
      return;
    }

    void loadReviewStatusesForCampaign(chatCampaign);
  }, [chatCampaign?.id, chatCampaign?.status, loadReviewStatusesForCampaign]);

  useEffect(() => {
    if (!participationCampaign || participationCampaign.managementMode !== 'HOST') {
      return;
    }

    void loadReviewStatusesForCampaign(participationCampaign);
  }, [loadReviewStatusesForCampaign, participationCampaign?.id, participationCampaign?.managementMode, participationCampaign?.status]);

  const handleOpenParticipation = async (deal) => {
    if (!token) {
      setIsLoginModalOpen(true);
      return;
    }

    setParticipationError('');

    const openParticipationFromDeal = (nextDeal) => {
      const readonlyQuantity = Number(
        nextDeal?.quantity ??
          nextDeal?.joinQuantity ??
          nextDeal?.join_quantity ??
          nextDeal?.joinedQuantity ??
          nextDeal?.joined_quantity ??
          0
      );

      setParticipationCampaign({
        ...nextDeal,
        managementMode: 'JOINED',
        isHost: false,
        joined: true,
        quantity: readonlyQuantity,
        isReadonlyParticipation: canOpenReadonlyParticipationFromDeal(nextDeal),
      });
      setParticipationQuantityDraft(String(readonlyQuantity));
    };

    try {
      const nextDeal = await refreshMineCampaignsBeforeOpen(deal);
      const isHostDeal = isSameUserId(nextDeal.host?.id, user?.id) || nextDeal.isHost;

      if (isHostDeal) {
        const dashboard = await fetchHostDashboard(nextDeal.id, token);
        const nextCampaign = buildHostParticipationCampaign(nextDeal, dashboard);

        setParticipationCampaign(nextCampaign);
        setParticipationQuantityDraft(String(nextCampaign.hostReservedQuantity));
        return;
      }

      openParticipationFromDeal(nextDeal);

      const participation = await fetchMyParticipation(nextDeal.id, token);
      const participantStatus = (
        participation?.myParticipantStatus ??
        participation?.my_participant_status ??
        nextDeal?.myParticipantStatus ??
        nextDeal?.my_participant_status ??
        participation?.participantStatus ??
        participation?.participant_status ??
        ''
      )
        .toString()
        .toUpperCase();
      const mergedDeal = {
        ...nextDeal,
        managementMode: 'JOINED',
        isHost: Boolean(participation?.host ?? nextDeal.isHost),
        myParticipantStatus: participantStatus || nextDeal?.myParticipantStatus || '',
        isReadonlyParticipation:
          getMineCampaignBucket({
            ...nextDeal,
            myParticipantStatus: participantStatus || nextDeal?.myParticipantStatus || '',
            participantStatus,
            quantity:
              participation?.quantity ??
              participation?.joinedQuantity ??
              participation?.joined_quantity ??
              nextDeal.quantity ??
              nextDeal.joinQuantity ??
              nextDeal.join_quantity ??
              0,
          }) === 'COMPLETED',
        joined: participantStatus
          ? isViewableParticipantStatus(participantStatus)
          : Boolean(participation?.joined ?? nextDeal.joined ?? Number(nextDeal.quantity) > 0),
        quantity: Number(
          participation?.quantity ??
            participation?.joinedQuantity ??
            participation?.joined_quantity ??
            nextDeal.quantity ??
            nextDeal.joinQuantity ??
            nextDeal.join_quantity ??
            0
        ),
      };

      if (mergedDeal.isHost || !mergedDeal.joined || mergedDeal.quantity <= 0) {
        setParticipationError('目前沒有可調整的認購紀錄');
        return;
      }

      setParticipationCampaign(mergedDeal);
      setParticipationQuantityDraft(String(mergedDeal.quantity));
    } catch (error) {
      setParticipationError(error.message);
    }
  };

  const handleCloseParticipation = () => {
    if (isSubmittingParticipation) {
      return;
    }

    setParticipationCampaign(null);
    setParticipationQuantityDraft('1');
    setParticipationError('');
  };

  const handleConfirmCampaignReceipt = async (campaignId) => {
    if (!token) {
      return { success: false, message: '請先登入後再確認收貨' };
    }

    try {
      const response = await confirmCampaignReceipt(campaignId, token);

      setCampaigns((current) =>
        current.map((campaign) =>
          Number(campaign.id) === Number(campaignId)
            ? {
                ...campaign,
                status: 'CONFIRMED',
              }
            : campaign
        )
      );

      setParticipationCampaign((current) =>
        current && Number(current.id) === Number(campaignId)
          ? {
              ...current,
              status: 'CONFIRMED',
            }
          : current
      );

      return {
        success: true,
        message: response?.message ?? '已確認收到商品',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '確認收到失敗',
      };
    }
  };

  const handleDeliverCampaign = async (campaignId) => {
    if (!token) {
      return { success: false, message: '請先登入後再標記已面交' };
    }

    try {
      const response = await deliverCampaign(campaignId, token);

      setCampaigns((current) =>
        current.map((campaign) =>
          Number(campaign.id) === Number(campaignId)
            ? {
                ...campaign,
                status: 'DELIVERED',
              }
            : campaign
        )
      );

      setChatCampaign((current) =>
        current && Number(current.id) === Number(campaignId)
          ? {
              ...current,
              status: 'DELIVERED',
            }
          : current
      );

      setParticipationCampaign((current) =>
        current && Number(current.id) === Number(campaignId)
          ? {
              ...current,
              status: 'DELIVERED',
              dashboard: current.dashboard
                ? {
                    ...current.dashboard,
                    status: 'DELIVERED',
                  }
                : current.dashboard,
            }
          : current
      );

      return {
        success: true,
        message: response?.message ?? '已標記面交完成',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '標記面交失敗',
      };
    }
  };

  const handleRaiseCampaignDispute = async (campaignId, reason) => {
    if (!token) {
      return { success: false, message: '請先登入後再提出仲裁' };
    }

    try {
      const response = await raiseCampaignDispute(campaignId, token, reason);

      setCampaigns((current) =>
        current.map((campaign) =>
          Number(campaign.id) === Number(campaignId)
            ? {
                ...campaign,
                myParticipantStatus: 'DISPUTED',
              }
            : campaign
        )
      );

      setChatCampaign((current) =>
        current && Number(current.id) === Number(campaignId)
          ? {
              ...current,
              myParticipantStatus: 'DISPUTED',
            }
          : current
      );

      setParticipationCampaign((current) =>
        current && Number(current.id) === Number(campaignId)
          ? {
              ...current,
              myParticipantStatus: 'DISPUTED',
            }
          : current
      );

      return {
        success: true,
        message: response?.message ?? '已提出仲裁',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '提出仲裁失敗',
      };
    }
  };

  const handleCampaignStatusChange = useCallback(
    async ({ campaignId, status, message, source = '' }) => {
      if (!campaignId || !status) {
        return;
      }

      const normalizedStatus = status.toString().toUpperCase();
      const applyStatus = (campaign) =>
        Number(campaign?.id) === Number(campaignId)
          ? {
              ...campaign,
              status: normalizedStatus,
              campaignStatus: normalizedStatus,
              dashboard: campaign.dashboard
                ? {
                    ...campaign.dashboard,
                    status: normalizedStatus,
                  }
                : campaign.dashboard,
            }
          : campaign;

      setCampaigns((current) => current.map(applyStatus));
      setChatCampaign((current) => (current ? applyStatus(current) : current));
      setParticipationCampaign((current) => (current ? applyStatus(current) : current));

      if (message && source !== 'topic') {
        setChatStatusEvent({
          id: `${campaignId}-${normalizedStatus}-${Date.now()}`,
          campaignId,
          status: normalizedStatus,
          message,
        });
      }

      if (!token) {
        return;
      }

      const currentCampaign =
        chatCampaign && Number(chatCampaign.id) === Number(campaignId)
          ? chatCampaign
          : participationCampaign && Number(participationCampaign.id) === Number(campaignId)
            ? participationCampaign
            : campaigns.find((campaign) => Number(campaign.id) === Number(campaignId));
      const isHostCampaign = isSameUserId(currentCampaign?.host?.id, user?.id) || currentCampaign?.isHost;

      try {
        if (isHostCampaign) {
          const dashboard = await fetchHostDashboard(campaignId, token);
          const normalizedDashboard = normalizeHostDashboard(dashboard);

          setChatCampaign((current) =>
            current && Number(current.id) === Number(campaignId)
              ? {
                  ...current,
                  status: normalizedDashboard.status || normalizedStatus,
                  dashboard: normalizedDashboard,
                }
              : current
          );
          setParticipationCampaign((current) =>
            current && Number(current.id) === Number(campaignId)
              ? buildHostParticipationCampaign(
                  {
                    ...current,
                    status: normalizedDashboard.status || normalizedStatus,
                  },
                  dashboard
                )
              : current
          );
          setParticipationQuantityDraft(String(normalizedDashboard.hostReservedQuantity));
          return;
        }

        const participation = await fetchMyParticipation(campaignId, token);
        const participantStatus = (
          participation?.myParticipantStatus ??
          participation?.my_participant_status ??
          participation?.participantStatus ??
          participation?.participant_status ??
          ''
        )
          .toString()
          .toUpperCase();
        const joinedQuantity = Number(
          participation?.quantity ??
            participation?.joinedQuantity ??
            participation?.joined_quantity ??
            0
        );
        const participantPatch = {
          status: normalizedStatus,
          campaignStatus: normalizedStatus,
          myParticipantStatus: participantStatus,
          participantStatus,
          joined: participantStatus ? isViewableParticipantStatus(participantStatus) : Boolean(participation?.joined),
          quantity: joinedQuantity,
        };

        setChatCampaign((current) =>
          current && Number(current.id) === Number(campaignId)
            ? {
                ...current,
                ...participantPatch,
              }
            : current
        );
        setParticipationCampaign((current) =>
          current && Number(current.id) === Number(campaignId)
            ? {
                ...current,
                ...participantPatch,
                managementMode: current.managementMode ?? 'JOINED',
              }
            : current
        );
        setParticipationQuantityDraft((current) => (joinedQuantity > 0 ? String(joinedQuantity) : current));
      } catch (error) {
        setCampaignError(error instanceof Error ? error.message : '團購狀態刷新失敗');
      }
    },
    [campaigns, chatCampaign, participationCampaign, token, user?.id]
  );

  const refreshOpenChatCampaign = useCallback(
    async (campaignId, message = '') => {
      if (!campaignId || !token) {
        return;
      }

      const latestCampaign = await findCampaignForNotification(campaignId, { forceRemote: true });
      if (!latestCampaign) {
        return;
      }

      setCampaigns((current) =>
        current.map((campaign) =>
          Number(campaign.id) === Number(campaignId)
            ? {
                ...campaign,
                ...latestCampaign,
              }
            : campaign
        )
      );
      setChatCampaign((current) =>
        current && Number(current.id) === Number(campaignId)
          ? {
              ...current,
              ...latestCampaign,
            }
          : current
      );
      setParticipationCampaign((current) =>
        current && Number(current.id) === Number(campaignId)
          ? {
              ...current,
              ...latestCampaign,
            }
          : current
      );

      if (message) {
        setChatStatusEvent({
          id: `${campaignId}-notification-${Date.now()}`,
          campaignId,
          status: latestCampaign.status ?? latestCampaign.campaignStatus ?? '',
          message,
        });
      }

      if (!isSameUserId(latestCampaign.host?.id, user?.id) && !latestCampaign.isHost) {
        try {
          const participation = await fetchMyParticipation(campaignId, token);
          const participantStatus = (
            participation?.myParticipantStatus ??
            participation?.my_participant_status ??
            participation?.participantStatus ??
            participation?.participant_status ??
            latestCampaign.myParticipantStatus ??
            ''
          )
            .toString()
            .toUpperCase();
          const joinedQuantity = Number(
            participation?.quantity ??
              participation?.joinedQuantity ??
              participation?.joined_quantity ??
              latestCampaign.quantity ??
              0
          );

          setChatCampaign((current) =>
            current && Number(current.id) === Number(campaignId)
              ? {
                  ...current,
                  myParticipantStatus: participantStatus,
                  participantStatus,
                  joined: participantStatus ? isViewableParticipantStatus(participantStatus) : current.joined,
                  quantity: joinedQuantity || current.quantity,
                }
              : current
          );
        } catch {
          // The latest campaign payload is still enough to update status-driven chat actions.
        }
      }
    },
    [findCampaignForNotification, token, user?.id]
  );

  const latestLiveNotification = liveNotifications[0] ?? null;

  useEffect(() => {
    if (!latestLiveNotification?.referenceId || !chatCampaign?.id) {
      return;
    }

    if (Number(latestLiveNotification.referenceId) !== Number(chatCampaign.id)) {
      return;
    }

    const notificationKey =
      latestLiveNotification.id ??
      `${latestLiveNotification.type}-${latestLiveNotification.referenceId}-${latestLiveNotification.createdAt}`;
    if (lastHandledChatNotificationRef.current === notificationKey) {
      return;
    }
    lastHandledChatNotificationRef.current = notificationKey;

    const statusByNotificationType = {
      CAMPAIGN_FULL: 'FULL',
      CAMPAIGN_DELIVERED: 'DELIVERED',
      CAMPAIGN_COMPLETED: 'COMPLETED',
      CAMPAIGN_CANCELLED: 'CANCELLED',
    };
    const nextStatus = statusByNotificationType[latestLiveNotification.type];

    if (!nextStatus) {
      void refreshOpenChatCampaign(latestLiveNotification.referenceId, latestLiveNotification.content);
      return;
    }

    void handleCampaignStatusChange({
      campaignId: latestLiveNotification.referenceId,
      status: nextStatus,
      message: latestLiveNotification.content,
      source: 'notification',
    });
    void refreshOpenChatCampaign(latestLiveNotification.referenceId);
  }, [chatCampaign?.id, handleCampaignStatusChange, latestLiveNotification, refreshOpenChatCampaign]);

  const refreshHostParticipationCampaign = async (campaignId) => {
    const dashboard = await fetchHostDashboard(campaignId, token);

    setParticipationCampaign((current) => {
      if (!current || current.id !== campaignId) {
        return current;
      }

      return buildHostParticipationCampaign(current, dashboard);
    });

    const normalizedDashboard = normalizeHostDashboard(dashboard);
    setParticipationQuantityDraft(String(normalizedDashboard.hostReservedQuantity));
    return normalizedDashboard;
  };

  const handleUnlockCampaign = async (campaignId) => {
    if (!token || !campaignId) {
      return {
        success: false,
        message: '缺少團購或登入資訊，無法開啟修改。',
      };
    }

    setIsSubmittingParticipation(true);
    setParticipationError('');

    try {
      const response = await unlockCampaignRevision(campaignId, token);
      await refreshHostParticipationCampaign(campaignId);
      setRefreshKey((current) => current + 1);

      return {
        success: true,
        message: response?.message ?? '已開啟滿單後修改',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '開啟滿單後修改失敗';
      setParticipationError(message);
      return {
        success: false,
        message,
      };
    } finally {
      setIsSubmittingParticipation(false);
    }
  };

  const _handleKickParticipant = async (participant) => {
    const campaignId = participationCampaign?.id;
    const participantId = participant?.participantId ?? participant?.userId ?? participant?.id ?? null;
    const campaignStatus = (participationCampaign?.dashboard?.status ?? participationCampaign?.status ?? '').toString().toUpperCase();
    const reason = campaignStatus === 'DELIVERED' ? '找不到人' : undefined;

    if (!token || !campaignId || !participantId) {
      setParticipationError('缺少團員資訊，無法剔除。');
      return;
    }

    setIsSubmittingParticipation(true);
    setParticipationError('');

    try {
      await kickCampaignParticipant(campaignId, participantId, token, reason);
      await refreshHostParticipationCampaign(campaignId);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setParticipationError(error instanceof Error ? error.message : '剔除團員失敗');
    } finally {
      setIsSubmittingParticipation(false);
    }
  };

  const handleParticipantStatusAction = async (payload) => {
    const participant = payload?.participant ?? payload;
    const inputReason = payload?.reason ?? '';
    const campaignId = participationCampaign?.id;
    const participantId =
      participant?.participantId ??
      participant?.participantsId ??
      participant?.participants_id ??
      participant?.id ??
      null;
    const userId = participant?.userId ?? participant?.user_id ?? participant?.memberId ?? null;
    const campaignStatus = (participationCampaign?.dashboard?.status ?? participationCampaign?.status ?? '')
      .toString()
      .toUpperCase();
    const reason = inputReason.trim();

    if (!token || !campaignId || (campaignStatus === 'DELIVERED' ? !userId : !participantId)) {
      setParticipationError('缺少成員資訊，無法處理。');
      return;
    }

    setIsSubmittingParticipation(true);
    setParticipationError('');

    try {
      if (campaignStatus === 'DELIVERED') {
        await markParticipantNoShow(campaignId, userId, token, reason || '找不到人');
      } else {
        await kickCampaignParticipant(campaignId, participantId, token, reason || undefined);
      }

      await refreshHostParticipationCampaign(campaignId);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setParticipationError(error instanceof Error ? error.message : '處理成員狀態失敗');
    } finally {
      setIsSubmittingParticipation(false);
    }
  };

  const handleSubmitParticipation = async () => {
    if (!participationCampaign) {
      return;
    }

    if (participationCampaign.managementMode === 'HOST') {
      const nextReservedQuantity = Number(participationQuantityDraft);
      const totalPhysicalQuantity = Number(participationCampaign.totalPhysicalQuantity ?? 0);
      const alreadySoldQuantity = Number(participationCampaign.alreadySoldQuantity ?? 0);

      if (!Number.isInteger(nextReservedQuantity) || nextReservedQuantity < 0) {
        setParticipationError('請輸入 0 以上的整數自留數量');
        return;
      }

      const nextOpenQuantity = totalPhysicalQuantity - nextReservedQuantity;
      if (nextOpenQuantity < alreadySoldQuantity) {
        setParticipationError('自留數量過高，會小於目前已售出數量');
        return;
      }

      setIsSubmittingParticipation(true);
      setParticipationError('');

      try {
        await hostReviseCampaign(
          participationCampaign.id,
          {
            newProductTotalQuantity: totalPhysicalQuantity,
            newOpenQuantity: nextOpenQuantity,
          },
          token
        );
        handleCloseParticipation();
        setRefreshKey((current) => current + 1);
      } catch (error) {
        setParticipationError(error.message);
      } finally {
        setIsSubmittingParticipation(false);
      }

      return;
    }

    const nextQuantity = Number(participationQuantityDraft);
    const currentQuantity = Number(participationCampaign.quantity) || 0;

    if (!Number.isInteger(nextQuantity) || nextQuantity <= 0) {
      setParticipationError('請輸入大於 0 的整數數量');
      return;
    }

    if (nextQuantity === currentQuantity) {
      handleCloseParticipation();
      return;
    }

    setIsSubmittingParticipation(true);
    setParticipationError('');

    try {
      if (nextQuantity > currentQuantity) {
        await joinCampaign(participationCampaign.id, { quantity: nextQuantity - currentQuantity }, token);
      } else {
        await reviseCampaign(participationCampaign.id, { quantity: currentQuantity - nextQuantity }, token);
      }

      handleCloseParticipation();
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setParticipationError(error.message);
    } finally {
      setIsSubmittingParticipation(false);
    }
  };

  const handleWithdrawParticipation = async () => {
    if (!participationCampaign) {
      return;
    }

    setIsSubmittingParticipation(true);
    setParticipationError('');

    try {
      await withdrawCampaign(participationCampaign.id, token);
      handleCloseParticipation();
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setParticipationError(error.message);
    } finally {
      setIsSubmittingParticipation(false);
    }
  };

  const handleCancelHostedCampaign = async () => {
    if (!participationCampaign) {
      return;
    }

    setIsSubmittingParticipation(true);
    setParticipationError('');

    try {
      await cancelCampaign(participationCampaign.id, token);
      handleCloseParticipation();
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setParticipationError(error.message);
    } finally {
      setIsSubmittingParticipation(false);
    }
  };

  const dealViewModeScope = isDesktopViewport ? (activeType === 'MINE' ? 'mine' : 'market') : 'mobile';
  const defaultDealViewMode =
    isDesktopViewport && activeType === 'MINE' && activeMyCampaignScope === 'ALL' ? 'compact' : 'card';
  const dealViewMode = dealViewModePreferences[dealViewModeScope] || defaultDealViewMode;
  const isCompactDealList = activeType !== 'REQUEST' && dealViewMode === 'compact';
  const isMineCompactList = activeType === 'MINE' && isCompactDealList;

  const handleChangeDealViewMode = (nextMode) => {
    setDealViewModePreferences((current) => ({
      ...current,
      [dealViewModeScope]: nextMode,
    }));
    localStorage.setItem(DEAL_VIEW_MODE_KEYS[dealViewModeScope], nextMode);
    setExpandedCompactDealId('');
  };

  const renderFloatingDealViewControl = () => (
    <div
      className={isDealViewControlVisible ? 'floating-view-control' : 'floating-view-control hidden'}
      aria-label="檢視模式"
    >
      <button
        type="button"
        className={dealViewMode === 'card' ? 'floating-view-button active' : 'floating-view-button'}
        onClick={() => handleChangeDealViewMode('card')}
        aria-pressed={dealViewMode === 'card'}
        aria-label="卡片檢視"
        title="卡片檢視"
      >
        <CardViewIcon />
      </button>
      <button
        type="button"
        className={dealViewMode === 'compact' ? 'floating-view-button active' : 'floating-view-button'}
        onClick={() => handleChangeDealViewMode('compact')}
        aria-pressed={dealViewMode === 'compact'}
        aria-label="精簡檢視"
        title="精簡檢視"
      >
        <CompactViewIcon />
      </button>
    </div>
  );

  return (
    <div
      className="app-shell"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <div
        className={`pull-refresh-indicator${isRefreshing ? ' refreshing' : ''}${pullDistance >= 60 ? ' ready' : ''}`}
        style={{ height: isRefreshing ? 52 : pullDistance }}
      >
        <span>{isRefreshing ? '刷新中...' : pullDistance >= 60 ? '放開即可刷新' : '下拉刷新首頁'}</span>
      </div>

      <HomeTopBar
        labels={LABELS}
        token={token}
        user={user}
        stores={stores}
        activeStore={activeStore}
        chatUnreadRoomCount={chatUnreadRoomCount}
        unreadCount={notifications.length}
        onChangeStore={setActiveStore}
        onOpenProfile={openProfile}
        onOpenChatRooms={handleOpenChatRooms}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onRefresh={refreshHome}
        isRefreshing={isRefreshing}
      />

      {liveNotifications.length > 0 && (
        <div className="live-notification-stack" aria-live="polite" aria-atomic="false">
          {liveNotifications.map((notification) => (
            <article
              key={notification.toastKey}
              className={`live-notification-card ${getLiveNotificationTone(notification)}`}
            >
              <button
                type="button"
                className="live-notification-card-body"
                onClick={() => void handleLiveNotificationAction(notification)}
              >
                <strong>{notification.typeLabel}</strong>
                <span>{notification.content}</span>
              </button>
              <button
                type="button"
                className="live-notification-card-close"
                onClick={() => dismissLiveNotification(notification.toastKey)}
                aria-label="關閉提示"
                title="關閉"
              >
                ×
              </button>
            </article>
          ))}
        </div>
      )}

      {successToast && (
        <button
          type="button"
          className="live-notification-toast success-toast"
          onClick={() => {
            setSuccessToast(null);
            if (successToastTimerRef.current) {
              window.clearTimeout(successToastTimerRef.current);
              successToastTimerRef.current = null;
            }
          }}
        >
          <strong>{successToast.title}</strong>
          <span>{successToast.message}</span>
        </button>
      )}

      <LoginModal
        labels={LABELS}
        isOpen={isLoginModalOpen}
        authLoading={authLoading}
        authError={authError}
        onClose={() => setIsLoginModalOpen(false)}
        onLineLogin={handleLineLogin}
        onDevLogin={handleDevLogin}
      />

      <ProfileModal
        labels={LABELS}
        user={user}
        profileDraft={profileDraft}
        isOpen={isProfileOpen}
        isSavingProfile={isSavingProfile}
        themeMode={themeMode}
        onClose={() => setIsProfileOpen(false)}
        onLogout={handleLogout}
        onSaveProfile={handleSaveProfile}
        setProfileDraft={setProfileDraft}
        onToggleTheme={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}
      />

      <ChatRoomsModal
        labels={LABELS}
        isOpen={isChatRoomsOpen}
        chatRooms={chatRooms}
        isLoading={isChatRoomsLoading}
        error={chatRoomsError}
        onClose={() => setIsChatRoomsOpen(false)}
        onOpenChat={handleOpenChatRoom}
      />

      <NotificationsModal
        labels={LABELS}
        isOpen={isNotificationsOpen}
        notifications={notifications}
        readNotifications={readNotifications}
        isLoading={isNotificationsLoading}
        isReadLoading={isReadNotificationsLoading}
        error={notificationsError}
        readError={readNotificationsError}
        isSoundEnabled={isNotificationSoundEnabled}
        onToggleSound={handleToggleNotificationSound}
        onClose={() => setIsNotificationsOpen(false)}
        onNotificationAction={handleNotificationAction}
      />

      <CreateCampaignModal
        labels={uiLabels}
        isOpen={isCreateCampaignOpen}
        stores={stores}
        categories={categories}
        typeOptions={TYPE_OPTIONS}
        expirePresetOptions={localizedExpirePresetOptions}
        campaignForm={campaignForm}
        createCampaignError={createCampaignError}
        isCreatingCampaign={isCreatingCampaign}
        onClose={() => setIsCreateCampaignOpen(false)}
        setCampaignForm={setCampaignForm}
        onSubmit={handleSubmitCreateCampaign}
        setCreateCampaignError={setCreateCampaignError}
      />

      <CreateCampaignSuccessModal
        labels={LABELS}
        isOpen={Boolean(createdCampaignSummary)}
        summary={createdCampaignSummary}
        formatDateTime={formatDateTime}
        getScenarioLabel={getScenarioLabel}
        onClose={() => setCreatedCampaignSummary(null)}
      />

      <JoinCampaignModal
        isOpen={Boolean(selectedDealToJoin)}
        labels={uiLabels}
        selectedDeal={selectedDealToJoin}
        purchaseQuantity={purchaseQuantity}
        purchaseError={purchaseError}
        isSubmitting={isSubmittingPurchase}
        onClose={handleCloseJoinCampaign}
        onChangeQuantity={setPurchaseQuantity}
        onSubmit={handleSubmitJoinCampaign}
      />

      <ImageGalleryModal
        isOpen={galleryState.isOpen}
        title={galleryState.title}
        images={galleryState.images}
        activeIndex={galleryState.activeIndex}
        onClose={handleCloseGallery}
        onPrev={() => handleStepGallery('prev')}
        onNext={() => handleStepGallery('next')}
        onSelect={handleSelectGalleryImage}
        canReorder={galleryState.canReorder}
        canSaveOrder={galleryState.hasOrderChanges}
        isSavingOrder={galleryState.isSavingOrder}
        orderMessage={galleryState.orderMessage}
        orderError={galleryState.orderError}
        onMoveImage={handleMoveGalleryImage}
        onMoveImageToFront={handleMoveGalleryImageToFront}
        onSaveOrder={handleSaveGalleryImageOrder}
      />

      <CampaignChatModal
        isOpen={Boolean(chatCampaign)}
        campaign={chatCampaign}
        token={token}
        currentUser={user}
        onUnlockRevision={handleUnlockCampaign}
        onOpenParticipation={handleOpenParticipationFromChat}
        onOpenUserProfile={(profileUser) => handleOpenUserProfile(profileUser, 'chat')}
        onDeliverCampaign={handleDeliverCampaign}
        onConfirmReceipt={handleConfirmCampaignReceipt}
        onRaiseDispute={handleRaiseCampaignDispute}
        onOpenReview={handleOpenReview}
        onCampaignStatusChange={handleCampaignStatusChange}
        externalStatusEvent={chatStatusEvent}
        isParticipantReviewCompleted={chatReviewState.isParticipantReviewed}
        isHostReviewCompleted={chatReviewState.isHostAllReviewed}
        onMarkRead={markChatRoomAsRead}
        onClose={() => setChatCampaign(null)}
      />

      <ParticipationActionModal
        key={participationCampaign ? `${participationCampaign.id}-${participationCampaign.initialHostView ?? 'overview'}` : 'participation-modal'}
        isOpen={Boolean(participationCampaign)}
        campaign={participationCampaign}
        quantityDraft={participationQuantityDraft}
        isSubmitting={isSubmittingParticipation}
        error={participationError}
        onChangeQuantity={setParticipationQuantityDraft}
        onClose={handleCloseParticipation}
        onSubmit={handleSubmitParticipation}
        onWithdraw={handleWithdrawParticipation}
        onCancelCampaign={handleCancelHostedCampaign}
        onUnlockRevision={handleUnlockCampaign}
        onKickParticipant={handleParticipantStatusAction}
        onOpenReview={handleOpenReview}
        reviewedReviewKeys={reviewedReviewKeys}
        onOpenChat={handleOpenChatFromParticipation}
        canOpenChat={canOpenCampaignChat(participationCampaign)}
        onOpenImageOrder={handleOpenImageOrderFromParticipation}
        canReorderImages={canReorderCampaignImages(participationCampaign, user)}
      />

      <ReviewModal
        isOpen={Boolean(reviewTarget)}
        token={token}
        reviewTarget={reviewTarget}
        onClose={handleCloseReview}
        onSubmitted={handleReviewSubmitted}
      />

      <main className="content">
        <div key={activeType} className={`page-transition page-transition-${pageTransitionDirection}`}>
        {activeType === 'REQUEST' ? (
          <section className="request-page-header">
            <p className="eyebrow">發起託購</p>
            <h2>Coming soon</h2>
          </section>
        ) : activeType === 'MINE' ? (
          <section className="mine-page-header">
            <p className="eyebrow">我的團購</p>
            <div className="type-switch-shell desktop-mine-type-switch">
              <section className="type-switch">
                <button type="button" className="mode-button active desktop-only-mode" onClick={() => switchActiveType('MINE')}>
                  我的
                </button>
                {TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={activeType === option.value ? 'mode-button active' : 'mode-button'}
                    onClick={() => switchActiveType(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </section>
            </div>
          </section>
        ) : (
          <div className="type-switch-shell">
            <section className="type-switch">
              <button
                type="button"
                className="mode-button desktop-only-mode"
                onClick={() => switchActiveType('MINE')}
              >
                我的
              </button>
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={activeType === option.value ? 'mode-button active' : 'mode-button'}
                  onClick={() => switchActiveType(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </section>
          </div>
        )}

        {activeType === 'REQUEST' ? (
          <section className="request-coming-soon">
            <p>託購頁面準備中</p>
            <span>之後會在這裡建立與管理託購需求。</span>
          </section>
        ) : activeType === 'MINE' ? (
          <div className="mine-filter-stack">
            <section className="category-strip">
              {localizedMyCampaignScopes.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={activeMyCampaignScope === option.value ? 'category-button active' : 'category-button'}
                  onClick={() => setActiveMyCampaignScope(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </section>
            <section className="mine-status-inline-filter">
              <span className="mine-status-filter-label">狀態</span>
              <div className="mine-status-filter-options">
                {localizedMyCampaignOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={activeMyCampaignFilter === option.value ? 'status-filter-button active' : 'status-filter-button'}
                    onClick={() => setActiveMyCampaignFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
            <label className="mine-status-filter">
              <span className="mine-status-filter-label">狀態</span>
              <select value={activeMyCampaignFilter} onChange={(event) => setActiveMyCampaignFilter(event.target.value)}>
                {localizedMyCampaignOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="market-filter-row">
            <label className="category-select">
            <span className="category-select-label">類別</span>
            <select value={activeCategory} onChange={(event) => setActiveCategory(Number(event.target.value))}>
              <option value={0}>{LABELS.all}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon ? `${category.icon} ${category.name}` : category.name}
                </option>
              ))}
            </select>
            </label>
            <label className="market-checkbox-filter">
              <input
                type="checkbox"
                checked={hideFullCampaigns}
                onChange={(event) => setHideFullCampaigns(event.target.checked)}
              />
              <span>隱藏已滿</span>
            </label>
            <label className="market-filter-hidden">
              <span className="category-select-label">狀態</span>
              <select value={activeMarketStatus} onChange={(event) => setActiveMarketStatus(event.target.value)}>
                {MARKET_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {activeType !== 'REQUEST' && (
          <>
            <section
              className={[
                'deal-grid',
                isCompactDealList ? 'compact-list-grid' : '',
                isMineCompactList ? 'mine-compact-grid' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {isReferenceLoading && <p className="state-message">{LABELS.referenceLoading}</p>}
              {referenceError && <p className="inline-error">{referenceError}</p>}
              {campaignError && <p className="inline-error">{campaignError}</p>}

              {!isInitialLoading && campaigns.length === 0 && !campaignError && (
                <p className="state-message empty-card">{LABELS.emptyDeals}</p>
              )}

              {campaigns.map((deal, index) => {
                const dealViewKey = getDealViewKey(deal, index);
                const isExpandedCompactDeal = isCompactDealList && expandedCompactDealId === dealViewKey;
                const isHighlighted = String(deal.id) === String(focusedCampaignId);

                if (isMineCompactList && !isExpandedCompactDeal) {
                  return (
                    <CompactMineDealRow
                      key={dealViewKey}
                      deal={deal}
                      index={index}
                      labels={uiLabels}
                      isHighlighted={isHighlighted}
                      onExpand={setExpandedCompactDealId}
                      onOpenGallery={handleOpenGallery}
                      onOpenUserProfile={(profileUser) => handleOpenUserProfile(profileUser, 'card')}
                    />
                  );
                }

                if (isCompactDealList && activeType !== 'MINE' && !isExpandedCompactDeal) {
                  return (
                    <CompactDealRow
                      key={dealViewKey}
                      deal={deal}
                      index={index}
                      labels={uiLabels}
                      countdownNow={countdownNow}
                      formatCountdown={formatCountdown}
                      formatDateTime={formatDateTime}
                      getScenarioLabel={getScenarioLabel}
                      getTypeClass={getTypeClass}
                      isHighlighted={isHighlighted}
                      onExpand={setExpandedCompactDealId}
                      onOpenGallery={handleOpenGallery}
                      onOpenUserProfile={(profileUser) => handleOpenUserProfile(profileUser, 'card')}
                    />
                  );
                }

                return (
                  <div key={dealViewKey} className={isCompactDealList ? 'mine-expanded-card' : undefined}>
                    {isCompactDealList && (
                      <div className="mine-expanded-card-actions">
                        <button type="button" className="text-button" onClick={() => setExpandedCompactDealId('')}>
                          收合
                        </button>
                      </div>
                    )}
                    <DealCard
                      labels={uiLabels}
                      deal={deal}
                      countdownNow={countdownNow}
                      formatCountdown={formatCountdown}
                      formatDateTime={formatDateTime}
                      getScenarioLabel={getScenarioLabel}
                      getTypeClass={getTypeClass}
                      onJoin={handleOpenJoinCampaign}
                      onOpenGallery={handleOpenGallery}
                      onOpenChat={activeType === 'MINE' ? handleOpenChat : undefined}
                      onOpenParticipation={activeType === 'MINE' ? handleOpenParticipation : undefined}
                      onOpenUserProfile={(profileUser) => handleOpenUserProfile(profileUser, 'card')}
                      showJoinAction={activeType !== 'MINE' && !isSameUserId(deal.host?.id, user?.id)}
                      isHighlighted={isHighlighted}
                    />
                  </div>
                );
              })}
            </section>
            {renderPageDots()}

            <div ref={sentinelRef} className="list-sentinel">
              {isInitialLoading || isLoadingMore ? LABELS.loadingMore : hasMore ? LABELS.loadingMore : LABELS.noMoreData}
            </div>
          </>
        )}
        </div>
      </main>

      {activeType !== 'REQUEST' && !isSearchExpanded && renderFloatingDealViewControl()}

      <footer className={isSearchExpanded ? 'bottom-bar search-expanded' : 'bottom-bar'}>
        <label
          className="search-box"
          onClick={() => {
            setIsSearchExpanded(true);
            window.setTimeout(() => searchInputRef.current?.focus(), 0);
          }}
        >
          <SearchIcon />
          <span className="search-box-label">搜尋</span>
          <input
            ref={searchInputRef}
            type="search"
            placeholder={LABELS.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onFocus={() => setIsSearchExpanded(true)}
            onBlur={() => {
              if (!search.trim()) {
                setIsSearchExpanded(false);
              }
            }}
          />
        </label>
        {activeType === 'REQUEST' ? (
          <>
            <button type="button" className="create-button" onClick={() => switchActiveType('SCHEDULED')}>
              團購
            </button>
            <button type="button" className="create-button request-button active" onClick={() => switchActiveType('REQUEST')}>
              建立託購
            </button>
          </>
        ) : (
          <>
            <button type="button" className="create-button request-button" onClick={() => switchActiveType('REQUEST')}>
              託購
            </button>
            <button
              type="button"
              className="create-button active"
              onClick={() => {
                switchActiveType('SCHEDULED');
                handleOpenCreateCampaign('SCHEDULED');
              }}
            >
              開團
            </button>
          </>
        )}
      </footer>
    </div>
  );
}

export default HomePage;
