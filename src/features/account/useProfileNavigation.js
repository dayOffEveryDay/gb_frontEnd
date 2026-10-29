import { useRef, useEffect } from 'react';
import { PROFILE_RETURN_CONTEXT_KEY } from '../../homeHelpers';
import { mainPath } from '../../layouts/mainRoutes';

export default function useProfileNavigation({
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
}) {
  const pendingProfileReturnRef = useRef(null);

  const profileRestoreAppliedRef = useRef(false);

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
  }, [setActiveCampaignType, setActiveCategory, setActiveMyCampaignFilter, setActiveMyCampaignScope, setActiveStoreIds, setHideFullCampaigns, setSearch, setChatCampaign, location.pathname, location.state]);

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

  return {
    handleOpenUserProfile,
    openProfile
  };
}
