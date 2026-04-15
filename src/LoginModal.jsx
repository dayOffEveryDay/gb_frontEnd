import { useState } from 'react';
import gbcLogo from './assets/gbcLogo.png';

function LoginModal({ labels, isOpen, authLoading, authError, onClose, onLineLogin, onDevLogin }) {
  const [isDevMode, setIsDevMode] = useState(false);
  const [devUserId, setDevUserId] = useState('4');

  if (!isOpen) {
    return null;
  }

  const handleSubmitDevLogin = (event) => {
    event.preventDefault();
    onDevLogin?.(devUserId);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          {labels.close}
        </button>
        <div className="login-brandmark" aria-hidden="true">
          <img src={gbcLogo} alt="" className="login-brandmark-image" />
        </div>
        <div className="auth-actions">
          <button type="button" className="line-login-button" onClick={onLineLogin} disabled={authLoading}>
            {labels.loginWithLine}
          </button>
          <button
            type="button"
            className="text-button dev-login-toggle"
            onClick={() => setIsDevMode((current) => !current)}
            disabled={authLoading}
          >
            開發者登入模式
          </button>
          {isDevMode && (
            <form className="dev-login-panel" onSubmit={handleSubmitDevLogin}>
              <label className="profile-field">
                <span>userId</span>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={devUserId}
                  onChange={(event) => setDevUserId(event.target.value)}
                  disabled={authLoading}
                />
              </label>
              <button type="submit" className="save-button" disabled={authLoading || !devUserId.trim()}>
                {authLoading ? '登入中...' : '使用開發者登入'}
              </button>
            </form>
          )}
        </div>
        {authError && <p className="inline-error">{authError}</p>}
      </div>
    </div>
  );
}

export default LoginModal;
