// 取得目前前端網站的來源位址，用於 postMessage 驗證與 callback 導向。
function getFrontendBaseUrl() {
  return window.location.origin;
}

// 取得目前完整頁面網址，供非固定 callback 場景使用。
function getFrontendPageUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

// 判斷是否為本機開發環境，集中管理 localhost 特例。
function isLocalhost() {
  return window.location.hostname === 'localhost';
}

// LINE callback 固定使用 /login/callback，但前面的 origin 一律取目前瀏覽器同源。
function getLineCallbackUrl() {
  return `${getFrontendBaseUrl()}/login/callback`;
}

// localhost 使用指定的 LINE Channel ID，其他環境改由 env 提供。
function getLineClientId() {
  if (isLocalhost()) {
    return '2009301316';
  }

  return import.meta.env.VITE_LINE_CLIENT_ID ?? '';
}

// API 預設打同源，只有 localhost 開發時改接到 8080。
function getBackendBaseUrl() {
  const url = new URL(window.location.origin);

  if (isLocalhost()) {
    url.port = '8080';
  }

  return url.toString();
}

const BACKEND_API_BASE_URL = getBackendBaseUrl();
const LINE_CALLBACK_URL = getLineCallbackUrl();
const LINE_CLIENT_ID = getLineClientId();

const TOKEN_KEY = 'jwt_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'current_user';
const LINE_STATE_KEY = 'line_login_state';
const LINE_LOGIN_SUCCESS_MESSAGE = 'line-login-success';
export const AUTH_STORAGE_EVENT = 'gb-auth-change';

let refreshRequestPromise = null;

// 組出含 query string 的完整 API 請求網址。
function buildUrl(path, query = {}) {
  const url = new URL(path, BACKEND_API_BASE_URL);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

function dispatchAuthStorageChange() {
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
}

function buildRequestHeaders({ body, headers, token }) {
  return {
    ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? await response.json() : null;
}

function createApiError(data, fallbackMessage = 'API request failed.') {
  return new Error(data?.message || data?.error || fallbackMessage);
}

async function executeRequest(path, { method = 'GET', body, token, headers = {}, query } = {}) {
  const resolvedToken = token || getStoredToken();
  const response = await fetch(buildUrl(path, query), {
    method,
    headers: buildRequestHeaders({ body, headers, token: resolvedToken }),
    body:
      body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });

  const data = await parseResponse(response);
  return { response, data };
}

async function refreshAccessToken() {
  const refreshToken = getStoredRefreshToken();

  if (!refreshToken) {
    throw new Error('Refresh token is missing.');
  }

  if (!refreshRequestPromise) {
    refreshRequestPromise = (async () => {
      const response = await fetch(buildUrl('/api/v1/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await parseResponse(response);

      if (!response.ok || !data?.token) {
        throw createApiError(data, 'Failed to refresh access token.');
      }

      setStoredAuth({
        token: data.token,
        refreshToken: data.refreshToken ?? refreshToken,
      });

      return data.token;
    })().finally(() => {
      refreshRequestPromise = null;
    });
  }

  return refreshRequestPromise;
}

// 共用 request 包裝，統一處理 JSON、授權標頭、refresh token 與錯誤訊息。
async function request(path, options = {}) {
  const { skipAuthRefresh = false, ...requestOptions } = options;
  const { response, data } = await executeRequest(path, requestOptions);

  if (response.ok) {
    return data;
  }

  const canRefresh =
    !skipAuthRefresh &&
    !path.startsWith('/api/v1/auth/') &&
    (response.status === 401 || response.status === 403) &&
    Boolean(requestOptions.token || getStoredToken()) &&
    Boolean(getStoredRefreshToken());

  if (canRefresh) {
    try {
      const nextToken = await refreshAccessToken();
      const retryResult = await executeRequest(path, {
        ...requestOptions,
        token: nextToken,
      });

      if (retryResult.response.ok) {
        return retryResult.data;
      }

      throw createApiError(retryResult.data);
    } catch (error) {
      clearStoredAuth();
      throw error instanceof Error ? error : new Error('Login expired. Please sign in again.');
    }
  }

  throw createApiError(data);
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) ?? '';
}

// 將登入成功後的 token / refresh token 與使用者資訊持久化到 localStorage。
export function setStoredAuth({ token, refreshToken, user } = {}) {
  let didChange = false;

  if (token !== undefined) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    didChange = true;
  }

  if (refreshToken !== undefined) {
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    didChange = true;
  }

  if (user !== undefined) {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
    didChange = true;
  }

  if (didChange) {
    dispatchAuthStorageChange();
  }
}

// 登出時清空本地登入資訊。
export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  dispatchAuthStorageChange();
}

// 從 localStorage 還原使用者資訊，並處理壞掉的 JSON。
export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

// 產生 LINE OAuth 授權網址，並先保存 state 供 callback 驗證。
export function createLineLoginUrl() {
  if (!LINE_CLIENT_ID) {
    throw new Error('缺少 LINE Channel ID，無法啟動 LINE 登入。');
  }

  const state = crypto.randomUUID();
  sessionStorage.setItem(LINE_STATE_KEY, state);

  const url = new URL('https://access.line.me/oauth2/v2.1/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', LINE_CLIENT_ID);
  url.searchParams.set('redirect_uri', LINE_CALLBACK_URL);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'profile openid');

  return url.toString();
}

// 使用 popup 開啟 LINE OAuth，避免主頁直接跳走。
export function openLineLoginPopup() {
  const popup = window.open(
    createLineLoginUrl(),
    'line-login-popup',
    'popup=yes,width=480,height=720,left=100,top=80'
  );

  if (!popup) {
    throw new Error('無法開啟 LINE 登入視窗，請確認瀏覽器未封鎖彈出視窗。');
  }

  popup.focus();
  return popup;
}

// 從 callback URL 取回 code 與 state，並轉成後端交換 token 所需資料。
// 這裡只解析，不會立刻清掉 URL，避免 code 還沒送到後端就消失。
export function consumeLineLoginParams() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');
  const expectedState = sessionStorage.getItem(LINE_STATE_KEY);

  if (error) {
    throw new Error(errorDescription || error);
  }

  if (!code) {
    return null;
  }

  if (expectedState && expectedState !== state) {
    throw new Error('LINE 登入 state 驗證失敗。');
  }

  sessionStorage.removeItem(LINE_STATE_KEY);

  return {
    code,
    redirectUri: LINE_CALLBACK_URL,
  };
}

// 成功處理完 callback 後，再把網址列上的 OAuth 參數清掉。
export function clearLineLoginParams() {
  window.history.replaceState({}, document.title, window.location.pathname);
}

export function fetchStores() {
  return request('/api/v1/stores');
}

export function fetchCategories() {
  return request('/api/v1/categories');
}

// 取得團購列表，支援分頁與篩選條件。
export function fetchCampaigns(params) {
  return request('/api/v1/campaigns', { query: params });
}

export function fetchMyHostedCampaigns(params, token) {
  return request('/api/v1/campaigns/my-hosted', {
    query: params,
    token,
  });
}

export function fetchMyJoinedCampaigns(params, token) {
  return request('/api/v1/campaigns/my-joined', {
    query: params,
    token,
  });
}

export function fetchMyParticipation(campaignId, token) {
  return request(`/api/v1/campaigns/${campaignId}/participants/me`, {
    token,
  });
}

export function fetchHostDashboard(campaignId, token) {
  return request(`/api/v1/campaigns/${campaignId}/host-dashboard`, {
    token,
  });
}

export function fetchUnreadNotifications(token) {
  return request('/api/v1/notifications/unread', {
    token,
  });
}

export function fetchReadNotifications(params, token) {
  return request('/api/v1/notifications/read', {
    query: params,
    token,
  });
}

export function markNotificationRead(notificationId, token) {
  return request(`/api/v1/notifications/${notificationId}/read`, {
    method: 'PUT',
    token,
  });
}

export function fetchCampaignChatMessages(campaignId, token) {
  return request(`/api/v1/campaigns/${campaignId}/chat-messages`, {
    token,
  });
}

export function uploadChatImages(files, token, campaignId) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('files', file);
  });

  if (campaignId !== undefined && campaignId !== null && campaignId !== '') {
    formData.append('campaignId', campaignId);
  }

  return request('/api/v1/files/upload', {
    method: 'POST',
    body: formData,
    token,
  });
}

export function fetchMyCreditScoreLogs(params, token) {
  return request('/api/v1/credit-scores/me/logs', {
    query: params,
    token,
  });
}

export function fetchMyReceivedReviews(params, token) {
  return request('/api/v1/reviews/me/received', {
    query: params,
    token,
  });
}

export function checkReviewStatus(campaignId, revieweeId, token) {
  return request('/api/v1/reviews/check', {
    token,
    query: {
      campaignId,
      revieweeId,
    },
  });
}

export function createReview(payload, token) {
  return request('/api/v1/reviews', {
    method: 'POST',
    body: payload,
    token,
  });
}

// 把 LINE callback code 送到後端，交換 JWT 與使用者資料。
export function lineLogin(payload) {
  return request('/api/v1/auth/line', {
    method: 'POST',
    body: payload,
  });
}

export function devLogin(userId) {
  return request('/api/v1/auth/dev-login', {
    query: {
      userId,
    },
  });
}

// 送出發起團購表單，使用 multipart/form-data 對應後端建立團購 API。
export function createCampaign(payload, token) {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (key === 'images' && Array.isArray(value)) {
      value.forEach((file) => {
        formData.append('images', file);
      });
      return;
    }

    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, value);
    }
  });

  return request('/api/v1/campaigns', {
    method: 'POST',
    body: formData,
    token,
  });
}

// 更新目前登入者的個人資料設定。
export function joinCampaign(campaignId, payload, token) {
  return request(`/api/v1/campaigns/${campaignId}/join`, {
    method: 'POST',
    body: payload,
    token,
  });
}

export function reviseCampaign(campaignId, payload, token) {
  return request(`/api/v1/campaigns/${campaignId}/revise`, {
    method: 'POST',
    body: payload,
    token,
  });
}

export function hostReviseCampaign(campaignId, payload, token) {
  return request(`/api/v1/campaigns/${campaignId}/host-revise`, {
    method: 'PUT',
    body: payload,
    token,
  });
}

export function updateCampaignImageOrder(campaignId, imageUrls, token) {
  return request(`/api/v1/campaigns/${campaignId}/images/order`, {
    method: 'PUT',
    body: {
      imageUrls,
    },
    token,
  });
}

export function unlockCampaignRevision(campaignId, token) {
  return request(`/api/v1/campaigns/${campaignId}/unlock`, {
    method: 'POST',
    token,
  });
}

export function kickCampaignParticipant(campaignId, participantId, token, reason) {
  return request(`/api/v1/campaigns/${campaignId}/participants/${participantId}/kick`, {
    method: 'POST',
    body: reason ? { reason } : undefined,
    token,
  });
}

export function markParticipantNoShow(campaignId, userId, token, note) {
  return request(`/api/v1/campaigns/${campaignId}/participants/${userId}/no-show`, {
    method: 'PUT',
    body: note ? { note } : undefined,
    token,
  });
}

export function cancelCampaign(campaignId, token) {
  return request(`/api/v1/campaigns/${campaignId}/cancel`, {
    method: 'POST',
    token,
  });
}

export function deliverCampaign(campaignId, token) {
  return request(`/api/v1/campaigns/${campaignId}/deliver`, {
    method: 'POST',
    token,
  });
}

export function withdrawCampaign(campaignId, token) {
  return request(`/api/v1/campaigns/${campaignId}/withdraw`, {
    method: 'POST',
    token,
  });
}

export function confirmCampaignReceipt(campaignId, token) {
  return request(`/api/v1/campaigns/${campaignId}/confirm`, {
    method: 'POST',
    token,
  });
}

export function raiseCampaignDispute(campaignId, token, reason) {
  return request(`/api/v1/campaigns/${campaignId}/dispute`, {
    method: 'POST',
    body: reason ? { reason } : undefined,
    token,
  });
}

export function updateCurrentUserProfile(payload, token) {
  return request('/api/v1/users/me', {
    method: 'PUT',
    body: payload,
    token,
  });
}

export function fetchUserProfile(userId, token) {
  return request(`/api/v1/users/${userId}/profile`, {
    token,
  });
}

export function fetchMyBlockedUsers(params, token) {
  return request('/api/v1/users/me/blocks', {
    query: params,
    token,
  });
}

export function followHost(hostId, token) {
  return request(`/api/v1/follows/${hostId}`, {
    method: 'POST',
    token,
  });
}

export function unfollowHost(hostId, token) {
  return request(`/api/v1/follows/${hostId}`, {
    method: 'DELETE',
    token,
  });
}

export function fetchMyFollowingUsers(params, token) {
  return request('/api/v1/follows/me', {
    query: params,
    token,
  });
}

export function blockUser(userId, token) {
  return request(`/api/v1/users/${userId}/block`, {
    method: 'POST',
    token,
  });
}

export function unblockUser(userId, token) {
  return request(`/api/v1/users/${userId}/block`, {
    method: 'DELETE',
    token,
  });
}

export {
  getBackendBaseUrl,
  getFrontendBaseUrl,
  getFrontendPageUrl,
  getLineCallbackUrl,
  LINE_LOGIN_SUCCESS_MESSAGE,
};
