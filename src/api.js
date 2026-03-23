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
const USER_KEY = 'current_user';
const LINE_STATE_KEY = 'line_login_state';
const LINE_LOGIN_SUCCESS_MESSAGE = 'line-login-success';

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

// 共用 request 包裝，統一處理 JSON、授權標頭與錯誤訊息。
async function request(path, { method = 'GET', body, token, headers = {}, query } = {}) {
  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body:
      body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message = data?.message || data?.error || 'API request failed.';
    throw new Error(message);
  }

  return data;
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

// 將登入成功後的 token 與使用者資訊持久化到 localStorage。
export function setStoredAuth({ token, user }) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

// 登出時清空本地登入資訊。
export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
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

// 把 LINE callback code 送到後端，交換 JWT 與使用者資料。
export function lineLogin(payload) {
  return request('/api/v1/auth/line', {
    method: 'POST',
    body: payload,
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
export function updateCurrentUserProfile(payload, token) {
  return request('/api/v1/users/me', {
    method: 'PUT',
    body: payload,
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
