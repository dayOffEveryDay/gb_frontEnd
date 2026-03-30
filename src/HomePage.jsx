import { useDeferredValue, useEffect, useRef, useState } from 'react';
import './App.css';
import {
  clearStoredAuth,
  createCampaign,
  fetchCampaigns,
  fetchCategories,
  fetchHostDashboard,
  fetchMyHostedCampaigns,
  fetchMyJoinedCampaigns,
  fetchMyParticipation,
  fetchStores,
  getFrontendBaseUrl,
  getStoredToken,
  getStoredUser,
  hostReviseCampaign,
  joinCampaign,
  LINE_LOGIN_SUCCESS_MESSAGE,
  openLineLoginPopup,
  reviseCampaign,
  setStoredAuth,
  withdrawCampaign,
  updateCurrentUserProfile,
} from './api';
import { EXPIRE_PRESET_OPTIONS, LABELS, MY_CAMPAIGN_OPTIONS, PAGE_SIZE, TYPE_OPTIONS } from './homeConfig';
import {
  formatCountdown,
  formatDateTime,
  getSuggestedMeetupTime,
  getInitialCampaignForm,
  getScenarioLabel,
  getTypeClass,
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

function HomePage() {
  const swipeTabs = [...TYPE_OPTIONS.map((option) => option.value), 'MINE'];
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
  const [chatCampaign, setChatCampaign] = useState(null);
  const [galleryState, setGalleryState] = useState({
    isOpen: false,
    title: '',
    images: [],
    activeIndex: 0,
  });
  const [referenceRefreshKey, setReferenceRefreshKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
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
  const autoMeetupTimeRef = useRef('');

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem('theme_mode', themeMode);
  }, [themeMode]);

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
      const nextExpirePreset = current.expirePreset || '10m';
      const nextSuggestedMeetupTime = getSuggestedMeetupTime({ ...current, expirePreset: nextExpirePreset });

      const shouldSyncMeetupTime = !current.meetupTime || current.meetupTime === autoMeetupTimeRef.current;
      autoMeetupTimeRef.current = nextSuggestedMeetupTime;

      if (current.expirePreset === nextExpirePreset && (!shouldSyncMeetupTime || current.meetupTime === nextSuggestedMeetupTime)) {
        return current;
      }

      return {
        ...current,
        expirePreset: nextExpirePreset,
        meetupTime: shouldSyncMeetupTime ? nextSuggestedMeetupTime : current.meetupTime,
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

  useEffect(() => {
    let cancelled = false;

    const loadCampaignPage = async () => {
      setIsInitialLoading(true);
      setCampaignError('');

      try {
        if (activeType === 'MINE') {
          const mineQuery = {
            page: 0,
            size: PAGE_SIZE,
          };

          if (!token) {
            if (!cancelled) {
              setCampaigns([]);
              setPage(0);
              setHasMore(false);
              setCampaignError(LABELS.loginRequiredForMine);
            }
            return;
          }

          let items = [];

          if (activeMyCampaignFilter === 'HOSTED') {
            const data = await fetchMyHostedCampaigns(mineQuery, token);
            items = Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : [];
          } else if (activeMyCampaignFilter === 'JOINED') {
            const data = await fetchMyJoinedCampaigns(mineQuery, token);
            items = Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : [];
          } else {
            const [hostedData, joinedData] = await Promise.all([
              fetchMyHostedCampaigns(mineQuery, token),
              fetchMyJoinedCampaigns(mineQuery, token),
            ]);

            const hostedItems = Array.isArray(hostedData?.content) ? hostedData.content : Array.isArray(hostedData) ? hostedData : [];
            const joinedItems = Array.isArray(joinedData?.content) ? joinedData.content : Array.isArray(joinedData) ? joinedData : [];
            const mergedCampaigns = [...hostedItems, ...joinedItems];
            const campaignMap = new Map();

            mergedCampaigns.forEach((campaign, index) => {
              const key =
                campaign.id ??
                campaign.campaignId ??
                `${campaign.itemName ?? campaign.item_name ?? 'campaign'}-${campaign.expireTime ?? campaign.expire_time ?? index}`;
              if (!campaignMap.has(key)) {
                campaignMap.set(key, campaign);
              }
            });

            items = Array.from(campaignMap.values());

            if (activeMyCampaignFilter === 'COMPLETED') {
              items = items.filter((campaign) => getCampaignLifecycle(campaign) === 'COMPLETED');
            } else if (activeMyCampaignFilter === 'CANCELLED') {
              items = items.filter((campaign) => getCampaignLifecycle(campaign) === 'CANCELLED');
            }
          }

          if (cancelled) {
            return;
          }

          setCampaigns(items.map(mapCampaign));
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

        if (cancelled) {
          return;
        }

        const items = Array.isArray(data?.content)
          ? data.content.map(mapCampaign).filter((item) => item.scenarioType === activeType && item.availableQuantity > 0)
          : [];

        setCampaigns(items);
        setPage(0);
        setHasMore(Boolean(data) && !data.last);
      } catch (error) {
        if (!cancelled) {
          setCampaignError(error.message);
          setCampaigns([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setIsInitialLoading(false);
        }
      }
    };

    loadCampaignPage();

    return () => {
      cancelled = true;
    };
  }, [activeCategory, activeMyCampaignFilter, activeStore, activeType, deferredSearch, refreshKey, token]);

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
    if (!node || activeType === 'MINE' || !hasMore || isInitialLoading || isLoadingMore) {
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

    setIsProfileOpen((open) => !open);
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

  const handleLogout = () => {
    clearStoredAuth();
    setToken('');
    setUser(null);
    setProfileDraft({ displayName: '', hasCostcoMembership: false });
    setIsProfileOpen(false);
    setIsNotificationsOpen(false);
    setIsCreateCampaignOpen(false);
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

  const handleOpenCreateCampaign = () => {
    if (!token) {
      setIsLoginModalOpen(true);
      setCreateCampaignError('');
      return;
    }

    setCreateCampaignError('');
    autoMeetupTimeRef.current = '';
    setCampaignForm((current) => ({
      ...getInitialCampaignForm(),
      storeId: current.storeId || stores[0]?.id?.toString() || '',
      categoryId: current.categoryId || categories[0]?.id?.toString() || '',
      scenarioType: current.scenarioType || 'SCHEDULED',
    }));
    setIsCreateCampaignOpen(true);
  };

  const refreshHome = () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setReferenceRefreshKey((current) => current + 1);
    setRefreshKey((current) => current + 1);
  };

  const switchActiveTypeBySwipe = (direction) => {
    if (window.innerWidth >= 700) {
      return;
    }

    setActiveType((current) => {
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

    if (campaignForm.scenarioType === 'INSTANT' && !isWithinHoduoBusinessHours()) {
      const message = '\u73fe\u5728\u975e\u597d\u591a\u71df\u696d\u6642\u9593\uff0c\u8acb\u6539\u9810\u8cfc\u6a21\u5f0f\u3002';
      setCreateCampaignError(message);
      window.alert(message);
      return;
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
      setActiveType(campaignForm.scenarioType);
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

  const handleOpenChat = (deal) => {
    if (!token) {
      setIsLoginModalOpen(true);
      return;
    }

    if (!canOpenCampaignChat(deal)) {
      return;
    }

    setChatCampaign(deal);
  };

  const handleOpenParticipation = async (deal) => {
    if (!token) {
      setIsLoginModalOpen(true);
      return;
    }

    setParticipationError('');

    try {
      const isHostDeal = deal.host?.id === user?.id || deal.isHost;

      if (isHostDeal) {
        const dashboard = await fetchHostDashboard(deal.id, token);

        setParticipationCampaign({
          ...deal,
          managementMode: 'HOST',
          dashboard,
          totalPhysicalQuantity: Number(dashboard?.totalPhysicalQuantity ?? 0),
          hostReservedQuantity: Number(dashboard?.hostReservedQuantity ?? 0),
          openQuantity: Number(dashboard?.openQuantity ?? 0),
          alreadySoldQuantity: Number(dashboard?.alreadySoldQuantity ?? 0),
        });
        setParticipationQuantityDraft(String(Number(dashboard?.hostReservedQuantity ?? 0)));
        return;
      }

      const participation = await fetchMyParticipation(deal.id, token);
      const mergedDeal = {
        ...deal,
        managementMode: 'JOINED',
        isHost: Boolean(participation?.host ?? deal.isHost),
        joined: Boolean(participation?.joined ?? deal.joined ?? Number(deal.quantity) > 0),
        quantity: Number(participation?.quantity ?? deal.quantity ?? 0),
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
        onChangeStore={setActiveStore}
        onOpenProfile={openProfile}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onRefresh={refreshHome}
        isRefreshing={isRefreshing}
      />

      <LoginModal
        labels={LABELS}
        isOpen={isLoginModalOpen}
        authLoading={authLoading}
        authError={authError}
        onClose={() => setIsLoginModalOpen(false)}
        onLineLogin={handleLineLogin}
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

      <NotificationsModal labels={LABELS} isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />

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
        key={chatCampaign?.id ?? 'closed-chat'}
        isOpen={Boolean(chatCampaign)}
        campaign={chatCampaign}
        token={token}
        currentUser={user}
        onClose={() => setChatCampaign(null)}
      />

      <ParticipationActionModal
        isOpen={Boolean(participationCampaign)}
        campaign={participationCampaign}
        quantityDraft={participationQuantityDraft}
        isSubmitting={isSubmittingParticipation}
        error={participationError}
        onChangeQuantity={setParticipationQuantityDraft}
        onClose={handleCloseParticipation}
        onSubmit={handleSubmitParticipation}
        onWithdraw={handleWithdrawParticipation}
      />

      <main className="content">
        <div className="type-switch-shell">
          <section className="type-switch">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={activeType === option.value ? 'mode-button active' : 'mode-button'}
                onClick={() => setActiveType(option.value)}
              >
                {option.label}
              </button>
            ))}
          </section>
          <button
            type="button"
            className={activeType === 'MINE' ? 'mode-button mine-entry active' : 'mode-button mine-entry'}
            onClick={() => setActiveType('MINE')}
          >
            {LABELS.mine}
          </button>
        </div>

        <section className="category-strip">
          {activeType === 'MINE' ? (
            MY_CAMPAIGN_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={activeMyCampaignFilter === option.value ? 'category-button active' : 'category-button'}
                onClick={() => setActiveMyCampaignFilter(option.value)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <>
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
            </>
          )}
        </section>

        {isReferenceLoading && <p className="state-message">{LABELS.referenceLoading}</p>}
        {referenceError && <p className="inline-error">{referenceError}</p>}
        {campaignError && <p className="inline-error">{campaignError}</p>}

        <section className="deal-grid">
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
              onOpenParticipation={
                activeType === 'MINE'
                  ? handleOpenParticipation
                  : undefined
              }
              showJoinAction={activeType !== 'MINE' && deal.host?.id !== user?.id}
            />
          ))}
        </section>

        <div ref={sentinelRef} className="list-sentinel">
          {isInitialLoading || isLoadingMore ? LABELS.loadingMore : hasMore ? LABELS.loadingMore : LABELS.noMoreData}
        </div>
      </main>

      <footer className="bottom-bar">
        <label className="search-box">
          <input
            type="search"
            placeholder={LABELS.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button type="button" className="create-button" onClick={handleOpenCreateCampaign}>
          {LABELS.createDeal}
        </button>
      </footer>
    </div>
  );
}

export default HomePage;
