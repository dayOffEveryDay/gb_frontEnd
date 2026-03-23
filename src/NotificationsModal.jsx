function NotificationsModal({ labels, isOpen, onClose }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal notification-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          {labels.close}
        </button>
        <p className="eyebrow">{labels.notificationsTitle}</p>
        <h2 className="modal-title">{labels.latestMessages}</h2>
        <p className="modal-copy">{labels.notificationsBody}</p>
      </div>
    </div>
  );
}

export default NotificationsModal;
