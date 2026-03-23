import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';
import {
  clearLineLoginParams,
  consumeLineLoginParams,
  getFrontendBaseUrl,
  lineLogin,
  LINE_LOGIN_SUCCESS_MESSAGE,
  setStoredAuth,
} from './api';

// 統一整理後端登入回應內的 user 結構，避免主頁與 callback 頁格式不一致。
function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id ?? null,
    displayName: user.displayName ?? '未命名使用者',
    profileImageUrl: user.profileImageUrl ?? '',
    hasCostcoMembership: Boolean(user.hasCostcoMembership),
  };
}

// LINE callback 專用頁：負責解析 code、打後端交換 JWT，並回傳給 opener。
function LineCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('正在處理 LINE 登入...');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    // callback 載入後立即送 code 給後端，成功時優先通知 opener 視窗。
    const handleCallback = async () => {
      try {
        const params = consumeLineLoginParams();

        if (!params?.code) {
          throw new Error('LINE callback 缺少 code。');
        }

        setMessage('正在把 LINE 授權 code 送到後端...');

        const data = await lineLogin(params);
        if (cancelled) {
          return;
        }

        const nextUser = normalizeUser(data.user);
        setStoredAuth({
          token: data.token,
          user: nextUser,
        });
        clearLineLoginParams();

        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: LINE_LOGIN_SUCCESS_MESSAGE,
              token: data.token,
              user: nextUser,
            },
            getFrontendBaseUrl()
          );

          window.close();
          return;
        }

        setMessage('登入成功，正在返回首頁...');
        navigate('/', { replace: true });
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        setError(requestError.message);
        setMessage('');
      }
    };

    handleCallback();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="login-page-container">
      <h1>LINE 登入回調</h1>
      {message && <p>{message}</p>}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default LineCallbackPage;
