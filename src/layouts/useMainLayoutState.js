import useMainPageRoute from './useMainPageRoute';
import useSessionPreference from './useSessionPreference';
import { MAIN_TABS as swipeTabs } from './mainRoutes';
import { useState, useDeferredValue, useRef, useEffect } from 'react';

import { getInitialDealViewModePreferences } from '../homeHelpers';



export default function useMainLayoutState() {

  const { activeType, setActiveType, pageTransitionDirection } = useMainPageRoute();

  const [activeStoreIds, setActiveStoreIds] = useSessionPreference('stores', []);

  const [search, setSearch] = useSessionPreference('search', '');

  const deferredSearch = useDeferredValue(search);

  const [dealViewModePreferences, setDealViewModePreferences] = useState(getInitialDealViewModePreferences);

  const [expandedCompactDealId, setExpandedCompactDealId] = useState('');

  const [isDealViewControlVisible, setIsDealViewControlVisible] = useState(true);

  const [isDesktopViewport, setIsDesktopViewport] = useState(() => window.matchMedia('(min-width: 700px)').matches);



  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  const [mobileSearchScope, setMobileSearchScope] = useState('CAMPAIGN');

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [pullDistance, setPullDistance] = useState(0);

  const [themeMode, setThemeMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme_mode');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const pullStartYRef = useRef(null);

  const swipeStartXRef = useRef(null);

  const canPullRef = useRef(false);

  const gestureLockRef = useRef('');

  const searchInputRef = useRef(null);

  const mobileSearchInputRef = useRef(null);

  const navigationRef = useRef(null);

  const searchReturnContextRef = useRef(null);

  const dealViewControlTimerRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem('theme_mode', themeMode);
  }, [themeMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 700px)');
    const syncDesktopViewport = () => setIsDesktopViewport(mediaQuery.matches);

    syncDesktopViewport();
    mediaQuery.addEventListener('change', syncDesktopViewport);

    return () => mediaQuery.removeEventListener('change', syncDesktopViewport);
  }, []);

  useEffect(() => {
    if (isSearchExpanded) {
      // Preserve the existing reset when entering mobile search.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return {
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
    setIsDealViewControlVisible,
    isDesktopViewport,
    setIsDesktopViewport,
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
    searchReturnContextRef,
    dealViewControlTimerRef,
  };
}
