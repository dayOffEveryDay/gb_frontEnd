export const ONBOARDING_COMPLETED_KEY = 'gb_onboarding_completed';
export const THEME_PREFERENCE_KEY = 'theme_preference';

export function getOnboardingStorageKey(userId) {
  return userId ? `${ONBOARDING_COMPLETED_KEY}:${userId}` : ONBOARDING_COMPLETED_KEY;
}

export function hasCompletedOnboarding(userId) {
  return localStorage.getItem(getOnboardingStorageKey(userId)) === 'true';
}

export function markOnboardingCompleted(userId) {
  localStorage.setItem(getOnboardingStorageKey(userId), 'true');
}

export function resolveThemePreference(preference) {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyThemePreference(preference) {
  const resolvedTheme = resolveThemePreference(preference);
  localStorage.setItem(THEME_PREFERENCE_KEY, preference);
  localStorage.setItem('theme_mode', resolvedTheme);
  document.documentElement.dataset.theme = resolvedTheme;
  return resolvedTheme;
}

export function getInitialThemePreference() {
  const storedPreference = localStorage.getItem(THEME_PREFERENCE_KEY);
  if (storedPreference === 'default' || storedPreference === 'light' || storedPreference === 'dark') {
    return storedPreference;
  }

  const storedTheme = localStorage.getItem('theme_mode');
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return 'default';
}
