import { useDeferredValue, useEffect, useRef, useState } from 'react';
import './App.css';
import {
  clearStoredAuth,
  createCampaign,
  fetchCampaigns,
  fetchCategories,
  fetchStores,
  getFrontendBaseUrl,
  getStoredToken,
  getStoredUser,
  joinCampaign,
  LINE_LOGIN_SUCCESS_MESSAGE,
  openLineLoginPopup,
  setStoredAuth,
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
  isWithinHoduoBusinessHours,
  mapCampaign,
  normalizeUser,
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

function HomePage() {
  const uiLabels = {
    ...LABELS,
    joinCampaign: '\u52a0\u5165\u5718\u8cfc',
    purchaseQuantity: '\u8a8d\u8cfc\u6578\u91cf',
    confirmJoinCampaign: '\u78ba\u8a8d\u52a0\u5165',
    submittingJoinCampaign: '\u9001\u51fa\u4e2d...',
    soldOut: '\u5df2\u984d\u6eff',
  };

  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [referenceError, setReferenceError] = useState('');
  const [isReferenceLoading, setIsReferenceLoading] = useState(true);
  const [activeType, setActiveType] = useState('INSTANT');
  const [activeCategory, setActiveCategory] = useState(0);
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
  const canPullRef = useRef(false);
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
      const nextExpirePreset = current.scenarioType === 'INSTANT' ? current.expirePreset || '10m' : 'custom';
      const nextSuggestedMeetupTime = getSuggestedMeetupTime({ ...current, expirePreset: nextExpirePreset });

      if (current.scenarioType !== 'INSTANT') {
        autoMeetupTimeRef.current = '';
        if (current.expirePreset === 'custom' && current.meetupTime === '') {
          return current;
        }

        return {
          ...current,
          expirePreset: 'custom',
          meetupTime: '',
        };
      }

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
          ? data.content.map(mapCampaign).filter((item) => item.scenarioType === activeType)
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
  }, [activeCategory, activeStore, activeType, deferredSearch, refreshKey]);

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
    if (!node || !hasMore || isInitialLoading || isLoadingMore) {
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
                  .filter((item) => item.scenarioType === activeType)
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

  const handleTouchStart = (event) => {
    if (window.innerWidth >= 700 || window.scrollY > 0 || isRefreshing) {
      canPullRef.current = false;
      return;
    }

    pullStartYRef.current = event.touches[0]?.clientY ?? null;
    canPullRef.current = true;
  };

  const handleTouchMove = (event) => {
    if (!canPullRef.current || pullStartYRef.current == null) {
      return;
    }

    const currentY = event.touches[0]?.clientY ?? pullStartYRef.current;
    const delta = currentY - pullStartYRef.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }

    setPullDistance(Math.min(delta * 0.45, 84));
  };

  const handleTouchEnd = () => {
    if (!canPullRef.current) {
      return;
    }

    canPullRef.current = false;
    pullStartYRef.current = null;

    if (pullDistance >= 60) {
      refreshHome();
      return;
    }

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
      ['待認購數量', campaignForm.totalQuantity],
      ['截止時間', campaignForm.expirePreset === 'custom' ? campaignForm.expireTime : campaignForm.expirePreset],
      ['面交時間', campaignForm.meetupTime],
      ['面交地點', campaignForm.meetupLocation.trim()],
    ];

    if (campaignForm.scenarioType !== 'INSTANT') {
      requiredChecks[8][1] = 'ok';
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
        totalQuantity: Number(campaignForm.totalQuantity),
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
        totalQuantity: payload.totalQuantity,
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

      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === selectedDealToJoin.id
            ? {
                ...campaign,
                availableQuantity:
                  joinResponse?.availableQuantity ??
                  joinResponse?.available_quantity ??
                  campaign.availableQuantity - normalizedQuantity,
              }
            : campaign
        )
      );
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

  return (
    <div
      className="app-shell"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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
        labels={LABELS}
        isOpen={isCreateCampaignOpen}
        stores={stores}
        categories={categories}
        typeOptions={TYPE_OPTIONS}
        expirePresetOptions={EXPIRE_PRESET_OPTIONS}
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

      <main className="content">
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
              getScenarioLabel={getScenarioLabel}
              getTypeClass={getTypeClass}
              onJoin={handleOpenJoinCampaign}
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
