import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getStoredToken, getStoredUser, setStoredAuth, updateCurrentUserProfile } from './api';
import { applyThemePreference, getInitialThemePreference } from './onboardingUtils';

function OnboardingSetupPage() {
  const navigate = useNavigate();
  const token = getStoredToken();
  const user = useMemo(() => getStoredUser(), []);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [hasCostcoMembership, setHasCostcoMembership] = useState(Boolean(user?.hasCostcoMembership));
  const [themePreference, setThemePreference] = useState(getInitialThemePreference);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleSave = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError('請先輸入顯示名稱。');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const nextUser = await updateCurrentUserProfile(
        {
          displayName: trimmedName,
          hasCostcoMembership,
        },
        token
      );

      setStoredAuth({
        user: {
          ...user,
          ...nextUser,
          displayName: nextUser?.displayName ?? trimmedName,
          hasCostcoMembership: Boolean(nextUser?.hasCostcoMembership ?? hasCostcoMembership),
        },
      });
      applyThemePreference(themePreference);
      navigate('/onboarding/welcome', { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '儲存失敗，請稍後再試。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="app-shell onboarding-shell">
      <section className="onboarding-card">
        <p className="eyebrow">第一次使用</p>
        <h1>先完成你的基本設定</h1>
        <p className="onboarding-copy">這些資料會幫助其他使用者辨識你，也會讓後續體驗更符合你的使用習慣。</p>

        <label className="profile-field">
          <span>顯示名稱</span>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：Jenny" />
        </label>

        <fieldset className="onboarding-choice-group">
          <legend>背景主題</legend>
          <label>
            <input
              type="radio"
              name="themePreference"
              value="default"
              checked={themePreference === 'default'}
              onChange={(event) => setThemePreference(event.target.value)}
            />
            <span>預設</span>
          </label>
          <label>
            <input
              type="radio"
              name="themePreference"
              value="light"
              checked={themePreference === 'light'}
              onChange={(event) => setThemePreference(event.target.value)}
            />
            <span>明亮</span>
          </label>
          <label>
            <input
              type="radio"
              name="themePreference"
              value="dark"
              checked={themePreference === 'dark'}
              onChange={(event) => setThemePreference(event.target.value)}
            />
            <span>暗色</span>
          </label>
        </fieldset>

        <label className="switch-row onboarding-switch-row">
          <span>我有 Costco 會員</span>
          <input
            type="checkbox"
            checked={hasCostcoMembership}
            onChange={(event) => setHasCostcoMembership(event.target.checked)}
          />
        </label>

        {error && <p className="inline-error">{error}</p>}

        <button type="button" className="save-button onboarding-primary-button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? '儲存中...' : '儲存並繼續'}
        </button>
      </section>
    </div>
  );
}

export default OnboardingSetupPage;
