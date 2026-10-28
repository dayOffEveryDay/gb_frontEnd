import { parseLocalDateTime, mapCampaign, getCampaignImageOrderName } from './homeUtils';
import { getMineCampaignBucket } from './components/campaign/campaignCardUtils';
import { fetchMyParticipation, AUTH_EXPIRED_MESSAGE } from './api';

const CHAT_ROOMS_LOAD_ERROR_MESSAGE = '部分聊天室資料異常，暫時無法完整載入。請稍後再試，或從通知／我的團購開啟聊天室。';

const CHAT_ROOM_UNAVAILABLE_MESSAGE = '這筆聊天室資料異常或已不存在，暫時無法開啟。';

const DEAL_VIEW_MODE_KEYS = {
  market: 'deal_view_mode_market',
  mine: 'deal_view_mode_mine',
  request: 'deal_view_mode_request',
  mobile: 'deal_view_mode_mobile',
};

const MARKET_HIDE_FULL_KEY = 'market_hide_full';

const NOTIFICATION_SOUND_ENABLED_KEY = 'notification_sound_enabled';

const CHAT_ROOM_PAGE_SIZE = 100;

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
    request: getStoredDealViewModePreference('request'),
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
    (left.profileImageUrl ?? '') === (right.profileImageUrl ?? '')
  );
}

function isViewableParticipantStatus(status) {
  return ['JOINED', 'CONFIRMED', 'DELIVERED', 'COMPLETED'].includes((status ?? '').toString().toUpperCase());
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
  const type = (notification.type ?? 'NOTICE').toString().toUpperCase();
  const typeLabelMap = {
    CAMPAIGN_FULL: '團購已滿團',
    CAMPAIGN_CANCELLED: '團購已取消',
    CAMPAIGN_DELIVERED: '已標記交付',
    CAMPAIGN_COMPLETED: '團購已完成',
    PURCHASE_QUOTED: '收到託購報價',
    PURCHASE_QUOTE_SELECTED: '託購報價已選定',
    PURCHASE_QUOTE_NOT_SELECTED: '託購報價未選定',
    PURCHASE_ACCEPTED: '託購已承接',
    PURCHASE_REQUEST_EXPIRED: '託購已到期',
    PURCHASE_QUOTE_EXPIRED: '託購報價已到期',
    PURCHASE_CHAT_MESSAGE: '託購聊天室訊息',
    PURCHASE_ORDER_STARTED: '託購已開始處理',
    PURCHASE_ITEM_UNAVAILABLE: '託購商品缺貨',
    PURCHASE_ORDER_CANCELLED: '託購訂單已取消',
    PURCHASE_ORDER_SHIPPED: '託購商品已寄出',
    PURCHASE_ORDER_DELIVERED: '託購已標記交貨',
    PURCHASE_ORDER_COMPLETED: '託購訂單已完成',
    PURCHASE_ORDER_AUTO_COMPLETED: '託購訂單已自動完成',
    PURCHASE_ABNORMAL_REPORTED: '託購異常已回報',
    PURCHASE_ABNORMAL_CLOSED: '託購異常已結案',
    PURCHASE_ABNORMAL_TIMEOUT: '託購異常逾時',
    PURCHASE_CONFIRMATION_TIMEOUT: '託購確認逾時',
    INQUIRY_NEW_ANSWER: '問題收到新回答',
    INQUIRY_EXPIRED_NO_ANSWER: '問題已到期',
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
  const purchaseChatRoomsSeen = new Set();

  return items.map(normalizeNotification).filter((notification) => {
    if (notification.type !== 'PURCHASE_CHAT_MESSAGE' || notification.referenceId == null) {
      return true;
    }

    const roomKey = String(notification.referenceId);
    if (purchaseChatRoomsSeen.has(roomKey)) {
      return false;
    }
    purchaseChatRoomsSeen.add(roomKey);
    return true;
  });
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

function getCampaignChatAccess(campaign) {
  return (campaign?.chatAccess ?? campaign?.chat_access ?? '').toString().trim().toUpperCase();
}

function canOpenCampaignChat(campaign) {
  return hasUsableCampaignId(campaign) && ['READ_WRITE', 'READ_ONLY'].includes(getCampaignChatAccess(campaign));
}

function getCampaignIdValue(campaign) {
  return campaign?.id ?? campaign?.campaignId;
}

function getNormalizedCampaignId(campaign) {
  const campaignId = getCampaignIdValue(campaign);

  if (campaignId == null) {
    return null;
  }

  const campaignIdText = String(campaignId).trim();
  if (!campaignIdText) {
    return null;
  }

  const normalizedCampaignId = Number(campaignIdText);
  return Number.isInteger(normalizedCampaignId) && normalizedCampaignId > 0 ? normalizedCampaignId : null;
}

function getCampaignDisplayName(campaign, fallbackCampaignId = null) {
  const itemName = (campaign?.itemName ?? campaign?.item_name ?? '').toString().trim();
  const campaignId = getNormalizedCampaignId(campaign) ?? fallbackCampaignId;
  const idLabel = campaignId != null ? `（團購編號 #${campaignId}）` : '';

  return itemName ? `「${itemName}」${idLabel}` : idLabel || '這筆團購';
}

function hasUsableCampaignId(campaign) {
  return getNormalizedCampaignId(campaign) != null;
}

function canDisplayMarketCampaign(campaign, campaignTypeFilter, hideFull = false) {
  if (campaignTypeFilter !== 'ALL' && campaign?.scenarioType !== campaignTypeFilter) {
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

function canListCampaignChatRoom(campaign) {
  return canOpenCampaignChat(campaign);
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
    .filter(hasUsableCampaignId)
    .sort((first, second) => getChatRoomSortTime(second) - getChatRoomSortTime(first));
}

async function attachCampaignChatAccess(campaigns, token) {
  return mapWithConcurrency(campaigns, 4, async (campaign) => {
    const campaignId = getNormalizedCampaignId(campaign);
    if (campaignId == null) {
      return { ...campaign, chatAccess: 'NONE' };
    }

    try {
      const participation = await fetchMyParticipation(campaignId, token);
      return { ...campaign, chatAccess: getCampaignChatAccess(participation) || 'NONE' };
    } catch (error) {
      if (error?.message === AUTH_EXPIRED_MESSAGE) {
        throw error;
      }
      return { ...campaign, chatAccess: 'NONE' };
    }
  });
}

function getNavigationTabValue(type) {
  return type === 'INSTANT' || type === 'SCHEDULED' ? 'CAMPAIGN' : type;
}

function normalizePurchaseChatRoom(room) {
  return {
    ...room,
    roomType: 'PURCHASE',
    id: room?.id,
    orderId: room?.orderId ?? room?.order_id,
    itemName: room?.itemName ?? room?.item_name ?? '託購聊天室',
    counterpartId: room?.counterpartId ?? room?.counterpart_id,
    counterpartName: room?.counterpartName ?? room?.counterpart_name ?? '',
    counterpartAvatarUrl: room?.counterpartAvatarUrl ?? room?.counterpart_avatar_url ?? '',
    orderStatus: (room?.orderStatus ?? room?.order_status ?? '').toString().toUpperCase(),
    readOnly: Boolean(room?.readOnly ?? room?.read_only),
    unreadCount: Number(room?.unreadCount ?? room?.unread_count ?? 0),
    lastMessage: room?.lastMessage ?? room?.last_message ?? null,
    updatedAt: room?.updatedAt ?? room?.updated_at ?? '',
  };
}

function getCombinedChatRoomSortTime(room) {
  const value =
    room?.roomType === 'PURCHASE'
      ? room?.lastMessage?.createdAt ?? room?.lastMessage?.created_at ?? room?.updatedAt
      : getCampaignEstablishedAtValue(room) || getCampaignChatExpiresAtValue(room) || getCampaignCompletedAtValue(room);
  const date = parseLocalDateTime(value);
  return date ? date.getTime() : 0;
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

function isPurchaseChatNotification(notification) {
  return notification?.type === 'PURCHASE_CHAT_MESSAGE' && notification?.referenceId != null;
}

function isPurchaseOrderNotification(notification) {
  const type = notification?.type;

  return (
    notification?.referenceId != null &&
    [
      'PURCHASE_QUOTE_SELECTED',
      'PURCHASE_ACCEPTED',
      'PURCHASE_ORDER_STARTED',
      'PURCHASE_ITEM_UNAVAILABLE',
      'PURCHASE_ORDER_CANCELLED',
      'PURCHASE_ORDER_SHIPPED',
      'PURCHASE_ORDER_DELIVERED',
      'PURCHASE_ORDER_COMPLETED',
      'PURCHASE_ORDER_AUTO_COMPLETED',
      'PURCHASE_ABNORMAL_REPORTED',
      'PURCHASE_ABNORMAL_CLOSED',
      'PURCHASE_ABNORMAL_TIMEOUT',
      'PURCHASE_CONFIRMATION_TIMEOUT',
    ].includes(type)
  );
}

function isInquiryNotification(notification) {
  return ['INQUIRY_NEW_ANSWER', 'INQUIRY_EXPIRED_NO_ANSWER'].includes(notification?.type) && notification.referenceId != null;
}

const PROFILE_RETURN_CONTEXT_KEY = 'profile_return_context';

export {
  CHAT_ROOMS_LOAD_ERROR_MESSAGE,
  CHAT_ROOM_UNAVAILABLE_MESSAGE,
  DEAL_VIEW_MODE_KEYS,
  MARKET_HIDE_FULL_KEY,
  NOTIFICATION_SOUND_ENABLED_KEY,
  CHAT_ROOM_PAGE_SIZE,
  CHAT_ROOM_LAST_READ_KEY_PREFIX,
  getChatRoomLastReadStorageKey,
  getStoredChatRoomLastReads,
  setStoredChatRoomLastReads,
  getChatMessageTimestampValue,
  getComparableTime,
  normalizeReadTimestamp,
  countUnreadChatMessages,
  mapWithConcurrency,
  getInitialMarketHideFullEnabled,
  getInitialNotificationSoundEnabled,
  getStoredDealViewModePreference,
  getInitialDealViewModePreferences,
  getAudioContextConstructor,
  getNotificationAudioContext,
  unlockNotificationAudio,
  playNotificationSound,
  areUsersEquivalent,
  isViewableParticipantStatus,
  canOpenReadonlyParticipationFromDeal,
  normalizeNotification,
  getLiveNotificationKey,
  normalizeHostParticipant,
  normalizeHostDashboard,
  normalizeNotificationList,
  getReviewKey,
  isReviewAlreadyCompleted,
  getCampaignListSignature,
  buildMineCampaigns,
  buildHostParticipationCampaign,
  getCampaignChatAccess,
  canOpenCampaignChat,
  getCampaignIdValue,
  getNormalizedCampaignId,
  getCampaignDisplayName,
  hasUsableCampaignId,
  canDisplayMarketCampaign,
  getCampaignStatusValue,
  getCampaignCompletedAtValue,
  getCampaignChatExpiresAtValue,
  getCampaignEstablishedAtValue,
  canListCampaignChatRoom,
  getChatRoomSortTime,
  buildOpenChatRooms,
  attachCampaignChatAccess,
  getNavigationTabValue,
  normalizePurchaseChatRoom,
  getCombinedChatRoomSortTime,
  isSameUserId,
  isCampaignHostForUser,
  areStringArraysEqual,
  reorderList,
  getCampaignImageOrderNames,
  canReorderCampaignImages,
  isFullCampaignNotification,
  isReviewCampaignNotification,
  isPurchaseChatNotification,
  isPurchaseOrderNotification,
  isInquiryNotification,
  PROFILE_RETURN_CONTEXT_KEY
};
