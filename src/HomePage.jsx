import useAccount from './features/account/useAccount';
import useSuccessToast from './features/notifications/useSuccessToast';
import useChatRooms from './features/chat/useChatRooms';
import useNotifications from './features/notifications/useNotifications';
import useProfileNavigation from './features/account/useProfileNavigation';
import useChatNavigation from './features/chat/useChatNavigation';
import useNotificationNavigation from './features/notifications/useNotificationNavigation';
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
import { canOpenCampaignChat, isSameUserId, canReorderCampaignImages } from './homeHelpers';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import MainLayout from './layouts/MainLayout';
import { fetchMyHostedCampaigns, fetchMyJoinedCampaigns } from './api';

import { LABELS, TYPE_OPTIONS } from './homeConfig';
import { formatDateTime, getScenarioLabel, mapCampaign } from './homeUtils';

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

  const [referenceRefreshKey, setReferenceRefreshKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const [countdownNow, setCountdownNow] = useState(() => Date.now());

  const lastHandledChatNotificationRef = useRef('');

  const {
    token,
    user,
    isProfileOpen,
    setIsProfileOpen,
    isLoginModalOpen,
    setIsLoginModalOpen,
    authLoading,
    authError,
    setAuthError,
    profileDraft,
    setProfileDraft,
    isSavingProfile,
    handleLineLogin,
    handleDevLogin,
    handleLogout,
    handleSaveProfile
  } = useAccount({
    navigate,
    setIsCreateCampaignOpen
  });
  const { successToast, setSuccessToast, successToastTimerRef, showSuccessToast } = useSuccessToast();
  const {
    isChatRoomsOpen,
    setIsChatRoomsOpen,
    chatRooms,
    chatRoomsError,
    setChatRoomsError,
    isChatRoomsLoading,
    chatCampaign,
    setChatCampaign,
    purchaseChatRoom,
    setPurchaseChatRoom,
    purchaseOrderFromChat,
    setPurchaseOrderFromChat,
    chatReturnContextRef,
    chatStatusEvent,
    setChatStatusEvent,
    purchaseChatRoomRef,
    isChatFocusMode,
    chatUnreadRoomCount,
    markChatRoomAsRead,
    markPurchaseRoomAsRead,
    loadOpenChatRooms,
    handleOpenChatRooms,
    handleChatAccessRevoked
  } = useChatRooms({
    user,
    token,
    setAuthError,
    setIsLoginModalOpen,
    refreshKey,
    setParticipationCampaign,
    setSuccessToast,
    successToastTimerRef,
    setRefreshKey
  });
  const {
    isNotificationsOpen,
    setIsNotificationsOpen,
    notifications,
    readNotifications,
    notificationsError,
    setNotificationsError,
    readNotificationsError,
    isNotificationsLoading,
    isReadNotificationsLoading,
    liveNotifications,
    isNotificationSoundEnabled,
    dismissLiveNotification,
    handleToggleNotificationSound,
    hidePurchaseChatNotifications,
    markNotificationAsRead,
    markCampaignChatNotificationsAsRead
  } = useNotifications({
    userId: user?.id,
    token,
    purchaseChatRoomRef,
    handleChatAccessRevoked
  });

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

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [referenceRefreshKey]);

  useEffect(() => {
    if (!isRefreshing) {
      return;
    }

    if (!isReferenceLoading && !isInitialLoading && !isLoadingMore) {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, isReferenceLoading, isInitialLoading, isLoadingMore, setIsRefreshing, setPullDistance]);

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

  const {
    handleOpenUserProfile,
    openProfile
  } = useProfileNavigation({
    location,
    setActiveCampaignType,
    setActiveCategory,
    setHideFullCampaigns,
    setActiveStoreIds,
    setActiveMyCampaignFilter,
    setActiveMyCampaignScope,
    setSearch,
    setChatCampaign,
    isInitialLoading,
    chatCampaign,
    campaigns,
    activeType,
    activeCampaignType,
    activeCategory,
    hideFullCampaigns,
    activeStoreIds,
    activeMyCampaignScope,
    activeMyCampaignFilter,
    search,
    navigate,
    setAuthError,
    token,
    setIsLoginModalOpen,
    setIsProfileOpen,
    user
  });

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

  const {
    handleOpenChatRoom,
    handleOpenPurchaseChat,
    handleOpenChat,
    handleOpenParticipationFromChat,
    handleOpenChatFromParticipation,
    handleCloseCampaignChat,
    handleClosePurchaseChat,
    handleOpenOrderFromChat,
    handleOpenChatFromOrder,
    handleClosePurchaseOrder
  } = useChatNavigation({
    setChatRoomsError,
    token,
    markPurchaseRoomAsRead,
    hidePurchaseChatNotifications,
    chatReturnContextRef,
    setPurchaseChatRoom,
    setIsChatRoomsOpen,
    setIsLoginModalOpen,
    showSuccessToast,
    chatRooms,
    user,
    setCampaignError,
    refreshMineCampaignsBeforeOpen,
    markCampaignChatNotificationsAsRead,
    markChatRoomAsRead,
    setChatCampaign,
    handleOpenParticipation: (...args) => handleOpenParticipation(...args),
    participationCampaign,
    setParticipationCampaign,
    setParticipationQuantityDraft,
    setParticipationError,
    setIsNotificationsOpen,
    loadOpenChatRooms,
    setPurchaseOrderFromChat,
    purchaseOrderFromChat
  });

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

  const {
    handleNotificationAction,
    handleLiveNotificationAction
  } = useNotificationNavigation({
    token,
    markNotificationAsRead,
    setIsNotificationsOpen,
    setInquiryTargetId,
    switchActiveType,
    handleOpenPurchaseChat,
    setPurchaseOrderFromChat,
    findCampaignForNotification,
    setNotificationsError,
    setParticipationCampaign,
    setParticipationQuantityDraft,
    handleOpenReview,
    handleOpenParticipation,
    markCampaignChatNotificationsAsRead,
    chatReturnContextRef,
    setChatCampaign,
    dismissLiveNotification
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
        onOpenOrder={handleOpenOrderFromChat}
        onClose={handleClosePurchaseChat}
      />

      <PurchaseOrderModal
        isOpen={Boolean(purchaseOrderFromChat)}
        orderId={purchaseOrderFromChat?.id ?? purchaseOrderFromChat?.orderId}
        token={token}
        currentUser={user}
        onOpenChat={handleOpenChatFromOrder}
        onUpdated={() => void loadOpenChatRooms({ silent: true })}
        onClose={handleClosePurchaseOrder}
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
