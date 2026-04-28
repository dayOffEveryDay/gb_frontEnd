import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import './App.css';
import { AvatarIcon, BulbIcon, ExpandIcon, MoreIcon, OpenCardIcon } from './Icons';
import {
  AUTH_STORAGE_EVENT,
  blockUser,
  clearStoredAuth,
  fetchMyBlockedUsers,
  fetchMyCreditScoreLogs,
  fetchMyFollowingUsers,
  fetchMyReceivedReviews,
  fetchUserProfile,
  followHost,
  getStoredToken,
  getStoredUser,
  setStoredAuth,
  unblockUser,
  unfollowHost,
  updateCurrentUserProfile,
} from './api';
import { formatDateTime, mapCampaign, parseLocalDateTime } from './homeUtils';

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

function normalizePagedItems(data) {
  if (Array.isArray(data?.content)) {
    return data.content;
  }

  if (Array.isArray(data)) {
    return data;
  }

  return [];
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

function normalizeBlockedUser(user) {
  return {
    id: user?.userId != null ? String(user.userId) : '',
    displayName: user?.displayName ?? '--',
    avatarUrl: user?.avatarUrl ?? '',
    blockedAt: user?.blockedAt ?? '',
  };
}

function normalizeFollowingUser(user) {
  return {
    id: user?.hostId != null ? String(user.hostId) : '',
    displayName: user?.displayName ?? '--',
    avatarUrl: user?.avatarUrl ?? '',
    followedAt: user?.followedAt ?? '',
  };
}

function normalizeCreditScoreLog(log) {
  return {
    id: log?.id ?? `${log?.campaignId ?? 'credit'}-${log?.createdAt ?? log?.reason ?? 'log'}`,
    scoreChange: log?.scoreChange ?? log?.score_change ?? null,
    reason: log?.reason ?? '--',
    campaignId: log?.campaignId ?? log?.campaign_id ?? null,
    createdAt: log?.createdAt ?? log?.created_at ?? '',
  };
}

function normalizeReceivedReview(review) {
  return {
    id: review?.id ?? `${review?.campaignId ?? 'review'}-${review?.createdAt ?? review?.reviewerId ?? 'item'}`,
    campaignId: review?.campaignId ?? review?.campaign_id ?? null,
    campaignName: review?.campaignName ?? review?.campaign_name ?? '--',
    reviewerId: review?.reviewerId ?? review?.reviewer_id ?? null,
    reviewerName: review?.reviewerName ?? review?.reviewer_name ?? '--',
    rating: Number(review?.rating ?? 0),
    comment: review?.comment ?? '',
    isScoreCounted: Boolean(review?.isScoreCounted ?? review?.is_score_counted),
    createdAt: review?.createdAt ?? review?.created_at ?? '',
  };
}

function formatScoreChange(value) {
  const numericValue = Number(value);
  if (!Number.isNaN(numericValue)) {
    return numericValue > 0 ? `+${numericValue}` : String(numericValue);
  }

  return value ?? '--';
}

function formatCreditScoreLogDate(value) {
  const date = parseLocalDateTime(value);
  if (!date) {
    return '--';
  }

  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function areUsersEquivalent(left, right) {
  if (left === right) {
    return true;
  }

  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    String(left.id ?? '') === String(right.id ?? '') &&
    (left.displayName ?? '') === (right.displayName ?? '') &&
    (left.profileImageUrl ?? left.avatarUrl ?? '') === (right.profileImageUrl ?? right.avatarUrl ?? '') &&
    Boolean(left.hasCostcoMembership ?? left.has_costco_membership) ===
      Boolean(right.hasCostcoMembership ?? right.has_costco_membership)
  );
}

function UserProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [token, setToken] = useState(() => getStoredToken());
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
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

  const [profile, setProfile] = useState(() => normalizeProfileResponse(null, fallbackUser));
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [creditScoreLogs, setCreditScoreLogs] = useState([]);
  const [receivedReviews, setReceivedReviews] = useState([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingRelations, setIsLoadingRelations] = useState(false);
  const [isLoadingCreditScoreLogs, setIsLoadingCreditScoreLogs] = useState(false);
  const [isLoadingReceivedReviews, setIsLoadingReceivedReviews] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUpdatingRelation, setIsUpdatingRelation] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isCreditScoreExpanded, setIsCreditScoreExpanded] = useState(false);
  const [isReceivedReviewsExpanded, setIsReceivedReviewsExpanded] = useState(false);
  const [expandedReceivedReviewIds, setExpandedReceivedReviewIds] = useState({});
  const [profileDraft, setProfileDraft] = useState({
    displayName: fallbackUser.displayName ?? '',
    hasCostcoMembership: Boolean(currentUser?.hasCostcoMembership ?? currentUser?.has_costco_membership),
  });
  const [openFollowingMenuId, setOpenFollowingMenuId] = useState('');
  const [themeMode, setThemeMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme_mode');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem('theme_mode', themeMode);
  }, [themeMode]);

  useEffect(() => {
    const syncAuthState = () => {
      const nextToken = getStoredToken();
      const nextUser = getStoredUser();

      setToken((current) => (current === nextToken ? current : nextToken));
      setCurrentUser((current) => (areUsersEquivalent(current, nextUser) ? current : nextUser));
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

  useEffect(() => {
    setProfile((current) => normalizeProfileResponse(current, fallbackUser));
    setProfileDraft({
      displayName: fallbackUser.displayName ?? '',
      hasCostcoMembership: Boolean(currentUser?.hasCostcoMembership ?? currentUser?.has_costco_membership),
    });
  }, [fallbackUser, currentUser]);

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
  }, [fallbackUser, isSelf, token, viewedUserId]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setIsLoadingRelations(true);

    Promise.all([
      fetchMyBlockedUsers({ page: 0, size: 100 }, token),
      fetchMyFollowingUsers({ page: 0, size: 100 }, token),
    ])
      .then(([blockedData, followingData]) => {
        if (cancelled) {
          return;
        }

        const nextBlockedUsers = normalizePagedItems(blockedData).map(normalizeBlockedUser);
        const nextFollowingUsers = normalizePagedItems(followingData).map(normalizeFollowingUser);

        setBlockedUsers(nextBlockedUsers);
        setFollowingUsers(nextFollowingUsers);
        setIsBlocked(nextBlockedUsers.some((user) => user.id === viewedUserId));
        setIsFollowing(nextFollowingUsers.some((user) => user.id === viewedUserId));
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError((current) => current || (nextError instanceof Error ? nextError.message : '載入關聯資料失敗'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingRelations(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, viewedUserId]);

  useEffect(() => {
    if (!isSelf || !token) {
      setCreditScoreLogs([]);
      return undefined;
    }

    let cancelled = false;
    setIsLoadingCreditScoreLogs(true);

    fetchMyCreditScoreLogs({ page: 0, size: 20 }, token)
      .then((data) => {
        if (!cancelled) {
          setCreditScoreLogs(normalizePagedItems(data).map(normalizeCreditScoreLog));
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError((current) => current || (nextError instanceof Error ? nextError.message : '載入信用分紀錄失敗'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCreditScoreLogs(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isSelf, token]);

  useEffect(() => {
    if (!isSelf || !token) {
      setReceivedReviews([]);
      return undefined;
    }

    let cancelled = false;
    setIsLoadingReceivedReviews(true);

    fetchMyReceivedReviews({ page: 0, size: 10 }, token)
      .then((data) => {
        if (!cancelled) {
          setReceivedReviews(normalizePagedItems(data).map(normalizeReceivedReview));
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError((current) => current || (nextError instanceof Error ? nextError.message : '載入收到的評價失敗'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingReceivedReviews(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isSelf, token]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/');
  };

  const handleOpenCreditScoreCampaign = (campaignId) => {
    if (campaignId == null) {
      return;
    }

    navigate('/', {
      state: {
        focusCampaignId: String(campaignId),
        source: 'credit-score-log',
      },
    });
  };

  const toggleReceivedReview = (reviewId) => {
    setExpandedReceivedReviewIds((current) => ({
      ...current,
      [reviewId]: !current[reviewId],
    }));
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

      setCurrentUser(nextStoredUser);
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

  const handleBlockToggle = async () => {
    if (!token) {
      setError('請先登入後再調整封鎖狀態。');
      return;
    }

    if (!viewedUserId || isSelf) {
      return;
    }

    setIsUpdatingRelation(true);
    setError('');
    setStatusMessage('');

    try {
      if (isBlocked) {
        await unblockUser(viewedUserId, token);
        setBlockedUsers((current) => current.filter((user) => user.id !== viewedUserId));
        setIsBlocked(false);
        setStatusMessage('已解除封鎖這位使用者。');
      } else {
        await blockUser(viewedUserId, token);
        setBlockedUsers((current) => [
          {
            id: viewedUserId,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            blockedAt: new Date().toISOString(),
          },
          ...current.filter((user) => user.id !== viewedUserId),
        ]);
        setIsBlocked(true);
        setStatusMessage('已封鎖這位使用者。');
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '更新封鎖狀態失敗');
    } finally {
      setIsUpdatingRelation(false);
    }
  };

  const handleUnblockFromList = async (userId) => {
    if (!token || !userId) {
      return;
    }

    setIsUpdatingRelation(true);
    setError('');
    setStatusMessage('');

    try {
      await unblockUser(userId, token);
      setBlockedUsers((current) => current.filter((user) => user.id !== String(userId)));
      if (String(userId) === viewedUserId) {
        setIsBlocked(false);
      }
      setStatusMessage('已解除封鎖。');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '解除封鎖失敗');
    } finally {
      setIsUpdatingRelation(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!token) {
      setError('請先登入後再調整追蹤狀態。');
      return;
    }

    if (!viewedUserId || isSelf) {
      return;
    }

    setIsUpdatingRelation(true);
    setError('');
    setStatusMessage('');

    try {
      if (isFollowing) {
        await unfollowHost(viewedUserId, token);
        setFollowingUsers((current) => current.filter((user) => user.id !== viewedUserId));
        setIsFollowing(false);
        setStatusMessage('已取消追蹤。');
      } else {
        await followHost(viewedUserId, token);
        setFollowingUsers((current) => [
          {
            id: viewedUserId,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            followedAt: new Date().toISOString(),
          },
          ...current.filter((user) => user.id !== viewedUserId),
        ]);
        setIsFollowing(true);
        setStatusMessage('已追蹤這位團主。');
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '更新追蹤狀態失敗');
    } finally {
      setIsUpdatingRelation(false);
    }
  };

  const handleUnfollowFromList = async (userId) => {
    if (!token || !userId) {
      return;
    }

    setIsUpdatingRelation(true);
    setError('');
    setStatusMessage('');

    try {
      await unfollowHost(userId, token);
      setFollowingUsers((current) => current.filter((user) => user.id !== String(userId)));
      if (String(userId) === viewedUserId) {
        setIsFollowing(false);
      }
      setOpenFollowingMenuId('');
      setStatusMessage('已取消追蹤。');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '取消追蹤失敗');
    } finally {
      setIsUpdatingRelation(false);
    }
  };

  const renderCreditScoreTimeline = (logs, variant = 'compact') => (
    <div className={`credit-score-timeline ${variant}`}>
      {logs.map((log, index) => {
        const scoreValue = Number(log.scoreChange);
        const scoreClass =
          !Number.isNaN(scoreValue) && scoreValue > 0
            ? 'positive'
            : !Number.isNaN(scoreValue) && scoreValue < 0
              ? 'negative'
              : '';

        return (
          <article key={`${log.id}-${index}`} className="credit-score-timeline-item">
            <span className="credit-score-timeline-dot" aria-hidden="true" />
            <time>{formatCreditScoreLogDate(log.createdAt)}</time>
            <strong>{log.reason}</strong>
            <span className={`credit-score-timeline-delta ${scoreClass}`.trim()}>
              {formatScoreChange(log.scoreChange)}
            </span>
            {log.campaignId != null && (
              <button
                type="button"
                className="credit-score-campaign-button"
                onClick={() => handleOpenCreditScoreCampaign(log.campaignId)}
                aria-label={`前往團購單 ${log.campaignId}`}
                title="前往團購單"
              >
                <OpenCardIcon />
              </button>
            )}
          </article>
        );
      })}
    </div>
  );

  const renderReceivedReviews = (reviews, variant = 'compact') => (
    <div className={`received-review-list ${variant}`}>
      {reviews.map((review, index) => {
        const reviewKey = `${review.id}-${index}`;
        const isExpanded = Boolean(expandedReceivedReviewIds[reviewKey]);

        return (
          <article key={reviewKey} className="received-review-card">
            <header className="received-review-header">
              <strong>{review.reviewerName}</strong>
              <span className="received-review-stars" aria-label={`${review.rating} 星評價`}>
                {'★'.repeat(Math.max(0, Math.min(5, review.rating)))}
                {'☆'.repeat(Math.max(0, 5 - Math.min(5, review.rating)))}
              </span>
              <span className={review.isScoreCounted ? 'score-counted-badge' : 'score-counted-badge muted'}>
                {review.isScoreCounted ? '已納入信用分' : '未納入信用分'}
              </span>
              <button type="button" className="received-review-toggle" onClick={() => toggleReceivedReview(reviewKey)}>
                {isExpanded ? '收合' : '展開'}
              </button>
            </header>

            {isExpanded && (
              <div className="received-review-detail">
                {review.comment && <p>評價內容：{review.comment}</p>}
                <div className="received-review-meta-row">
                  <span>合購：{review.campaignName}</span>
                  <time>{formatDateTime(review.createdAt)}</time>
                  {review.campaignId != null && (
                    <button
                      type="button"
                      className="credit-score-campaign-button"
                      onClick={() => handleOpenCreditScoreCampaign(review.campaignId)}
                      aria-label={`前往團購單 ${review.campaignId}`}
                      title="前往團購單"
                    >
                      <OpenCardIcon />
                    </button>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );

  return (
    <div className="app-shell user-profile-page-shell">
      <section className="user-profile-page">
        <div className="user-profile-header">
          <p className="eyebrow">{isSelf ? '我的個人資料' : '使用者資料'}</p>
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
            <div className="user-profile-action-row">
              <button
                type="button"
                className={isFollowing ? 'secondary-button' : 'save-button'}
                onClick={handleFollowToggle}
                disabled={isUpdatingRelation || isLoadingRelations}
              >
                {isUpdatingRelation ? '處理中...' : isFollowing ? '取消追蹤' : '追蹤團主'}
              </button>
              <button
                type="button"
                className={isBlocked ? 'secondary-button' : 'danger-button'}
                onClick={handleBlockToggle}
                disabled={isUpdatingRelation || isLoadingRelations}
              >
                {isUpdatingRelation ? '處理中...' : isBlocked ? '解除封鎖' : '封鎖使用者'}
              </button>
            </div>
            <p className="user-profile-hint">查看他人資料時，可直接追蹤團主，或依需求封鎖 / 解封該使用者。</p>
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

        {isSelf && (
          <section className="user-profile-section">
            <div className="user-profile-section-heading">
              <h2>我的信用分紀錄</h2>
              <div className="credit-score-heading-actions">
                <span>{creditScoreLogs.length} 筆</span>
                {creditScoreLogs.length > 0 && (
                  <button
                    type="button"
                    className="credit-score-expand-button"
                    onClick={() => setIsCreditScoreExpanded((current) => !current)}
                    aria-label={isCreditScoreExpanded ? '收合信用分紀錄' : '展開信用分紀錄'}
                    title={isCreditScoreExpanded ? '收合' : '展開'}
                  >
                    <ExpandIcon />
                  </button>
                )}
              </div>
            </div>

            {isLoadingCreditScoreLogs && <p className="state-message">載入信用分紀錄中...</p>}
            {!isLoadingCreditScoreLogs && creditScoreLogs.length === 0 && (
              <p className="panel-note">目前沒有信用分異動紀錄。</p>
            )}

            {creditScoreLogs.length > 0 &&
              renderCreditScoreTimeline(
                isCreditScoreExpanded ? creditScoreLogs.slice(0, 10) : creditScoreLogs,
                isCreditScoreExpanded ? 'expanded' : 'compact'
              )}
          </section>
        )}

        {isSelf && (
          <section className="user-profile-section">
            <div className="user-profile-section-heading">
              <h2>我收到的評價分</h2>
              <div className="credit-score-heading-actions">
                <span>{receivedReviews.length} 筆</span>
                {receivedReviews.length > 0 && (
                  <button
                    type="button"
                    className="credit-score-expand-button"
                    onClick={() => setIsReceivedReviewsExpanded((current) => !current)}
                    aria-label={isReceivedReviewsExpanded ? '收合收到的評價' : '展開收到的評價'}
                    title={isReceivedReviewsExpanded ? '收合' : '展開'}
                  >
                    <ExpandIcon />
                  </button>
                )}
              </div>
            </div>

            {isLoadingReceivedReviews && <p className="state-message">載入收到的評價中...</p>}
            {!isLoadingReceivedReviews && receivedReviews.length === 0 && (
              <p className="panel-note">目前沒有收到的評價。</p>
            )}

            {receivedReviews.length > 0 &&
              renderReceivedReviews(
                isReceivedReviewsExpanded ? receivedReviews.slice(0, 10) : receivedReviews,
                isReceivedReviewsExpanded ? 'expanded' : 'compact'
              )}
          </section>
        )}

        {isSelf && (
          <section className="user-profile-section">
            <div className="user-profile-section-heading">
              <h2>我的追蹤清單</h2>
              <span>{followingUsers.length} 筆</span>
            </div>
            {isLoadingRelations && <p className="state-message">載入追蹤清單中...</p>}
            {!isLoadingRelations && followingUsers.length === 0 && <p className="panel-note">目前沒有追蹤任何團主。</p>}
            <div className="user-profile-relation-list">
              {followingUsers.map((followedUser) => (
                <article key={followedUser.id} className="user-profile-relation-card">
                  <div className="user-profile-relation-main">
                    <span className="user-profile-relation-avatar">
                      {followedUser.avatarUrl ? (
                        <img src={followedUser.avatarUrl} alt={followedUser.displayName} className="avatar-image" />
                      ) : (
                        <AvatarIcon />
                      )}
                    </span>
                    <div className="user-profile-relation-copy">
                      <strong>{followedUser.displayName}</strong>
                      <span>追蹤時間 {formatJoinDate(followedUser.followedAt)}</span>
                    </div>
                  </div>
                  <div className="user-profile-relation-actions">
                    <button
                      type="button"
                      className="user-profile-menu-button"
                      onClick={() =>
                        setOpenFollowingMenuId((current) => (current === followedUser.id ? '' : followedUser.id))
                      }
                      aria-label="更多操作"
                      disabled={isUpdatingRelation}
                    >
                      <MoreIcon />
                    </button>
                    {openFollowingMenuId === followedUser.id && (
                      <div className="user-profile-action-menu">
                        <button
                          type="button"
                          className="user-profile-action-menu-item danger"
                          onClick={() => handleUnfollowFromList(followedUser.id)}
                          disabled={isUpdatingRelation}
                        >
                          取消追蹤
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {isSelf && (
          <section className="user-profile-section">
            <div className="user-profile-section-heading">
              <h2>我的封鎖清單</h2>
              <span>{blockedUsers.length} 筆</span>
            </div>
            {isLoadingRelations && <p className="state-message">載入封鎖清單中...</p>}
            {!isLoadingRelations && blockedUsers.length === 0 && <p className="panel-note">目前沒有封鎖任何使用者。</p>}
            <div className="user-profile-relation-list">
              {blockedUsers.map((blockedUser) => (
                <article key={blockedUser.id} className="user-profile-relation-card">
                  <div className="user-profile-relation-main">
                    <span className="user-profile-relation-avatar">
                      {blockedUser.avatarUrl ? (
                        <img src={blockedUser.avatarUrl} alt={blockedUser.displayName} className="avatar-image" />
                      ) : (
                        <AvatarIcon />
                      )}
                    </span>
                    <div className="user-profile-relation-copy">
                      <strong>{blockedUser.displayName}</strong>
                      <span>封鎖時間 {formatJoinDate(blockedUser.blockedAt)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleUnblockFromList(blockedUser.id)}
                    disabled={isUpdatingRelation}
                  >
                    解封
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="user-profile-section">
          <div className="user-profile-section-heading">
            <h2>目前開團</h2>
            <span>{profile.activeCampaigns.length} 筆</span>
          </div>

          {isLoadingProfile && <p className="state-message">載入個人頁資料中...</p>}
          {!isLoadingProfile && profile.activeCampaigns.length === 0 && !error && <p className="panel-note">目前沒有進行中的開團。</p>}

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
                  <p>面交地點：{campaign.meetupLocation || '--'}</p>
                  <p>截止時間：{formatDateTime(campaign.expireTime)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {isSelf && <p className="panel-note">這裡整合了你的個人資料、帳號設定、追蹤清單與封鎖清單。</p>}
        {statusMessage && <p className="inline-warning">{statusMessage}</p>}
        {error && <p className="inline-error">{error}</p>}
      </section>
    </div>
  );
}

export default UserProfilePage;
