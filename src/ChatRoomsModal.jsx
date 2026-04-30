function getChatRoomStatusLabel(campaign) {
  const status = (campaign?.status ?? campaign?.campaignStatus ?? campaign?.campaign_status ?? '')
    .toString()
    .toUpperCase();

  if (status.includes('DELIVERED')) {
    return '已交付';
  }

  if (status.includes('CONFIRMED')) {
    return '已確認';
  }

  if (status.includes('COMPLETED')) {
    return '已完成';
  }

  if (status.includes('FULL')) {
    return '已成團';
  }

  return '進行中';
}

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

function getChatRoomEstablishedTime(campaign) {
  return (
    campaign?.establishedAt ??
    campaign?.established_at ??
    campaign?.formedAt ??
    campaign?.formed_at ??
    campaign?.fullAt ??
    campaign?.full_at ??
    campaign?.campaignFullAt ??
    campaign?.campaign_full_at ??
    campaign?.chatCreatedAt ??
    campaign?.chat_created_at ??
    campaign?.chatOpenedAt ??
    campaign?.chat_opened_at ??
    ''
  );
}

function getChatRoomTime(campaign) {
  return (
    getChatRoomEstablishedTime(campaign) ||
    campaign?.meetupTime ||
    campaign?.meetup_time ||
    campaign?.expireTime ||
    campaign?.expire_time ||
    ''
  );
}

function ChatRoomsModal({
  labels,
  isOpen,
  chatRooms,
  isLoading,
  error,
  onClose,
  onOpenChat,
}) {
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

        <p className="chat-room-intro">這裡會顯示目前仍可進入的聊天室，未讀房間會特別標示。</p>

        <div className="chat-room-list">
          {isLoading && <p className="muted-copy">載入聊天室中...</p>}
          {!isLoading && error && <p className="inline-error">{error}</p>}
          {!isLoading && chatRooms.length === 0 && !error && (
            <p className="muted-copy">目前沒有可進入的聊天室。</p>
          )}
          {!isLoading &&
            chatRooms.map((room) => {
              const timeLabel = formatChatRoomTime(getChatRoomTime(room));
              const unreadCount = Number(room?.unreadMessageCount ?? 0);
              const hasUnread = unreadCount > 0;

              return (
                <article
                  key={room.id ?? room.campaignId}
                  className={hasUnread ? 'chat-room-item has-unread' : 'chat-room-item'}
                >
                  <img src={room.image} alt={room.itemName} className="chat-room-image" />
                  <div className="chat-room-copy">
                    <div className="chat-room-title-row">
                      <strong>{room.itemName}</strong>
                      {hasUnread && (
                        <span className="chat-room-unread-badge">
                          {unreadCount > 99 ? '99+ 未讀' : `${unreadCount} 未讀`}
                        </span>
                      )}
                    </div>
                    <span>
                      {room.host?.displayName ? `團主：${room.host.displayName}` : getChatRoomStatusLabel(room)}
                    </span>
                    {timeLabel && <time>{`時間：${timeLabel}`}</time>}
                  </div>
                  <button
                    type="button"
                    className={hasUnread ? 'text-button chat-room-open-button has-unread' : 'text-button chat-room-open-button'}
                    onClick={() => onOpenChat(room)}
                  >
                    查看
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
