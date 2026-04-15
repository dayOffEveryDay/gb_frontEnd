import { useState } from 'react';
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

function getNotificationAction(notification, isReadTab) {
  const canOpenChat = notification.type === 'CAMPAIGN_FULL' && notification.referenceId != null;
  const canOpenReview = notification.type === 'CAMPAIGN_COMPLETED' && notification.referenceId != null;
  const hasAction = canOpenChat || canOpenReview;

  if (!hasAction && isReadTab) {
    return null;
  }

  return {
    canOpenChat,
    canOpenReview,
    hasAction,
    label: canOpenChat ? '前往聊天室' : canOpenReview ? '前往評價' : '標為已讀',
  };
}

function NotificationsModal({
  labels,
  isOpen,
  notifications,
  readNotifications = [],
  isLoading,
  isReadLoading = false,
  error,
  readError = '',
  onClose,
  onNotificationAction,
}) {
  const [activeTab, setActiveTab] = useState('unread');

  if (!isOpen) {
    return null;
  }

  const isReadTab = activeTab === 'read';
  const visibleNotifications = isReadTab ? readNotifications : notifications;
  const visibleLoading = isReadTab ? isReadLoading : isLoading;
  const visibleError = isReadTab ? readError : error;
  const emptyCopy = isReadTab ? '目前沒有已讀通知。' : '目前沒有未讀通知。';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal notification-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <h2 className="modal-title notification-title">通知中心</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            {labels.close}
          </button>
        </div>

        <div className="notification-tabs" role="tablist" aria-label="通知分類">
          <button
            type="button"
            className={activeTab === 'unread' ? 'notification-tab active' : 'notification-tab'}
            onClick={() => setActiveTab('unread')}
          >
            未讀
          </button>
          <button
            type="button"
            className={activeTab === 'read' ? 'notification-tab active' : 'notification-tab'}
            onClick={() => setActiveTab('read')}
          >
            已讀
          </button>
        </div>

        <div className="notification-list">
          {visibleLoading && <p className="muted-copy">載入通知中...</p>}
          {!visibleLoading && visibleError && <p className="inline-error">{visibleError}</p>}
          {!visibleLoading && !visibleError && visibleNotifications.length === 0 && (
            <p className="muted-copy">{emptyCopy}</p>
          )}
          {!visibleLoading &&
            !visibleError &&
            visibleNotifications.map((notification) => {
              const action = getNotificationAction(notification, isReadTab);

              return (
                <article key={notification.id ?? `${notification.type}-${notification.createdAt}`} className="notification-item">
                  <div className="notification-item-copy">
                    <strong>{notification.typeLabel}</strong>
                    <p>{notification.content}</p>
                    <time>{formatNotificationTime(notification.createdAt)}</time>
                  </div>
                  {action && (
                    <button
                      type="button"
                      className={action.canOpenChat ? 'small-icon-button' : 'text-button'}
                      onClick={() => onNotificationAction(notification)}
                      aria-label={action.label}
                      title={action.label}
                    >
                      {action.canOpenChat ? <ChatIcon /> : action.hasAction ? '前往' : '已讀'}
                    </button>
                  )}
                </article>
              );
            })}
        </div>
      </div>
    </div>
  );
}

export default NotificationsModal;
