import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import {
  cancelCampaign,
  checkReviewStatus,
  confirmCampaignReceipt,
  clearStoredAuth,
  createCampaign,
  deliverCampaign,
  devLogin,
  fetchCampaigns,
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
  withdrawCampaign,
  updateCurrentUserProfile,
} from './api';
import { EXPIRE_PRESET_OPTIONS, LABELS, PAGE_SIZE, TYPE_OPTIONS } from './homeConfig';
import {
  formatCountdown,
  formatDateTime,
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
import NotificationsModal from './NotificationsModal';
import CreateCampaignModal from './CreateCampaignModal';
import CreateCampaignSuccessModal from './CreateCampaignSuccessModal';
import JoinCampaignModal from './JoinCampaignModal';
import DealCard from './DealCard';
import ImageGalleryModal from './ImageGalleryModal';
import CampaignChatModal from './CampaignChatModal';
import ParticipationActionModal from './ParticipationActionModal';
import ReviewModal from './ReviewModal';
import { SearchIcon } from './Icons';

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

function isSameUserId(firstUserId, secondUserId) {
  if (firstUserId == null || secondUserId == null) {
    return false;
  }

  return Number(firstUserId) === Number(secondUserId);
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
  const [notifications, setNotifications] = useState([]);
  const [readNotifications, setReadNotifications] = useState([]);
  const [notificationsError, setNotificationsError] = useState('');
  const [readNotificationsError, setReadNotificationsError] = useState('');
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [isReadNotificationsLoading, setIsReadNotificationsLoading] = useState(false);
  const [liveNotification, setLiveNotification] = useState(null);
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
    images: [],
    activeIndex: 0,
  });
  const [referenceRefreshKey, setReferenceRefreshKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [focusedCampaignId, setFocusedCampaignId] = useState('');
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
  const liveNotificationTimerRef = useRef(null);
  const lastHandledChatNotificationRef = useRef('');
  const pendingProfileReturnRef = useRef(null);
  const profileRestoreAppliedRef = useRef(false);
  const campaignsSignatureRef = useRef('[]');
  const wsUrl = useMemo(() => new URL('/ws', getBackendBaseUrl()).toString(), []);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem('theme_mode', themeMode);
  }, [themeMode]);

  useEffect(() => {
    campaignsSignatureRef.current = getCampaignListSignature(campaigns);
  }, [campaigns]);

  useEffect(() => {
    return () => {
      if (liveNotificationTimerRef.current) {
        window.clearTimeout(liveNotificationTimerRef.current);
      }
    };
  }, []);

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
      setStoredAuth({ token: event.data.token, user: nextUser });
      setToken(event.data.token);
      setUser(nextUser);
      setProfileDraft(nextUser ?? { displayName: '', hasCostcoMembership: false });
      setAuthLoading(false);
      setAuthError('');
      setIsLoginModalOpen(false);
      setIsProfileOpen(true);
      setIsNotificationsOpen(false);
      setIsCreateCampaignOpen(false);
    };

    window.addEventListener('message', handleLineLoginMessage);
    return () => window.removeEventListener('message', handleLineLoginMessage);
  }, []);

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setReadNotifications([]);
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
                  setLiveNotification(incomingNotification);

                  if (liveNotificationTimerRef.current) {
                    window.clearTimeout(liveNotificationTimerRef.current);
                  }

                  liveNotificationTimerRef.current = window.setTimeout(() => {
                    setLiveNotification(null);
                    liveNotificationTimerRef.current = null;
                  }, 5000);
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
  }, [token, wsUrl]);

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
          ? data.content.map(mapCampaign).filter((item) => item.scenarioType === activeType && item.availableQuantity > 0)
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
    [activeCategory, activeMyCampaignFilter, activeMyCampaignScope, activeStore, activeType, deferredSearch, token]
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
                  .filter((item) => item.scenarioType === activeType && item.availableQuantity > 0)
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
  }, [activeCategory, activeStore, activeType, campaigns.length, deferredSearch, hasMore, isInitialLoading, isLoadingMore, page]);

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

      setStoredAuth({ token: data.token, user: nextUser });
      setToken(data.token);
      setUser(nextUser);
      setProfileDraft(nextUser ?? { displayName: '', hasCostcoMembership: false });
      setIsLoginModalOpen(false);
      setIsProfileOpen(false);
      setIsNotificationsOpen(false);
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
    setIsCreateCampaignOpen(false);
  };

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
      gestureTarget.closest('.category-strip, .store-selector, .search-box')
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

        return activeType === 'MINE' ? nextCampaigns : nextCampaigns.filter((campaign) => campaign.availableQuantity > 0);
      });
      setSelectedDealToJoin(null);
      setPurchaseQuantity('1');
      setPurchaseError('');
      window.alert(`\u5df2\u52a0\u5165\u5718\u8cfc\uff0c\u8a8d\u8cfc ${normalizedQuantity} \u4ef6`);
    } catch (error) {
      setPurchaseError(error.message);
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  const handleOpenGallery = (deal, startIndex = 0) => {
    const images = Array.isArray(deal.imageUrls) && deal.imageUrls.length > 0 ? deal.imageUrls : [deal.image];
    setGalleryState({
      isOpen: true,
      title: deal.itemName,
      images,
      activeIndex: Math.min(Math.max(startIndex, 0), images.length - 1),
    });
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

  useEffect(() => {
    if (!liveNotification?.referenceId || !chatCampaign?.id) {
      return;
    }

    if (Number(liveNotification.referenceId) !== Number(chatCampaign.id)) {
      return;
    }

    const notificationKey =
      liveNotification.id ?? `${liveNotification.type}-${liveNotification.referenceId}-${liveNotification.createdAt}`;
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
    const nextStatus = statusByNotificationType[liveNotification.type];

    if (!nextStatus) {
      void refreshOpenChatCampaign(liveNotification.referenceId, liveNotification.content);
      return;
    }

    void handleCampaignStatusChange({
      campaignId: liveNotification.referenceId,
      status: nextStatus,
      message: liveNotification.content,
      source: 'notification',
    });
    void refreshOpenChatCampaign(liveNotification.referenceId);
  }, [chatCampaign?.id, handleCampaignStatusChange, liveNotification, refreshOpenChatCampaign]);

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
        unreadCount={notifications.length}
        onChangeStore={setActiveStore}
        onOpenProfile={openProfile}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onRefresh={refreshHome}
        isRefreshing={isRefreshing}
      />

      {liveNotification && (
        <button
          type="button"
          className="live-notification-toast"
          onClick={() => {
            setIsNotificationsOpen(true);
            setLiveNotification(null);
            if (liveNotificationTimerRef.current) {
              window.clearTimeout(liveNotificationTimerRef.current);
              liveNotificationTimerRef.current = null;
            }
          }}
        >
          <strong>{liveNotification.typeLabel}</strong>
          <span>{liveNotification.content}</span>
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

      <NotificationsModal
        labels={LABELS}
        isOpen={isNotificationsOpen}
        notifications={notifications}
        readNotifications={readNotifications}
        isLoading={isNotificationsLoading}
        isReadLoading={isReadNotificationsLoading}
        error={notificationsError}
        readError={readNotificationsError}
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
          </section>
        ) : (
          <div className="type-switch-shell">
            <section className="type-switch">
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
          <div className="category-scroll-area">
            <section className="category-strip">
              <button
                type="button"
                className={activeCategory === 0 ? 'category-button active' : 'category-button'}
                onClick={() => setActiveCategory(0)}
              >
                {LABELS.all}
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={activeCategory === category.id ? 'category-button active' : 'category-button'}
                  onClick={() => setActiveCategory(category.id)}
                >
                  {category.icon ? `${category.icon} ${category.name}` : category.name}
                </button>
              ))}
            </section>
          </div>
        )}

        {activeType !== 'REQUEST' && (
          <>
            <section className="deal-grid">
              {isReferenceLoading && <p className="state-message">{LABELS.referenceLoading}</p>}
              {referenceError && <p className="inline-error">{referenceError}</p>}
              {campaignError && <p className="inline-error">{campaignError}</p>}

              {!isInitialLoading && campaigns.length === 0 && !campaignError && (
                <p className="state-message empty-card">{LABELS.emptyDeals}</p>
              )}

              {campaigns.map((deal) => (
                <DealCard
                  key={deal.id}
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
                  isHighlighted={String(deal.id) === String(focusedCampaignId)}
                />
              ))}
            </section>
            {renderPageDots()}

            <div ref={sentinelRef} className="list-sentinel">
              {isInitialLoading || isLoadingMore ? LABELS.loadingMore : hasMore ? LABELS.loadingMore : LABELS.noMoreData}
            </div>
          </>
        )}
        </div>
      </main>

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
