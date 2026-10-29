import { useState, useEffect, useRef } from 'react';
import { getStoredToken, getStoredUser, AUTH_EXPIRED_MESSAGE, AUTH_STORAGE_EVENT, getFrontendBaseUrl, LINE_LOGIN_SUCCESS_MESSAGE, setStoredAuth, openLineLoginPopup, isDevLoginEnabled, devLogin, clearStoredAuth, updateCurrentUserProfile } from '../../api';
import { normalizeUser } from '../../homeUtils';
import { areUsersEquivalent } from '../../homeHelpers';
import { hasCompletedOnboarding } from '../../onboardingUtils';

export default function useAccount({
  navigate,
  setIsCreateCampaignOpen
}) {
  const requestRevision = useRef(0);
  const [token, setToken] = useState(getStoredToken);

  const [user, setUser] = useState(() => normalizeUser(getStoredUser()));

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const [authLoading, setAuthLoading] = useState(false);

  const [authError, setAuthError] = useState('');

  const [profileDraft, setProfileDraft] = useState(
    normalizeUser(getStoredUser()) ?? {
      displayName: '',
    }
  );

  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    const syncAuthState = (event) => {
      const nextToken = getStoredToken();
      const nextUser = normalizeUser(getStoredUser());

      requestRevision.current += 1;
      setProfileDraft(nextUser ?? { displayName: '' });
      setAuthLoading(false);
      setIsSavingProfile(false);
      if (!nextToken) setIsProfileOpen(false);
      setToken((current) => (current === nextToken ? current : nextToken));
      setUser((current) => (areUsersEquivalent(current, nextUser) ? current : nextUser));

      if (event?.detail?.reason === 'expired') {
        setAuthError(AUTH_EXPIRED_MESSAGE);
        setIsLoginModalOpen(true);
        setIsProfileOpen(false);

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
      requestRevision.current += 1;
      window.removeEventListener(AUTH_STORAGE_EVENT, syncAuthState);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (user?.id && !hasCompletedOnboarding(user.id)) {
      navigate('/onboarding/setup', { replace: true });
    }
  }, [navigate, user?.id]);

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

      setIsCreateCampaignOpen(false);
    };

    window.addEventListener('message', handleLineLoginMessage);
    return () => window.removeEventListener('message', handleLineLoginMessage);
  }, [setIsCreateCampaignOpen]);

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

    const revision = ++requestRevision.current;
    try {
      const data = await devLogin(normalizedUserId);
      if (revision !== requestRevision.current) return;
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

      setIsCreateCampaignOpen(false);
      setAuthLoading(false);
    } catch (error) {
      if (revision !== requestRevision.current) return;
      setAuthError(error instanceof Error ? error.message : '開發者登入失敗');
    } finally {
      if (revision === requestRevision.current) setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    requestRevision.current += 1;
    clearStoredAuth();
    setToken('');
    setUser(null);
    setProfileDraft({ displayName: '' });
    setIsProfileOpen(false);

    setIsCreateCampaignOpen(false);
  };

  const handleSaveProfile = async () => {
    if (!token) {
      setAuthError('請先登入後再更新個人資料。');
      return;
    }

    setIsSavingProfile(true);
    setAuthError('');

    const revision = ++requestRevision.current;
    try {
      await updateCurrentUserProfile(
        {
          displayName: profileDraft.displayName,
        },
        token
      );

      if (revision !== requestRevision.current) return;
      const nextUser = normalizeUser({
        ...user,
        ...profileDraft,
      });

      setUser(nextUser);
      setStoredAuth({ token, user: nextUser });
      setIsSavingProfile(false);
    } catch (error) {
      if (revision === requestRevision.current) setAuthError(error.message);
    } finally {
      if (revision === requestRevision.current) setIsSavingProfile(false);
    }
  };

  return {
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
  };
}
