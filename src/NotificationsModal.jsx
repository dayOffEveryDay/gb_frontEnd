function formatNotificationTime(value) {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function NotificationsModal({
  labels,
  isOpen,
  notifications,
  isLoading,
  error,
  onClose,
  onReadNotification,
}) {
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

        <div className="notification-list">
          {isLoading && <p className="muted-copy">載入通知中...</p>}
          {!isLoading && error && <p className="inline-error">{error}</p>}
          {!isLoading && !error && notifications.length === 0 && (
            <p className="muted-copy">目前沒有未讀通知</p>
          )}
          {!isLoading &&
            !error &&
            notifications.map((notification) => (
              <article key={notification.id} className="notification-item">
                <div className="notification-item-copy">
                  <strong>{notification.typeLabel}</strong>
                  <p>{notification.content}</p>
                  <time>{formatNotificationTime(notification.createdAt)}</time>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onReadNotification(notification.id)}
                >
                  標記已讀
                </button>
              </article>
            ))}
        </div>
      </div>
    </div>
  );
}

export default NotificationsModal;
