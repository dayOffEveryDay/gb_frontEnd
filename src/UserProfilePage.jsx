import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import './App.css';
import { BulbIcon } from './Icons';
import { AvatarIcon } from './Icons';
import {
  blockUser,
  clearStoredAuth,
  fetchUserProfile,
  getStoredToken,
  getStoredUser,
  setStoredAuth,
  unblockUser,
  updateCurrentUserProfile,
} from './api';
import { formatDateTime, mapCampaign, parseLocalDateTime } from './homeUtils';

const BLOCKED_USER_IDS_KEY = 'blocked_user_ids';

function readBlockedUserIds() {
  try {
    const raw = localStorage.getItem(BLOCKED_USER_IDS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((value) => String(value)) : [];
  } catch {
    localStorage.removeItem(BLOCKED_USER_IDS_KEY);
    return [];
  }
}

function writeBlockedUserIds(ids) {
  localStorage.setItem(BLOCKED_USER_IDS_KEY, JSON.stringify(Array.from(new Set(ids))));
}

function formatJoinDate(value) {
  const date = parseLocalDateTime(value);
  if (!date) {
    return '--';
  }

  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function normalizeProfileResponse(profile, fallbackUser) {
  return {
    id: profile?.userId ?? fallbackUser?.id ?? null,
    displayName: profile?.displayName ?? fallbackUser?.displayName ?? fallbackUser?.name ?? '--',
    avatarUrl: profile?.avatarUrl ?? fallbackUser?.profileImageUrl ?? fallbackUser?.avatarUrl ?? '',
    creditScore: profile?.creditScore ?? fallbackUser?.creditScore ?? fallbackUser?.credit_score ?? null,
    totalHostedCount: Number(profile?.totalHostedCount ?? 0),
    totalJoinedCount: Number(profile?.totalJoinedCount ?? 0),
    joinDate: profile?.joinDate ?? '',
    activeCampaigns: Array.isArray(profile?.activeCampaigns) ? profile.activeCampaigns.map(mapCampaign) : [],
  };
}

function UserProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const token = getStoredToken();
  const currentUser = getStoredUser();
  const routeUser = location.state?.user ?? null;

  const fallbackUser = useMemo(
    () => ({
      id: routeUser?.id ?? params.id ?? null,
      displayName: routeUser?.displayName ?? routeUser?.name ?? `使用者 ${params.id ?? ''}`.trim(),
      profileImageUrl: routeUser?.profileImageUrl ?? routeUser?.avatarUrl ?? '',
      creditScore: routeUser?.creditScore ?? routeUser?.credit_score ?? null,
    }),
    [params.id, routeUser]
  );

  const viewedUserId = fallbackUser.id != null ? String(fallbackUser.id) : '';
  const isSelf = viewedUserId !== '' && String(currentUser?.id ?? '') === viewedUserId;
  const [blockedIds, setBlockedIds] = useState(() => readBlockedUserIds());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [profile, setProfile] = useState(() => normalizeProfileResponse(null, fallbackUser));
  const [profileDraft, setProfileDraft] = useState({
    displayName: fallbackUser.displayName ?? '',
    hasCostcoMembership: Boolean(currentUser?.hasCostcoMembership ?? currentUser?.has_costco_membership),
  });
  const [themeMode, setThemeMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme_mode');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const isBlocked = viewedUserId !== '' && blockedIds.includes(viewedUserId);

  useEffect(() => {
    setProfile((current) => normalizeProfileResponse(current, fallbackUser));
    setProfileDraft({
      displayName: fallbackUser.displayName ?? '',
      hasCostcoMembership: Boolean(currentUser?.hasCostcoMembership ?? currentUser?.has_costco_membership),
    });
  }, [fallbackUser]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem('theme_mode', themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!viewedUserId) {
      setError('缺少使用者 ID，無法查看個人頁。');
      return;
    }

    if (!token) {
      setError('目前查看個人頁需要先登入。');
      return;
    }

    let cancelled = false;
    setIsLoadingProfile(true);
    setError('');

    fetchUserProfile(viewedUserId, token)
      .then((data) => {
        if (!cancelled) {
          const nextProfile = normalizeProfileResponse(data, fallbackUser);
          setProfile(nextProfile);
          if (isSelf) {
            setProfileDraft((current) => ({
              ...current,
              displayName: nextProfile.displayName ?? '',
            }));
          }
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : '載入個人頁失敗');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackUser, token, viewedUserId]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/');
  };

  const handleBlockToggle = async () => {
    if (!token) {
      setError('請先登入後再進行封鎖設定。');
      return;
    }

    if (!viewedUserId) {
      setError('缺少使用者資訊，無法更新封鎖狀態。');
      return;
    }

    if (isSelf) {
      setError('不能封鎖自己。');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setStatusMessage('');

    try {
      if (isBlocked) {
        await unblockUser(viewedUserId, token);
        const nextIds = blockedIds.filter((id) => id !== viewedUserId);
        setBlockedIds(nextIds);
        writeBlockedUserIds(nextIds);
        setStatusMessage('已解除封鎖這位使用者。');
      } else {
        await blockUser(viewedUserId, token);
        const nextIds = [...blockedIds, viewedUserId];
        setBlockedIds(nextIds);
        writeBlockedUserIds(nextIds);
        setStatusMessage('已封鎖這位使用者。');
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '更新封鎖狀態失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!token) {
      setError('請先登入後再更新個人資料。');
      return;
    }

    setIsSavingProfile(true);
    setError('');
    setStatusMessage('');

    try {
      await updateCurrentUserProfile(
        {
          displayName: profileDraft.displayName,
          hasCostcoMembership: profileDraft.hasCostcoMembership,
        },
        token
      );

      const nextStoredUser = {
        ...currentUser,
        displayName: profileDraft.displayName,
        hasCostcoMembership: profileDraft.hasCostcoMembership,
      };

      setStoredAuth({ token, user: nextStoredUser });
      setProfile((current) => ({
        ...current,
        displayName: profileDraft.displayName,
      }));
      setStatusMessage('已更新個人資料。');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '更新個人資料失敗');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogout = () => {
    clearStoredAuth();
    navigate('/');
  };

  return (
    <div className="app-shell user-profile-page-shell">
      <section className="user-profile-page">
        <div className="user-profile-header">
          <p className="eyebrow">個人頁</p>
          <button type="button" className="modal-close" onClick={handleBack}>
            返回
          </button>
        </div>

        <div className="user-profile-card">
          <div className="user-profile-avatar">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.displayName} className="avatar-image" />
            ) : (
              <AvatarIcon />
            )}
          </div>

          <div className="user-profile-copy">
            <h1>{profile.displayName}</h1>
            <p>信用分數 {profile.creditScore ?? '--'}</p>
            <p>加入時間 {formatJoinDate(profile.joinDate)}</p>
          </div>

          <div className="user-profile-stats">
            <div className="user-profile-stat">
              <span>開團</span>
              <strong>{profile.totalHostedCount}</strong>
            </div>
            <div className="user-profile-stat">
              <span>跟團</span>
              <strong>{profile.totalJoinedCount}</strong>
            </div>
            <div className="user-profile-stat">
              <span>進行中</span>
              <strong>{profile.activeCampaigns.length}</strong>
            </div>
          </div>
        </div>

        {!isSelf && (
          <div className="user-profile-actions">
            <button
              type="button"
              className={isBlocked ? 'secondary-button' : 'danger-button'}
              onClick={handleBlockToggle}
              disabled={isSubmitting}
            >
              {isSubmitting ? '處理中...' : isBlocked ? '解除封鎖' : '封鎖使用者'}
            </button>
            <p className="user-profile-hint">若雙方存在封鎖關係，系統可能拒絕查看對方個人頁與相關資訊。</p>
          </div>
        )}

        {isSelf && (
          <section className="user-profile-section">
            <div className="user-profile-section-heading">
              <h2>帳號設定</h2>
            </div>

            <label className="profile-field">
              <span>顯示名稱</span>
              <input
                type="text"
                value={profileDraft.displayName}
                onChange={(event) =>
                  setProfileDraft((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
              />
            </label>

            <label className="switch-row">
              <span>Costco 會員卡</span>
              <input
                type="checkbox"
                checked={profileDraft.hasCostcoMembership}
                onChange={(event) =>
                  setProfileDraft((current) => ({
                    ...current,
                    hasCostcoMembership: event.target.checked,
                  }))
                }
              />
            </label>

            <button type="button" className="save-button" onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? '儲存中...' : '儲存'}
            </button>

            <button
              type="button"
              className="text-button theme-toggle"
              onClick={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}
            >
              <BulbIcon />
              <span>主題: {themeMode === 'dark' ? 'Dark' : 'Light'}</span>
            </button>

            <button type="button" className="secondary-button" onClick={handleLogout}>
              登出
            </button>
          </section>
        )}

        <section className="user-profile-section">
          <div className="user-profile-section-heading">
            <h2>目前開團</h2>
            <span>{profile.activeCampaigns.length} 筆</span>
          </div>

          {isLoadingProfile && <p className="state-message">載入個人頁資料中...</p>}
          {!isLoadingProfile && profile.activeCampaigns.length === 0 && !error && (
            <p className="panel-note">目前沒有進行中的開團。</p>
          )}

          <div className="user-profile-campaign-list">
            {profile.activeCampaigns.map((campaign) => (
              <article key={campaign.id} className="user-profile-campaign-card">
                <div className="user-profile-campaign-media">
                  <img src={campaign.image} alt={campaign.itemName} className="user-profile-campaign-image" />
                </div>
                <div className="user-profile-campaign-copy">
                  <h3>{campaign.itemName}</h3>
                  <p>狀態：{campaign.status ?? '--'}</p>
                  <p>類型：{campaign.scenarioType ?? '--'}</p>
                  <p>單價：NT$ {campaign.pricePerUnit ?? '--'}</p>
                  <p>剩餘數量：{campaign.availableQuantity ?? '--'}</p>
                  <p>店面名稱：{campaign.storeName || '--'}</p>
                  <p>集合地點：{campaign.meetupLocation || '--'}</p>
                  <p>截止時間：{formatDateTime(campaign.expireTime)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {isSelf && <p className="panel-note">這是你目前對外可見的個人頁資訊，也包含帳號設定功能。</p>}
        {statusMessage && <p className="inline-warning">{statusMessage}</p>}
        {error && <p className="inline-error">{error}</p>}
      </section>
    </div>
  );
}

export default UserProfilePage;
