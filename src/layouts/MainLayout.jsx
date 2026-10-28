import { LABELS } from '../homeConfig';
import { getNavigationTabValue } from '../homeHelpers';
import PullRefreshIndicator from '../components/feedback/PullRefreshIndicator';
import HomeTopBar from '../components/navigation/HomeTopBar';
import LiveNotificationStack from '../components/feedback/LiveNotificationStack';
import SuccessToast from '../components/feedback/SuccessToast';
import { SearchIcon } from '../components/icons/Icons';
import DealViewControl from '../components/navigation/DealViewControl';
import PageIndicator from '../components/navigation/PageIndicator';
import MobileNavigation from '../components/navigation/MobileNavigation';
import DesktopNavigation from '../components/navigation/DesktopNavigation';

export default function MainLayout({ header, feedback, navigation, overlays, children }) {
  const { token, user, stores, chatUnreadRoomCount, notifications, openProfile, handleOpenChatRooms, setIsNotificationsOpen } = header;
  const {
    liveNotifications,
    handleLiveNotificationAction,
    dismissLiveNotification,
    successToast,
    setSuccessToast,
    successToastTimerRef,
  } = feedback;
  const {
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
    handleOpenCreateCampaignForCurrentType,
  } = navigation;
  return (
    <div
      className={[
        'app-shell',
        isProxyRequestFormOpen || isProxyRequestModalOpen ? 'proxy-request-modal-open' : '',
        isSearchExpanded ? 'mobile-search-mode' : '',
        isSearchExpanded && !search.trim() ? 'search-empty' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <PullRefreshIndicator isRefreshing={isRefreshing} pullDistance={pullDistance} />

      <HomeTopBar
        labels={LABELS}
        token={token}
        user={user}
        stores={stores}
        activeStoreIds={activeStoreIds}
        chatUnreadRoomCount={chatUnreadRoomCount}
        unreadCount={notifications.length}
        onChangeStores={setActiveStoreIds}
        onOpenProfile={openProfile}
        onOpenChatRooms={handleOpenChatRooms}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onRefresh={refreshHome}
        isRefreshing={isRefreshing}
      />

      {liveNotifications.length > 0 && (
        <LiveNotificationStack
          notifications={liveNotifications}
          onAction={handleLiveNotificationAction}
          onDismiss={dismissLiveNotification}
        />
      )}

      {successToast && (
        <SuccessToast
          toast={successToast}
          onDismiss={() => {
            setSuccessToast(null);
            if (successToastTimerRef.current) {
              window.clearTimeout(successToastTimerRef.current);
              successToastTimerRef.current = null;
            }
          }}
        />
      )}

      {overlays}

      {isSearchExpanded && (
        <section className="mobile-search-header" aria-label="搜尋合購與託購">
          <div className="mobile-search-bar">
            <button
              type="button"
              className="mobile-search-back"
              aria-label="返回原本頁面"
              onClick={handleCloseMobileSearch}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
              </svg>
            </button>
            <div className="mobile-search-field">
              <SearchIcon />
              <input
                ref={mobileSearchInputRef}
                type="search"
                aria-label="搜尋商品名稱、關鍵字或類別"
                placeholder="搜尋商品名稱、關鍵字或類別"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="mobile-search-clear"
                  aria-label="清除搜尋文字"
                  onClick={() => {
                    setSearch('');
                    focusMobileSearch();
                  }}
                >
                  <span aria-hidden="true"></span>
                </button>
              )}
            </div>
          </div>

          <div className="mobile-search-scopes" role="tablist" aria-label="搜尋範圍">
            <button
              type="button"
              role="tab"
              aria-selected={mobileSearchScope === 'CAMPAIGN'}
              className={mobileSearchScope === 'CAMPAIGN' ? 'active' : ''}
              onClick={() => handleChangeMobileSearchScope('CAMPAIGN')}
            >
              合購
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileSearchScope === 'REQUEST'}
              className={mobileSearchScope === 'REQUEST' ? 'active' : ''}
              onClick={() => handleChangeMobileSearchScope('REQUEST')}
            >
              託購
            </button>
          </div>

          {!search.trim() && (
            <div className="mobile-search-start">
              <SearchIcon />
              <strong>開始搜尋</strong>
              <p>輸入商品名稱、關鍵字或類別，尋找合購與託購內容。</p>
            </div>
          )}
        </section>
      )}

      <main className="content">
        <div key={activeType} className={`page-transition page-transition-${pageTransitionDirection}`}>
          {children}
        </div>
      </main>

      {!isSearchExpanded && !isChatFocusMode && activeType !== 'INQUIRY' && (
        <DealViewControl
          isVisible={isDealViewControlVisible}
          viewMode={dealViewMode}
          onChange={handleChangeDealViewMode}
        />
      )}
      {!isSearchExpanded && !isChatFocusMode && !(activeType === 'INQUIRY' && isInquiryDetailOpen) && (
        <PageIndicator tabs={swipeTabs} activeTab={getNavigationTabValue(activeType)} />
      )}

      {!isChatFocusMode && !(activeType === 'INQUIRY' && isInquiryDetailOpen) && (
        <MobileNavigation
          containerRef={navigationRef}
          activeType={activeType}
          isOpen={isNavigationOpen}
          onNavigate={switchActiveType}
          onOpenSearch={handleOpenMobileSearch}
          onToggle={() => {
            setIsSearchExpanded(false);
            setIsNavigationOpen((current) => !current);
          }}
        />
      )}

      <DesktopNavigation
        activeType={activeType}
        isSearchExpanded={isSearchExpanded}
        search={search}
        searchPlaceholder={LABELS.searchPlaceholder}
        searchInputRef={searchInputRef}
        onNavigate={switchActiveType}
        onOpenSearch={() => {
          setIsSearchExpanded(true);
          window.setTimeout(() => searchInputRef.current?.focus(), 0);
        }}
        onFocusSearch={() => setIsSearchExpanded(true)}
        onBlurSearch={() => {
          if (!search.trim()) {
            setIsSearchExpanded(false);
          }
        }}
        onSearchChange={setSearch}
        onCreateRequest={() => setIsProxyRequestFormOpen(true)}
        onCreateCampaign={handleOpenCreateCampaignForCurrentType}
      />
    </div>
  );
}
