import { ChatIcon } from './Icons';

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
  onNotificationAction,
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
          {!isLoading && !error && notifications.length === 0 && <p className="muted-copy">目前沒有未讀通知。</p>}
          {!isLoading &&
            !error &&
            notifications.map((notification) => {
              const canOpenChat = notification.type === 'CAMPAIGN_FULL' && notification.referenceId != null;
              const canOpenReview = notification.type === 'CAMPAIGN_COMPLETED' && notification.referenceId != null;
              const hasAction = canOpenChat || canOpenReview;

              return (
                <article key={notification.id ?? `${notification.type}-${notification.createdAt}`} className="notification-item">
                  <div className="notification-item-copy">
                    <strong>{notification.typeLabel}</strong>
                    <p>{notification.content}</p>
                    <time>{formatNotificationTime(notification.createdAt)}</time>
                  </div>
                  <button
                    type="button"
                    className={canOpenChat ? 'small-icon-button' : 'text-button'}
                    onClick={() => onNotificationAction(notification)}
                    aria-label={canOpenChat ? '前往聊天室' : canOpenReview ? '前往評價' : '標記已讀'}
                    title={canOpenChat ? '前往聊天室' : canOpenReview ? '前往評價' : '標記已讀'}
                  >
                    {canOpenChat ? <ChatIcon /> : hasAction ? '前往評價' : '標記已讀'}
                  </button>
                </article>
              );
            })}
        </div>
      </div>
    </div>
  );
}

export default NotificationsModal;
