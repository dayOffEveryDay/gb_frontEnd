function formatChatRoomTime(value) {
  if (!value) {
    return '';
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

function getCampaignRoomTime(room) {
  return (
    room?.establishedAt ??
    room?.established_at ??
    room?.formedAt ??
    room?.formed_at ??
    room?.fullAt ??
    room?.full_at ??
    room?.chatCreatedAt ??
    room?.chat_created_at ??
    room?.meetupTime ??
    room?.meetup_time ??
    room?.expireTime ??
    room?.expire_time ??
    ''
  );
}

function getCampaignStatusLabel(room) {
  const status = (room?.status ?? room?.campaignStatus ?? room?.campaign_status ?? '').toString().toUpperCase();

  if (status.includes('COMPLETED')) return '已完成';
  if (status.includes('CONFIRMED')) return '已確認';
  if (status.includes('DELIVERED')) return '已交付';
  if (status.includes('FULL')) return '已成團';
  return '團購聊天室';
}

function getRoomView(room) {
  if (room?.roomType === 'PURCHASE') {
    return {
      key: `purchase-${room.id}`,
      title: room.itemName || '託購聊天室',
      subtitle: room.counterpartName ? `交易對象：${room.counterpartName}` : '託購聊天室',
      badge: '託購',
      image: room.counterpartAvatarUrl || '',
      unreadCount: Number(room.unreadCount ?? room.unreadMessageCount ?? 0),
      time: room.lastMessage?.createdAt ?? room.updatedAt ?? '',
      preview: room.lastMessage?.content ?? '',
      readOnly: Boolean(room.readOnly),
    };
  }

  return {
    key: `campaign-${room.id ?? room.campaignId}`,
    title: room.itemName || '團購聊天室',
    subtitle: room.host?.displayName ? `主揪：${room.host.displayName}` : getCampaignStatusLabel(room),
    badge: '團購',
    image: room.image || '',
    unreadCount: Number(room.unreadMessageCount ?? 0),
    time: getCampaignRoomTime(room),
    preview: '',
    readOnly: false,
  };
}

function ChatRoomsModal({ labels, isOpen, chatRooms, isLoading, error, onClose, onOpenChat }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal chat-room-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <h2 className="modal-title notification-title">聊天室</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            {labels.close}
          </button>
        </div>

        <p className="chat-room-intro">團購與託購成立後的聊天室會集中顯示在這裡。</p>

        <div className="chat-room-list">
          {isLoading && <p className="muted-copy">載入聊天室中...</p>}
          {!isLoading && error && <p className="inline-error">{error}</p>}
          {!isLoading && chatRooms.length === 0 && !error && <p className="muted-copy">目前沒有可開啟的聊天室。</p>}
          {!isLoading &&
            chatRooms.map((room) => {
              const view = getRoomView(room);
              const timeLabel = formatChatRoomTime(view.time);
              const hasUnread = view.unreadCount > 0;

              return (
                <article key={view.key} className={hasUnread ? 'chat-room-item has-unread' : 'chat-room-item'}>
                  {view.image ? (
                    <img src={view.image} alt="" className="chat-room-image" />
                  ) : (
                    <div className="chat-room-image purchase-chat-room-placeholder" aria-hidden="true">
                      {view.badge.slice(0, 1)}
                    </div>
                  )}
                  <div className="chat-room-copy">
                    <div className="chat-room-title-row">
                      <strong>{view.title}</strong>
                      <span className="purchase-chat-room-type">{view.badge}</span>
                      {hasUnread && (
                        <span className="chat-room-unread-badge">
                          {view.unreadCount > 99 ? '99+ 則' : `${view.unreadCount} 則`}
                        </span>
                      )}
                    </div>
                    <span>{view.subtitle}</span>
                    {view.preview && <span className="purchase-chat-room-preview">{view.preview}</span>}
                    {timeLabel && <time>{timeLabel}</time>}
                    {view.readOnly && <span className="purchase-chat-readonly-label">唯讀</span>}
                  </div>
                  <button
                    type="button"
                    className={hasUnread ? 'text-button chat-room-open-button has-unread' : 'text-button chat-room-open-button'}
                    onClick={() => onOpenChat(room)}
                  >
                    開啟
                  </button>
                </article>
              );
            })}
        </div>
      </div>
    </div>
  );
}

export default ChatRoomsModal;
