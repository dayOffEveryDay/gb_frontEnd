import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gbcLogo from './assets/gbcLogo.png';
import './LoginPage.css';
import {
  getFrontendBaseUrl,
  LINE_LOGIN_SUCCESS_MESSAGE,
  openLineLoginPopup,
} from './api';

// 獨立登入頁，主要提供 popup 版 LINE OAuth 入口。
function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // 接收 callback popup 回傳的登入成功訊息，成功後回首頁。
    const handleLineLoginMessage = (event) => {
      if (event.origin !== getFrontendBaseUrl()) {
        return;
      }

      if (event.data?.type !== LINE_LOGIN_SUCCESS_MESSAGE) {
        return;
      }

      setLoading(false);
      navigate('/', { replace: true });
    };

    window.addEventListener('message', handleLineLoginMessage);
    return () => window.removeEventListener('message', handleLineLoginMessage);
  }, [navigate]);

  // 開啟 LINE popup，授權流程與主頁登入 modal 共用同一套機制。
  const handleLineLogin = () => {
    setError('');
    setLoading(true);

    try {
      openLineLoginPopup();
    } catch (requestError) {
      setError(requestError.message);
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <img src={gbcLogo} alt="Good Buy Costco Logo" className="login-logo" />
      <h1>Good Buy Costco 登入</h1>
      {loading && <p>LINE 登入視窗已開啟，請在彈出視窗完成授權。</p>}
      {error && <p className="error-message">{error}</p>}
      <div className="login-buttons">
        <button className="line-login-button" onClick={handleLineLogin} disabled={loading}>
          使用 LINE 登入
        </button>
      </div>
      <p className="note">授權完成後，popup 會自動把 code 送到後端換 JWT，主頁不會跳到 callback 頁。</p>
    </div>
  );
}

export default LoginPage;
