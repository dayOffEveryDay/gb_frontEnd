import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gbcLogo from './assets/gbcLogo.png';
import './LoginPage.css'; // 稍後創建此 CSS 文件

// 從環境變數讀取設定
const FRONTEND_BASE_URL = import.meta.env.VITE_APP_FRONTEND_BASE_URL;
const BACKEND_API_BASE_URL = import.meta.env.VITE_APP_BACKEND_API_BASE_URL;

const LoginPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Line 登入的回調處理
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state'); // Line 要求的 state 參數

    if (code) {
      setLoading(true);
      setError(null);

      const redirectUri = `${FRONTEND_BASE_URL}/login/callback`;

      fetch(`${BACKEND_API_BASE_URL}/api/v1/auth/line`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, redirectUri }),
      })
        .then(response => response.json())
        .then(data => {
          if (data.token) {
            localStorage.setItem('jwt_token', data.token);
            // 根據後端響應判斷是否為新用戶，可能需要引導至個人資料設定頁
            if (data.isNewUser) {
              // 導向設定個人資料頁面
              console.log('新用戶，導向個人資料設定');
            }
            navigate('/home'); // 登入成功跳轉到首頁
          } else {
            setError(data.message || 'Line 登入失敗');
          }
        })
        .catch(err => {
          console.error('Line 登入請求錯誤:', err);
          setError('網路錯誤或伺服器無回應');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [navigate]);

  // 開發者後門登入
  const handleDevLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_API_BASE_URL}/api/v1/auth/dev-login?userId=1`); // 預設使用 userId=1
      const data = await response.json();
      if (data.token) {
        localStorage.setItem('jwt_token', data.token);
        navigate('/home'); // 登入成功跳轉到首頁
      } else {
        setError(data.message || '開發者登入失敗');
      }
    } catch (err) {
      console.error('開發者登入請求錯誤:', err);
      setError('網路錯誤或伺服器無回應');
    } finally {
      setLoading(false);
    }
  };

  // 導向 Line 登入的處理函式
  const handleLineLogin = () => {
    const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=YOUR_LINE_CLIENT_ID&redirect_uri=${FRONTEND_BASE_URL}/login/callback&state=YOUR_RANDOM_STATE&scope=profile%20openid`;
    window.location.href = lineAuthUrl;
  };

  return (
    <div className="login-page-container">
      <img src={gbcLogo} alt="Good Buy Costco Logo" className="login-logo" />
      <h1>歡迎來到好市多合購網</h1>
      {loading && <p>載入中...</p>}
      {error && <p className="error-message">{error}</p>}
      <div className="login-buttons">
        <button className="line-login-button" onClick={handleLineLogin} disabled={loading}>
          使用 Line 登入
        </button>
        <button className="dev-login-button" onClick={handleDevLogin} disabled={loading}>
          開發者登入 (UserId=1)
        </button>
      </div>
      <p className="note">
        首次登入或新用戶將會引導至個人資料設定頁面。
      </p>
    </div>
  );
};

export default LoginPage;
