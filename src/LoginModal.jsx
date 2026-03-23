function LoginModal({ labels, isOpen, authLoading, authError, onClose, onLineLogin }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          {labels.close}
        </button>
        <p className="eyebrow">{labels.login}</p>
        <h2 className="modal-title">{labels.loginPromptTitle}</h2>
        <p className="modal-copy">{labels.loginPromptBody}</p>
        <div className="auth-actions">
          <button type="button" className="line-login-button" onClick={onLineLogin} disabled={authLoading}>
            {labels.loginWithLine}
          </button>
        </div>
        {authError && <p className="inline-error">{authError}</p>}
      </div>
    </div>
  );
}

export default LoginModal;
