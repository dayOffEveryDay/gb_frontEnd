function getLiveNotificationTone(notification) {
  const type = (notification?.type ?? '').toString().toUpperCase();

  if (type.includes('CANCEL') || type.includes('KICK') || type.includes('FAIL') || type.includes('NO_SHOW') || type.includes('DISPUT')) {
    return 'danger';
  }

  if (type.includes('COMPLETE') || type.includes('CONFIRM')) {
    return 'success';
  }

  if (type.includes('FULL') || type.includes('DELIVER')) {
    return 'primary';
  }

  return 'neutral';
}

export default function LiveNotificationStack({
  notifications: liveNotifications,
  onAction: handleLiveNotificationAction,
  onDismiss: dismissLiveNotification,
}) {
  return (
    <div className="live-notification-stack" aria-live="polite" aria-atomic="false">
      {liveNotifications.map((notification) => (
        <article
          key={notification.toastKey}
          className={`live-notification-card ${getLiveNotificationTone(notification)}`}
        >
          <button
            type="button"
            className="live-notification-card-body"
            onClick={() => void handleLiveNotificationAction(notification)}
          >
            <strong>{notification.typeLabel}</strong>
            <span>{notification.content}</span>
          </button>
          <button
            type="button"
            className="live-notification-card-close"
            onClick={() => dismissLiveNotification(notification.toastKey)}
            aria-label="關閉提示"
            title="關閉"
          >
            ×
          </button>
        </article>
      ))}
    </div>
  );
}
