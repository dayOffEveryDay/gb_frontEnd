import usePageScroll from './layouts/usePageScroll';
import { mainPath } from './layouts/mainRoutes';
import useReferenceData from './layouts/useReferenceData';
import useCampaignGallery from './pages/mine/useCampaignGallery';
import useMainNavigation from './layouts/useMainNavigation';
import useMainLayoutState from './layouts/useMainLayoutState';
import useCampaignsFeed from './pages/campaigns/useCampaignsFeed';
import useMineCampaigns from './pages/mine/useMineCampaigns';
import useParticipationActions from './pages/mine/useParticipationActions';
import useCampaignActions from './pages/campaigns/useCampaignActions';
import useInquiriesPage from './pages/inquiries/useInquiriesPage';
import useRequestsPage from './pages/requests/useRequestsPage';
import useMinePageState from './pages/mine/useMinePageState';
import useCampaignsPageState from './pages/campaigns/useCampaignsPageState';
import {
  CHAT_ROOMS_LOAD_ERROR_MESSAGE,
  CHAT_ROOM_UNAVAILABLE_MESSAGE,
  NOTIFICATION_SOUND_ENABLED_KEY,
  CHAT_ROOM_PAGE_SIZE,
  getStoredChatRoomLastReads,
  setStoredChatRoomLastReads,
  normalizeReadTimestamp,
  countUnreadChatMessages,
  mapWithConcurrency,
  getInitialNotificationSoundEnabled,
  unlockNotificationAudio,
  playNotificationSound,
  areUsersEquivalent,
  normalizeNotification,
  getLiveNotificationKey,
  normalizeNotificationList,
  buildHostParticipationCampaign,
  getCampaignChatAccess,
  canOpenCampaignChat,
  getNormalizedCampaignId,
  getCampaignDisplayName,
  hasUsableCampaignId,
  canListCampaignChatRoom,
  buildOpenChatRooms,
  normalizePurchaseChatRoom,
  getCombinedChatRoomSortTime,
  isSameUserId,
  canReorderCampaignImages,
  isFullCampaignNotification,
  isReviewCampaignNotification,
  isPurchaseChatNotification,
  isPurchaseOrderNotification,
  isInquiryNotification,
  PROFILE_RETURN_CONTEXT_KEY,
} from './homeHelpers';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import MainLayout from './layouts/MainLayout';
import {
  AUTH_EXPIRED_MESSAGE,
  AUTH_STORAGE_EVENT,
  clearStoredAuth,
  devLogin,
  fetchCampaignChatMessages,
  fetchHostDashboard,
  fetchMyHostedCampaigns,
  fetchMyJoinedCampaigns,
  fetchMyParticipation,
  fetchPurchaseChatRooms,
  fetchPurchaseChatUnreadCount,
  fetchReadNotifications,
  fetchUnreadNotifications,
  getFrontendBaseUrl,
  getBackendBaseUrl,
  isDevLoginEnabled,
  getStoredToken,
  getStoredUser,
  LINE_LOGIN_SUCCESS_MESSAGE,
  markNotificationRead,
  markPurchaseChatRoomRead,
  openLineLoginPopup,
  setStoredAuth,
  updateCurrentUserProfile,
} from './api';
import { hasCompletedOnboarding } from './onboardingUtils';
import { LABELS, TYPE_OPTIONS } from './homeConfig';
import { formatDateTime, getScenarioLabel, mapCampaign, normalizeUser } from './homeUtils';

import LoginModal from './components/account/LoginModal';
import ProfileModal from './components/account/ProfileModal';
import ChatRoomsModal from './components/chat/ChatRoomsModal';
import NotificationsModal from './components/feedback/NotificationsModal';
import CreateCampaignModal from './components/campaign/CreateCampaignModal';
import CreateCampaignSuccessModal from './components/campaign/CreateCampaignSuccessModal';
import JoinCampaignModal from './components/campaign/JoinCampaignModal';

import ImageGalleryModal from './components/media/ImageGalleryModal';
import CampaignChatModal from './components/chat/CampaignChatModal';
import PurchaseChatModal from './components/chat/PurchaseChatModal';
import PurchaseOrderModal from './components/purchase/PurchaseOrderModal';
import ParticipationActionModal from './components/campaign/ParticipationActionModal';
import ReviewModal from './components/campaign/ReviewModal';

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    swipeTabs,
    activeType,
    setActiveType,
    activeStoreIds,
    setActiveStoreIds,
    search,
    setSearch,
    deferredSearch,
    dealViewModePreferences,
    setDealViewModePreferences,
    expandedCompactDealId,
    setExpandedCompactDealId,
    isDealViewControlVisible,
    isDesktopViewport,
    pageTransitionDirection,
    isSearchExpanded,
    setIsSearchExpanded,
    isNavigationOpen,
    setIsNavigationOpen,
    mobileSearchScope,
    setMobileSearchScope,
    isRefreshing,
    setIsRefreshing,
    pullDistance,
    setPullDistance,
    themeMode,
    setThemeMode,
    pullStartYRef,
    swipeStartXRef,
    canPullRef,
    gestureLockRef,
    searchInputRef,
    mobileSearchInputRef,
    navigationRef,
    searchReturnContextRef
  } = useMainLayoutState();
  const {
    campaignTypeOptions,
    localizedExpirePresetOptions,
    activeCampaignType,
    setActiveCampaignType,
    activeCategory,
    setActiveCategory,
    hideFullCampaigns,
    setHideFullCampaigns,
    activeMarketStatus,
    setActiveMarketStatus,
    isCreateCampaignOpen,
    setIsCreateCampaignOpen,
    campaignForm,
    setCampaignForm,
    isCreatingCampaign,
    setIsCreatingCampaign,
    createCampaignError,
    setCreateCampaignError,
    createdCampaignSummary,
    setCreatedCampaignSummary,
    selectedDealToJoin,
    setSelectedDealToJoin,
    purchaseQuantity,
    setPurchaseQuantity,
    purchaseError,
    setPurchaseError,
    isSubmittingPurchase,
    setIsSubmittingPurchase,
    createSummaryTimerRef
  } = useCampaignsPageState();
  const {
    localizedMyCampaignScopes,
    localizedMineDomains,
    localizedMyCampaignOptions,
    activeMineDomain,
    setActiveMineDomain,
    activeMyCampaignScope,
    setActiveMyCampaignScope,
    activeMyCampaignFilter,
    setActiveMyCampaignFilter,
    participationCampaign,
    setParticipationCampaign,
    participationQuantityDraft,
    setParticipationQuantityDraft,
    participationError,
    setParticipationError,
    isSubmittingParticipation,
    setIsSubmittingParticipation,
    reviewTarget,
    setReviewTarget,
    reviewedReviewKeys,
    setReviewedReviewKeys,
    chatReviewState,
    setChatReviewState,
    focusedCampaignId,
    setFocusedCampaignId
  } = useMinePageState();

  const uiLabels = {
    ...LABELS,
    joinCampaign: '\u52a0\u5165\u5718\u8cfc',
    purchaseQuantity: '\u8a8d\u8cfc\u6578\u91cf',
    confirmJoinCampaign: '\u78ba\u8a8d\u52a0\u5165',
    submittingJoinCampaign: '\u9001\u51fa\u4e2d...',
    soldOut: '\u5df2\u984d\u6eff',
    totalQuantityLabel: '\u7e3d\u6578\u91cf',
  };

  const {
    stores,
    categories,
    referenceError,
    isReferenceLoading
  } = useReferenceData();

  const {
    inquiryTargetId,
    setInquiryTargetId,
    isInquiryDetailOpen,
    setIsInquiryDetailOpen
  } = useInquiriesPage();

  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState(() => normalizeUser(getStoredUser()));
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isChatRoomsOpen, setIsChatRoomsOpen] = useState(false);
  const [chatRooms, setChatRooms] = useState([]);
  const [purchaseChatUnreadTotal, setPurchaseChatUnreadTotal] = useState(0);
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

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [profileDraft, setProfileDraft] = useState(
    normalizeUser(getStoredUser()) ?? {
      displayName: '',
    }
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const {
    requestRewardMethod,
    setRequestRewardMethod,
    requestDeliveryMethod,
    setRequestDeliveryMethod,
    requestCompletionTimeMode,
    setRequestCompletionTimeMode,
    requestDeadlineMode,
    setRequestDeadlineMode,
    requestDraftMessage,
    isProxyRequestFormOpen,
    setIsProxyRequestFormOpen,
    isProxyRequestModalOpen,
    setIsProxyRequestModalOpen,
    handleSubmitProxyPurchaseRequest
  } = useRequestsPage();

  const [chatCampaign, setChatCampaign] = useState(null);
  const [purchaseChatRoom, setPurchaseChatRoom] = useState(null);
  const [purchaseOrderFromChat, setPurchaseOrderFromChat] = useState(null);
  const chatReturnContextRef = useRef(null);
  const [chatStatusEvent, setChatStatusEvent] = useState(null);

  useEffect(() => {
    const syncAuthState = (event) => {
      const nextToken = getStoredToken();
      const nextUser = normalizeUser(getStoredUser());

      setToken((current) => (current === nextToken ? current : nextToken));
      setUser((current) => (areUsersEquivalent(current, nextUser) ? current : nextUser));

      if (event?.detail?.reason === 'expired') {
        setAuthError(AUTH_EXPIRED_MESSAGE);
        setIsLoginModalOpen(true);
        setIsProfileOpen(false);
        setIsNotificationsOpen(false);
        setIsChatRoomsOpen(false);
        setChatCampaign(null);
        setPurchaseChatRoom(null);
        setChatRooms([]);
        setPurchaseChatUnreadTotal(0);
        setChatRoomsError('');
        setNotifications([]);
        setReadNotifications([]);
      }
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

  const isChatFocusMode = isChatRoomsOpen || Boolean(chatCampaign) || Boolean(purchaseChatRoom);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());

  const notificationClientRef = useRef(null);
  const chatCampaignRef = useRef(null);
  const purchaseChatRoomRef = useRef(null);
  const liveNotificationTimersRef = useRef(new Map());
  const successToastTimerRef = useRef(null);

  const notificationAudioContextRef = useRef(null);
  const notificationSoundEnabledRef = useRef(isNotificationSoundEnabled);
  const lastHandledChatNotificationRef = useRef('');
  const pendingProfileReturnRef = useRef(null);
  const profileRestoreAppliedRef = useRef(false);

  const chatRoomsRef = useRef(chatRooms);

  const marketFeed = useCampaignsFeed({
    enabled: !['MINE', 'REQUEST', 'INQUIRY'].includes(activeType),
    activeStoreIds, activeCategory, activeCampaignType, hideFullCampaigns, deferredSearch, refreshKey,
  });
  const mineFeed = useMineCampaigns({
    enabled: activeType === 'MINE' && activeMineDomain === 'CAMPAIGN',
    token, activeMyCampaignScope, activeMyCampaignFilter, refreshKey, focusedCampaignId, setFocusedCampaignId,
  });
  const activeFeed = activeType === 'MINE' ? mineFeed : marketFeed;
  const { campaigns, campaignError, setCampaignError, hasMore, isInitialLoading, isLoadingMore, sentinelRef } = activeFeed;
  usePageScroll(isInitialLoading || isReferenceLoading, Boolean(focusedCampaignId || inquiryTargetId));
  const { refreshMineCampaignsBeforeOpen } = mineFeed;
  const { setCampaigns: setMarketCampaigns } = marketFeed;
  const { setCampaigns: setMineCampaigns } = mineFeed;
  const setCampaigns = useCallback(update => {
    setMarketCampaigns(update);
    setMineCampaigns(update);
  }, [setMarketCampaigns, setMineCampaigns]);

  useEffect(() => {
    if (isChatFocusMode) {
      setIsNavigationOpen(false);
    }
  }, [isChatFocusMode, setIsNavigationOpen]);

  const wsUrl = useMemo(() => new URL('/ws', getBackendBaseUrl()).toString(), []);
  const chatUnreadRoomCount = useMemo(
    () =>
      purchaseChatUnreadTotal +
      chatRooms.reduce(
        (count, room) =>
          count + (room?.roomType !== 'PURCHASE' && Number(room?.unreadMessageCount ?? 0) > 0 ? 1 : 0),
        0
      ),
    [chatRooms, purchaseChatUnreadTotal]
  );

  useEffect(() => {
    chatRoomsRef.current = chatRooms;
  }, [chatRooms]);

  useEffect(() => {
    chatCampaignRef.current = chatCampaign;
  }, [chatCampaign]);

  useEffect(() => {
    purchaseChatRoomRef.current = purchaseChatRoom;
  }, [purchaseChatRoom]);

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
    if (user?.id && !hasCompletedOnboarding(user.id)) {
      navigate('/onboarding/setup', { replace: true });
    }
  }, [navigate, user?.id]);

  useEffect(() => {
    notificationSoundEnabledRef.current = isNotificationSoundEnabled;
  }, [isNotificationSoundEnabled]);

  useEffect(() => {
    const notificationTimers = liveNotificationTimersRef.current;
    return () => {
      notificationTimers.forEach((timerId) => window.clearTimeout(timerId));
      notificationTimers.clear();
      if (successToastTimerRef.current) {
        window.clearTimeout(successToastTimerRef.current);
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
      if (location.state?.focusCampaignId || location.state?.focusPurchaseRequestId
        || (context.path ?? mainPath(context.ui?.activeType)) !== location.pathname) {
        sessionStorage.removeItem(PROFILE_RETURN_CONTEXT_KEY);
        return;
      }
      pendingProfileReturnRef.current = context;
      sessionStorage.removeItem(PROFILE_RETURN_CONTEXT_KEY);

      if (context?.ui) {
        if (context.ui.activeCampaignType) {
          setActiveCampaignType(context.ui.activeCampaignType);
        }
        if (typeof context.ui.activeCategory === 'number') {
          setActiveCategory(context.ui.activeCategory);
        }
        if (typeof context.ui.hideFullCampaigns === 'boolean') {
          setHideFullCampaigns(context.ui.hideFullCampaigns);
        }
        if (Array.isArray(context.ui.activeStoreIds)) {
          setActiveStoreIds(context.ui.activeStoreIds.map((id) => Number(id)).filter(Boolean));
        } else if (typeof context.ui.activeStore === 'number' && context.ui.activeStore) {
          setActiveStoreIds([context.ui.activeStore]);
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
  }, [setActiveCampaignType, setActiveCategory, setActiveMyCampaignFilter, setActiveMyCampaignScope, setActiveStoreIds, setHideFullCampaigns, setSearch, location.pathname, location.state]);

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
    const timerId = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [referenceRefreshKey]);

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
      setProfileDraft(nextUser ?? { displayName: '' });
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
  }, [setIsCreateCampaignOpen]);

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
                const activePurchaseOrderId = purchaseChatRoomRef.current?.orderId;
                const isActivePurchaseChatMessage =
                  incomingNotification.type === 'PURCHASE_CHAT_MESSAGE' &&
                  activePurchaseOrderId != null &&
                  String(incomingNotification.referenceId) === String(activePurchaseOrderId);

                if (!disposed) {
                  if (!isActivePurchaseChatMessage && notificationSoundEnabledRef.current) {
                    void playNotificationSound(notificationAudioContextRef);
                  }

                  if (!isActivePurchaseChatMessage) {
                    pushLiveNotification(incomingNotification);
                  }
                }

                fetchUnreadNotifications(token)
                  .then((data) => {
                    if (!disposed) {
                      const nextNotifications = normalizeNotificationList(data);
                      const activeChatNotificationIds = nextNotifications
                        .filter(
                          (notification) =>
                            notification.type === 'PURCHASE_CHAT_MESSAGE' &&
                            activePurchaseOrderId != null &&
                            String(notification.referenceId) === String(activePurchaseOrderId) &&
                            notification.id != null
                        )
                        .map((notification) => notification.id);
                      setNotifications(
                        nextNotifications.filter((notification) => !activeChatNotificationIds.includes(notification.id))
                      );
                      if (activeChatNotificationIds.length > 0) {
                        void Promise.all(activeChatNotificationIds.map((notificationId) => markNotificationRead(notificationId, token))).catch(() => {});
                      }
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

            client.subscribe('/user/queue/chat-access', (frame) => {
              try {
                const payload = JSON.parse(frame.body);
                if (payload?.type !== 'CHAT_ACCESS_REVOKED' || payload?.campaignId == null || disposed) {
                  return;
                }

                const revokedCampaignId = String(payload.campaignId);
                setChatRooms((current) =>
                  current.filter(
                    (room) =>
                      room?.roomType === 'PURCHASE' || String(getNormalizedCampaignId(room)) !== revokedCampaignId
                  )
                );
                setParticipationCampaign((current) =>
                  current && String(getNormalizedCampaignId(current)) === revokedCampaignId
                    ? { ...current, chatAccess: 'NONE' }
                    : current
                );

                if (String(getNormalizedCampaignId(chatCampaignRef.current)) === revokedCampaignId) {
                  chatReturnContextRef.current = null;
                  setChatCampaign(null);
                  setSuccessToast({
                    title: '聊天室權限已移除',
                    message: '你已退出或被移出這個團購，聊天室已關閉。',
                  });
                  if (successToastTimerRef.current) {
                    window.clearTimeout(successToastTimerRef.current);
                  }
                  successToastTimerRef.current = window.setTimeout(() => {
                    setSuccessToast(null);
                    successToastTimerRef.current = null;
                  }, 3600);
                }

                setRefreshKey((current) => current + 1);
              } catch {
                setNotificationsError('聊天室權限事件解析失敗');
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
  }, [pushLiveNotification, setParticipationCampaign, token, wsUrl]);

  useEffect(() => {
    if (!isRefreshing) {
      return;
    }

    if (!isReferenceLoading && !isInitialLoading && !isLoadingMore) {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, isReferenceLoading, isInitialLoading, isLoadingMore, setIsRefreshing, setPullDistance]);

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
    if (!isDevLoginEnabled) {
      setAuthError('開發者登入在此環境未啟用。');
      return;
    }

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
      setProfileDraft(nextUser ?? { displayName: '' });
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
    setProfileDraft({ displayName: '' });
    setIsProfileOpen(false);
    setIsNotificationsOpen(false);
    setIsChatRoomsOpen(false);
    setChatRooms([]);
    setPurchaseChatUnreadTotal(0);
    setChatRoomsError('');
    setPurchaseChatRoom(null);
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
          room?.roomType !== 'PURCHASE' && Number(room?.id ?? room?.campaignId) === Number(campaignId)
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

  const markPurchaseRoomAsRead = useCallback((roomId) => {
    const room = chatRoomsRef.current.find(
      (item) => item?.roomType === 'PURCHASE' && String(item.id) === String(roomId)
    );
    const readCount = Number(room?.unreadCount ?? room?.unreadMessageCount ?? 0);
    if (readCount > 0) {
      setPurchaseChatUnreadTotal((current) => Math.max(0, current - readCount));
    }
    setChatRooms((current) =>
      current.map((room) =>
        room?.roomType === 'PURCHASE' && String(room.id) === String(roomId)
          ? { ...room, unreadCount: 0, unreadMessageCount: 0 }
          : room
      )
    );
  }, []);

  const hidePurchaseChatNotifications = useCallback((orderId) => {
    if (orderId == null) return;
    setNotifications((current) =>
      current.filter(
        (notification) =>
          notification.type !== 'PURCHASE_CHAT_MESSAGE' ||
          String(notification.referenceId) !== String(orderId)
      )
    );
  }, []);

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
      setPurchaseChatUnreadTotal(0);
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
      const [hostedResult, joinedResult, purchaseResult, purchaseUnreadResult] = await Promise.allSettled([
        fetchMyHostedCampaigns(query, token),
        fetchMyJoinedCampaigns(query, token),
        fetchPurchaseChatRooms(token),
        fetchPurchaseChatUnreadCount(token),
      ]);
      const hostedData = hostedResult.status === 'fulfilled' ? hostedResult.value : [];
      const joinedData = joinedResult.status === 'fulfilled' ? joinedResult.value : [];
      const purchaseData = purchaseResult.status === 'fulfilled' ? purchaseResult.value : [];
      const purchaseUnreadData = purchaseUnreadResult.status === 'fulfilled' ? purchaseUnreadResult.value : null;
      const hasAuthExpired = [hostedResult, joinedResult, purchaseResult, purchaseUnreadResult].some(
        (result) => result.status === 'rejected' && result.reason?.message === AUTH_EXPIRED_MESSAGE
      );
      const hasSourceError =
        hostedResult.status === 'rejected' ||
        joinedResult.status === 'rejected' ||
        purchaseResult.status === 'rejected' ||
        purchaseUnreadResult.status === 'rejected';

      if (hasAuthExpired) {
        setChatRooms([]);
        setChatRoomsError(AUTH_EXPIRED_MESSAGE);
        setAuthError(AUTH_EXPIRED_MESSAGE);
        setIsLoginModalOpen(true);
        return;
      }

      const roomCandidates = buildOpenChatRooms(hostedData, joinedData);
      const accessResults = await mapWithConcurrency(roomCandidates, 4, async (room) => {
        const roomId = getNormalizedCampaignId(room);

        if (roomId == null) {
          return null;
        }

        try {
          const participation = await fetchMyParticipation(roomId, token);
          return {
            ...room,
            chatAccess: getCampaignChatAccess(participation),
          };
        } catch (error) {
          if (error?.message === AUTH_EXPIRED_MESSAGE) {
            throw error;
          }
          return null;
        }
      });
      const openRooms = accessResults.filter(Boolean).filter(canListCampaignChatRoom);
      const roomsWithUnreadCounts = await mapWithConcurrency(openRooms, 4, async (room) => {
        const roomId = getNormalizedCampaignId(room);

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

      const campaignRooms = roomsWithUnreadCounts.map((room) => ({ ...room, roomType: 'CAMPAIGN' }));
      const purchaseRooms = (Array.isArray(purchaseData) ? purchaseData : []).map(normalizePurchaseChatRoom);
      setPurchaseChatUnreadTotal(
        Number(
          purchaseUnreadData?.unreadCount ??
            purchaseRooms.reduce((count, room) => count + Number(room.unreadCount ?? 0), 0)
        ) || 0
      );
      setChatRooms(
        [...purchaseRooms, ...campaignRooms].sort(
          (first, second) => getCombinedChatRoomSortTime(second) - getCombinedChatRoomSortTime(first)
        )
      );
      if (!silent && hasSourceError) {
        setChatRoomsError(CHAT_ROOMS_LOAD_ERROR_MESSAGE);
      }
    } catch (error) {
      if (error?.message === AUTH_EXPIRED_MESSAGE) {
        setChatRooms([]);
        setChatRoomsError(AUTH_EXPIRED_MESSAGE);
        setAuthError(AUTH_EXPIRED_MESSAGE);
        setIsLoginModalOpen(true);
      } else if (!silent) {
        setChatRoomsError(CHAT_ROOMS_LOAD_ERROR_MESSAGE);
      }
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
    setChatRoomsError('');

    if (room?.roomType === 'PURCHASE') {
      try {
        await markPurchaseChatRoomRead(room.id, token);
        markPurchaseRoomAsRead(room.id);
        hidePurchaseChatNotifications(room.orderId);
        chatReturnContextRef.current = { type: 'CHAT_ROOMS' };
        setPurchaseChatRoom(room);
        setIsChatRoomsOpen(false);
      } catch (error) {
        setChatRoomsError(error instanceof Error ? error.message : '託購聊天室開啟失敗');
      }
      return;
    }

    const opened = await handleOpenChat(room, {
      showError: false,
      returnContext: { type: 'CHAT_ROOMS' },
    });
    if (opened) {
      setIsChatRoomsOpen(false);
      return;
    }

    setChatRoomsError(CHAT_ROOM_UNAVAILABLE_MESSAGE);
  };

  const handleOpenPurchaseChat = async (source, { returnContext = null } = {}) => {
    if (!token) {
      setIsLoginModalOpen(true);
      return false;
    }

    const sourceRoomId = source?.roomType === 'PURCHASE' ? source?.id : source?.chatRoomId;
    const sourceOrderId = source?.orderId;
    if (sourceRoomId == null && sourceOrderId == null) {
      showSuccessToast('聊天室尚未建立', '訂單成立後才會建立託購聊天室。');
      return false;
    }

    try {
      let matchedRoom = chatRooms.find(
        (room) =>
          room?.roomType === 'PURCHASE' &&
          ((sourceRoomId != null && String(room.id) === String(sourceRoomId)) ||
            (sourceOrderId != null && String(room.orderId) === String(sourceOrderId)))
      );

      if (!matchedRoom) {
        const rooms = await fetchPurchaseChatRooms(token);
        const normalizedRooms = (Array.isArray(rooms) ? rooms : []).map(normalizePurchaseChatRoom);
        matchedRoom = normalizedRooms.find(
          (room) =>
            (sourceRoomId != null && String(room.id) === String(sourceRoomId)) ||
            (sourceOrderId != null && String(room.orderId) === String(sourceOrderId))
        );
      }

      const fallbackRoom = {
        ...source,
        roomType: 'PURCHASE',
        id: sourceRoomId,
        orderId: sourceOrderId,
        itemName: source?.itemName ?? source?.productName,
        counterpartName:
          source?.counterpartName ??
          (String(source?.requester?.id ?? source?.requesterId) === String(user?.id)
            ? source?.runner?.displayName ?? source?.runnerDisplayName
            : source?.requester?.displayName ?? source?.requesterDisplayName),
      };
      const nextRoom = matchedRoom ?? fallbackRoom;
      if (nextRoom.id == null) {
        showSuccessToast('聊天室開啟失敗', '找不到這筆託購聊天室資料。');
        return false;
      }

      await markPurchaseChatRoomRead(nextRoom.id, token);
      markPurchaseRoomAsRead(nextRoom.id);
      hidePurchaseChatNotifications(nextRoom.orderId);
      chatReturnContextRef.current = returnContext;
      setPurchaseChatRoom(nextRoom);
      return true;
    } catch (error) {
      showSuccessToast('聊天室開啟失敗', error instanceof Error ? error.message : '請稍後再試。');
      return false;
    }
  };

  const handleNotificationAction = async (notification, { returnToNotifications = false } = {}) => {
    if (!token || !notification) {
      return;
    }

    const isCampaignOrderNotification = isFullCampaignNotification(notification);
    const isReviewNotification = isReviewCampaignNotification(notification);
    const isPurchaseChat = isPurchaseChatNotification(notification);
    const isPurchaseNotification = isPurchaseOrderNotification(notification);
    const isInquiry = isInquiryNotification(notification);

    if (!isCampaignOrderNotification && !isReviewNotification && !isPurchaseChat && !isPurchaseNotification && !isInquiry) {
      await markNotificationAsRead(notification.id, notification);
      return;
    }

    await markNotificationAsRead(notification.id, notification);

    if (isInquiry) {
      setIsNotificationsOpen(false);
      setInquiryTargetId(notification.referenceId);
      switchActiveType('INQUIRY');
      return;
    }

    if (isPurchaseChat) {
      const opened = await handleOpenPurchaseChat(
        { orderId: notification.referenceId },
        { returnContext: returnToNotifications ? { type: 'NOTIFICATIONS' } : null }
      );
      if (opened && returnToNotifications) {
        setIsNotificationsOpen(false);
      }
      return;
    }

    if (isPurchaseNotification) {
      if (returnToNotifications) setIsNotificationsOpen(false);
      setPurchaseOrderFromChat({
        id: notification.referenceId,
        orderId: notification.referenceId,
        openedFromNotification: true,
        returnToNotifications,
      });
      return;
    }

    try {
      const targetCampaign = await findCampaignForNotification(notification.referenceId);

      if (!targetCampaign) {
        setNotificationsError(`${getCampaignDisplayName(null, notification.referenceId)}已找不到，無法開啟詳情。`);
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

      if (isCampaignOrderNotification) {
        if (returnToNotifications) setIsNotificationsOpen(false);
        await handleOpenParticipation(targetCampaign);
        return;
      }

      if (!canOpenCampaignChat(targetCampaign)) {
        setNotificationsError(`${getCampaignDisplayName(targetCampaign, notification.referenceId)}目前無法開啟聊天室。`);
        return;
      }

      await markCampaignChatNotificationsAsRead(targetCampaign.id);
      chatReturnContextRef.current = returnToNotifications ? { type: 'NOTIFICATIONS' } : null;
      if (returnToNotifications) {
        setIsNotificationsOpen(false);
      }
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

  const refreshHome = useCallback(() => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setReferenceRefreshKey((current) => current + 1);
    setRefreshKey((current) => current + 1);
  }, [isRefreshing, setIsRefreshing]);

  const {
    switchActiveType,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    dealViewMode,
    isCompactDealList,
    isMineCompactList,
    handleChangeDealViewMode,
    focusMobileSearch,
    handleOpenMobileSearch,
    handleChangeMobileSearchScope,
    handleCloseMobileSearch
  } = useMainNavigation({
    setIsNavigationOpen,
    setActiveType,
    setActiveCampaignType,
    setIsProxyRequestFormOpen,
    swipeTabs,
    isNavigationOpen,
    navigationRef,
    swipeStartXRef,
    pullStartYRef,
    gestureLockRef,
    canPullRef,
    isRefreshing,
    setPullDistance,
    pullDistance,
    refreshHome,
    activeType,
    isDesktopViewport,
    activeMyCampaignScope,
    dealViewModePreferences,
    setDealViewModePreferences,
    setExpandedCompactDealId,
    mobileSearchInputRef,
    searchReturnContextRef,
    activeCampaignType,
    setMobileSearchScope,
    setIsSearchExpanded,
    setSearch,
  });

  useEffect(() => {
    const state = location.state;
    if (!state?.activeType && !state?.focusCampaignId) return;
    const { activeType: requestedType, focusCampaignId, ...remainingState } = state;
    const target = focusCampaignId ? '/mine' : mainPath(requestedType);
    if (focusCampaignId) {
      setFocusedCampaignId(String(focusCampaignId));
      setActiveMineDomain('CAMPAIGN');
      setActiveMyCampaignScope('ALL');
      setActiveMyCampaignFilter('ALL');
    }
    navigate({ pathname: target, search: location.search, hash: location.hash }, {
      replace: true, state: remainingState,
    });
  }, [location, navigate, setActiveMineDomain, setActiveMyCampaignFilter, setActiveMyCampaignScope, setFocusedCampaignId]);

  const handleLiveNotificationAction = async (notification) => {
    if (!notification) {
      return;
    }

    dismissLiveNotification(notification.toastKey ?? getLiveNotificationKey(notification));

    if (
      isFullCampaignNotification(notification) ||
      isReviewCampaignNotification(notification) ||
      isPurchaseChatNotification(notification) ||
      isPurchaseOrderNotification(notification) ||
      isInquiryNotification(notification)
    ) {
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

  const {
    handleOpenCreateCampaignForCurrentType,
    handleSubmitCreateCampaign,
    handleOpenJoinCampaign,
    handleCloseJoinCampaign,
    handleSubmitJoinCampaign
  } = useCampaignActions({
    createdCampaignSummary,
    createSummaryTimerRef,
    setCreatedCampaignSummary,
    setCampaignForm,
    campaignForm,
    token,
    setIsLoginModalOpen,
    setCreateCampaignError,
    stores,
    categories,
    setIsCreateCampaignOpen,
    activeCampaignType,
    showSuccessToast,
    setIsCreatingCampaign,
    switchActiveType,
    setRefreshKey,
    setSelectedDealToJoin,
    setPurchaseQuantity,
    setPurchaseError,
    isSubmittingPurchase,
    selectedDealToJoin,
    purchaseQuantity,
    setIsSubmittingPurchase,
    setCampaigns,
    setMarketCampaigns,
    hideFullCampaigns
  });

  const {
    galleryState,
    handleOpenGallery,
    handleOpenImageOrderFromParticipation,
    handleCloseGallery,
    handleSelectGalleryImage,
    handleStepGallery,
    handleMoveGalleryImage,
    handleMoveGalleryImageToFront,
    handleSaveGalleryImageOrder
  } = useCampaignGallery({
    setCampaigns,
    setChatCampaign,
    setParticipationCampaign,
    user,
    setParticipationQuantityDraft,
    setParticipationError,
    token,
    setIsLoginModalOpen,
    showSuccessToast,
  });

  const handleOpenUserProfile = (profileUser, source = 'card') => {
    if (!profileUser?.id) {
      return;
    }

    sessionStorage.setItem(
      PROFILE_RETURN_CONTEXT_KEY,
      JSON.stringify({
        source,
        scrollY: window.scrollY,
        path: location.pathname,
        ui: {
          activeType,
          activeCampaignType,
          activeCategory,
          hideFullCampaigns,
          activeStoreIds,
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

  const handleOpenChat = async (deal, { showError = true, returnContext = null } = {}) => {
    if (!token) {
      setIsLoginModalOpen(true);
      return false;
    }

    if (!hasUsableCampaignId(deal)) {
      if (showError) {
        setCampaignError(CHAT_ROOM_UNAVAILABLE_MESSAGE);
      }
      return false;
    }

    let nextDeal = deal;
    try {
      nextDeal = await refreshMineCampaignsBeforeOpen(deal);
      const participation = await fetchMyParticipation(getNormalizedCampaignId(nextDeal), token);
      nextDeal = {
        ...nextDeal,
        chatAccess: getCampaignChatAccess(participation),
      };
    } catch (error) {
      if (showError) {
        setCampaignError(error instanceof Error ? error.message : '無法確認聊天室權限');
      }
      return false;
    }

    if (!canOpenCampaignChat(nextDeal)) {
      if (showError) {
        setCampaignError(CHAT_ROOM_UNAVAILABLE_MESSAGE);
      }
      return false;
    }

    const campaignId = getNormalizedCampaignId(nextDeal);

    await markCampaignChatNotificationsAsRead(campaignId);
    markChatRoomAsRead(campaignId);
    chatReturnContextRef.current = returnContext;
    setChatCampaign(nextDeal);
    return true;
  };

  const handleOpenParticipationFromChat = async (deal) => {
    await handleOpenParticipation(deal);
    chatReturnContextRef.current = null;
    setChatCampaign(null);
  };

  const handleOpenChatFromParticipation = async (deal) => {
    const returnCampaign = participationCampaign ?? deal;
    const opened = await handleOpenChat(deal, {
      returnContext: { type: 'PARTICIPATION', campaign: returnCampaign },
    });

    if (opened) {
      setParticipationCampaign(null);
      setParticipationQuantityDraft('1');
      setParticipationError('');
    }
  };

  const restoreChatReturnContext = () => {
    const returnContext = chatReturnContextRef.current;
    chatReturnContextRef.current = null;

    if (returnContext?.type === 'NOTIFICATIONS') {
      setIsNotificationsOpen(true);
      return;
    }

    if (returnContext?.type === 'CHAT_ROOMS') {
      setIsChatRoomsOpen(true);
      void loadOpenChatRooms();
      return;
    }

    if (returnContext?.type === 'PARTICIPATION' && returnContext.campaign) {
      setParticipationCampaign(returnContext.campaign);
      setParticipationQuantityDraft(
        String(returnContext.campaign.hostReservedQuantity ?? returnContext.campaign.quantity ?? 1)
      );
      setParticipationError('');
      return;
    }

    returnContext?.restore?.();
  };

  const handleCloseCampaignChat = () => {
    setChatCampaign(null);
    restoreChatReturnContext();
  };

  const handleClosePurchaseChat = () => {
    setPurchaseChatRoom(null);
    setPurchaseOrderFromChat(null);
    restoreChatReturnContext();
  };

  const {
    handleOpenReview,
    handleCloseReview,
    handleReviewSubmitted,
    handleOpenParticipation,
    handleCloseParticipation,
    handleConfirmCampaignReceipt,
    handleDeliverCampaign,
    handleRaiseCampaignDispute,
    handleCampaignStatusChange,
    handleUnlockCampaign,
    handleParticipantStatusAction,
    handleSubmitParticipation,
    handleWithdrawParticipation,
    handleCancelHostedCampaign
  } = useParticipationActions({
    token,
    setIsLoginModalOpen,
    setReviewTarget,
    setReviewedReviewKeys,
    setChatReviewState,
    participationCampaign,
    reviewedReviewKeys,
    user,
    chatCampaign,
    setParticipationError,
    setParticipationCampaign,
    setParticipationQuantityDraft,
    refreshMineCampaignsBeforeOpen,
    isSubmittingParticipation,
    setCampaigns,
    setChatCampaign,
    setChatStatusEvent,
    campaigns,
    setCampaignError,
    findCampaignForNotification,
    liveNotifications,
    lastHandledChatNotificationRef,
    setIsSubmittingParticipation,
    setRefreshKey,
    participationQuantityDraft
  });

  // Presentation props stay here while page state and API flows retain their existing lifecycle.
  const campaignListProps = {
    isCompactDealList,
    isMineCompactList,
    isReferenceLoading,
    referenceError,
    campaignError,
    isInitialLoading,
    campaigns,
    expandedCompactDealId,
    focusedCampaignId,
    uiLabels,
    setExpandedCompactDealId,
    handleOpenGallery,
    handleOpenUserProfile,
    activeType,
    countdownNow,
    handleOpenJoinCampaign,
    canOpenCampaignChat,
    handleOpenChat,
    handleOpenParticipation,
    isSameUserId,
    user,
    sentinelRef,
    isLoadingMore,
    hasMore,
  };
  const legacyRequestFormProps = {
    isProxyRequestFormOpen,
    setIsProxyRequestFormOpen,
    handleSubmitProxyPurchaseRequest,
    requestRewardMethod,
    setRequestRewardMethod,
    requestDeliveryMethod,
    setRequestDeliveryMethod,
    requestCompletionTimeMode,
    setRequestCompletionTimeMode,
    requestDeadlineMode,
    setRequestDeadlineMode,
    requestDraftMessage,
  };

  return (
    <MainLayout
      header={{
        token,
        user,
        stores,
        chatUnreadRoomCount,
        notifications,
        openProfile,
        handleOpenChatRooms,
        setIsNotificationsOpen
      }}
      feedback={{
        liveNotifications,
        handleLiveNotificationAction,
        dismissLiveNotification,
        successToast,
        setSuccessToast,
        successToastTimerRef
      }}
      navigation={{
        isProxyRequestFormOpen,
        isProxyRequestModalOpen,
        isSearchExpanded,
        search,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleTouchCancel,
        isRefreshing,
        pullDistance,
        activeStoreIds,
        setActiveStoreIds,
        refreshHome,
        handleCloseMobileSearch,
        mobileSearchInputRef,
        setSearch,
        focusMobileSearch,
        mobileSearchScope,
        handleChangeMobileSearchScope,
        activeType,
        pageTransitionDirection,
        isChatFocusMode,
        isDealViewControlVisible,
        dealViewMode,
        handleChangeDealViewMode,
        isInquiryDetailOpen,
        swipeTabs,
        navigationRef,
        isNavigationOpen,
        switchActiveType,
        handleOpenMobileSearch,
        setIsSearchExpanded,
        setIsNavigationOpen,
        searchInputRef,
        setIsProxyRequestFormOpen,
        handleOpenCreateCampaignForCurrentType
      }}
      overlays={(<>
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
        token={token}
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
        onNotificationAction={(notification) =>
          handleNotificationAction(notification, { returnToNotifications: true })
        }
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
        onClose={handleCloseCampaignChat}
      />

      <PurchaseChatModal
        isOpen={Boolean(purchaseChatRoom)}
        room={purchaseChatRoom}
        token={token}
        currentUser={user}
        onRead={markPurchaseRoomAsRead}
        onOpenOrder={(order) => setPurchaseOrderFromChat({ ...order, openedFromChat: true })}
        onClose={handleClosePurchaseChat}
      />

      <PurchaseOrderModal
        isOpen={Boolean(purchaseOrderFromChat)}
        orderId={purchaseOrderFromChat?.id ?? purchaseOrderFromChat?.orderId}
        token={token}
        currentUser={user}
        onOpenChat={async (order) => {
          if (purchaseOrderFromChat?.openedFromChat) {
            setPurchaseOrderFromChat(null);
            return;
          }
          const returnToNotifications = Boolean(purchaseOrderFromChat?.returnToNotifications);
          const opened = await handleOpenPurchaseChat(
            { ...order, orderId: order?.id ?? purchaseOrderFromChat?.orderId },
            { returnContext: returnToNotifications ? { type: 'NOTIFICATIONS' } : null }
          );
          if (opened) setPurchaseOrderFromChat(null);
        }}
        onUpdated={() => void loadOpenChatRooms({ silent: true })}
        onClose={() => {
          const returnToNotifications = Boolean(purchaseOrderFromChat?.returnToNotifications);
          setPurchaseOrderFromChat(null);
          if (returnToNotifications) setIsNotificationsOpen(true);
        }}
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
      </>)}
    >
      <Outlet context={{
        requests: {
          token,
          user,
          deferredSearch,
          dealViewMode,
          isProxyRequestFormOpen,
          setIsProxyRequestFormOpen,
          setIsProxyRequestModalOpen,
          setIsLoginModalOpen,
          showSuccessToast,
          handleOpenPurchaseChat,
        },
        inquiries: {
          token,
          user,
          stores,
          activeStoreIds,
          inquiryTargetId,
          setInquiryTargetId,
          setIsInquiryDetailOpen,
          setIsLoginModalOpen,
          showSuccessToast,
        },
        mine: {
          localizedMineDomains,
          activeMineDomain,
          setActiveMineDomain,
          localizedMyCampaignScopes,
          activeMyCampaignScope,
          setActiveMyCampaignScope,
          localizedMyCampaignOptions,
          activeMyCampaignFilter,
          setActiveMyCampaignFilter,
          token,
          user,
          deferredSearch,
          dealViewMode,
          setIsProxyRequestModalOpen,
          setIsLoginModalOpen,
          showSuccessToast,
          handleOpenPurchaseChat,
          campaignListProps,
        },
        campaigns: {
          handleOpenCreateCampaignForCurrentType,
          campaignTypeOptions,
          activeCampaignType,
          setActiveCampaignType,
          activeType,
          legacyRequestFormProps,
          activeCategory,
          setActiveCategory,
          categories,
          hideFullCampaigns,
          setHideFullCampaigns,
          activeMarketStatus,
          setActiveMarketStatus,
          campaignListProps,
        },
      }} />
    </MainLayout>
  );
}

export default HomePage;
