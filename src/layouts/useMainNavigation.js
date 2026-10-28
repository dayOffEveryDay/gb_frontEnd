import { useCallback, useEffect } from 'react';
import { getNavigationTabValue, DEAL_VIEW_MODE_KEYS } from '../homeHelpers';

export default function useMainNavigation({
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
}) {
  const switchActiveType = useCallback((nextType) => {
    setIsNavigationOpen(false);
    setActiveType((current) => {
      const requestedType = typeof nextType === 'function' ? nextType(getNavigationTabValue(current)) : nextType;
      if (requestedType === 'INSTANT' || requestedType === 'SCHEDULED') {
        setActiveCampaignType(requestedType);
      }
      const resolvedType = getNavigationTabValue(requestedType) === 'CAMPAIGN' ? 'SCHEDULED' : requestedType;
      if (!resolvedType || resolvedType === current) {
        return current;
      }

      if (resolvedType !== 'REQUEST') {
        setIsProxyRequestFormOpen(false);
      }

      return resolvedType;
    });
  }, [setIsNavigationOpen, setActiveType, setActiveCampaignType, setIsProxyRequestFormOpen]);

  useEffect(() => {
    setIsNavigationOpen(false);
    if (activeType !== 'REQUEST') setIsProxyRequestFormOpen(false);
    if (activeType === 'MINE' || activeType === 'INQUIRY') setIsSearchExpanded(false);
    setMobileSearchScope(activeType === 'REQUEST' ? 'REQUEST' : 'CAMPAIGN');
  }, [activeType, setIsNavigationOpen, setIsProxyRequestFormOpen, setIsSearchExpanded, setMobileSearchScope]);

  useEffect(() => {
    if (!isNavigationOpen) {
      return undefined;
    }

    const handleNavigationDismiss = (event) => {
      if (event.key === 'Escape') {
        setIsNavigationOpen(false);
        return;
      }

      if (event.type === 'pointerdown' && !navigationRef.current?.contains(event.target)) {
        setIsNavigationOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleNavigationDismiss);
    document.addEventListener('keydown', handleNavigationDismiss);

    return () => {
      document.removeEventListener('pointerdown', handleNavigationDismiss);
      document.removeEventListener('keydown', handleNavigationDismiss);
    };
  }, [isNavigationOpen, navigationRef, setIsNavigationOpen]);

  const switchActiveTypeBySwipe = (direction) => {
    if (window.innerWidth >= 700) {
      return;
    }

    switchActiveType((current) => {
      const currentIndex = swipeTabs.findIndex((value) => value === getNavigationTabValue(current));
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

  const dealViewModeScope = activeType === 'REQUEST' ? 'request' : isDesktopViewport ? (activeType === 'MINE' ? 'mine' : 'market') : 'mobile';

  const defaultDealViewMode =
    isDesktopViewport && activeType === 'MINE' && activeMyCampaignScope === 'ALL' ? 'compact' : 'card';

  const dealViewMode = dealViewModePreferences[dealViewModeScope] || defaultDealViewMode;

  const isCompactDealList = dealViewMode === 'compact';

  const isMineCompactList = activeType === 'MINE' && isCompactDealList;

  const handleChangeDealViewMode = (nextMode) => {
    setDealViewModePreferences((current) => ({
      ...current,
      [dealViewModeScope]: nextMode,
    }));
    localStorage.setItem(DEAL_VIEW_MODE_KEYS[dealViewModeScope], nextMode);
    setExpandedCompactDealId('');
  };

  const focusMobileSearch = () => {
    window.setTimeout(() => mobileSearchInputRef.current?.focus(), 0);
  };

  const handleOpenMobileSearch = () => {
    const isRequestScope = activeType === 'REQUEST';
    searchReturnContextRef.current = {
      activeType,
      activeCampaignType,
      scrollY: window.scrollY,
    };
    setMobileSearchScope(isRequestScope ? 'REQUEST' : 'CAMPAIGN');
    if (!isRequestScope) {
      setActiveCampaignType('ALL');
      switchActiveType('CAMPAIGN');
    }
    setIsNavigationOpen(false);
    setIsSearchExpanded(true);
    window.scrollTo({ top: 0 });
    focusMobileSearch();
  };

  const handleChangeMobileSearchScope = (nextScope) => {
    setMobileSearchScope(nextScope);

    if (nextScope === 'REQUEST') {
      switchActiveType('REQUEST');
    } else {
      setActiveCampaignType('ALL');
      switchActiveType('CAMPAIGN');
    }

    focusMobileSearch();
  };

  const handleCloseMobileSearch = () => {
    const returnContext = searchReturnContextRef.current;
    setIsSearchExpanded(false);
    setIsNavigationOpen(false);
    setSearch('');

    if (returnContext?.activeType) {
      setActiveType(returnContext.activeType);
      if (returnContext.activeCampaignType) {
        setActiveCampaignType(returnContext.activeCampaignType);
      }
    }

    window.setTimeout(() => {
      window.scrollTo({ top: returnContext?.scrollY ?? 0 });
      searchReturnContextRef.current = null;
    }, 0);
  };

  return {
    switchActiveType,
    switchActiveTypeBySwipe,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    dealViewModeScope,
    defaultDealViewMode,
    dealViewMode,
    isCompactDealList,
    isMineCompactList,
    handleChangeDealViewMode,
    focusMobileSearch,
    handleOpenMobileSearch,
    handleChangeMobileSearchScope,
    handleCloseMobileSearch,
  };
}
