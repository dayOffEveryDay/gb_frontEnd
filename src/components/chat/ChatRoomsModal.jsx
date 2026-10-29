import useChatRoomListView from '../../features/chat/useChatRoomListView';
import { getChatRoomUnreadCount, isChatRoomEnded, isChatRoomReadOnly } from '../../chatRoomSorting';

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
      readOnly: isChatRoomReadOnly(room),
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
    readOnly: isChatRoomReadOnly(room),
  };
}

function ChatRoomsContent({ labels, chatRooms, isLoading, error, onClose, onOpenChat, listView }) {
  const { activeTab, changeTab, panelRef, rememberScroll } = listView;
  const tabs = [
    { key: 'active', label: '進行中', rooms: chatRooms.filter((room) => !isChatRoomEnded(room)) },
    { key: 'ended', label: '已結束', rooms: chatRooms.filter(isChatRoomEnded) },
  ];
  const visibleRooms = tabs.find((tab) => tab.key === activeTab).rooms;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={panelRef} className="login-modal chat-room-modal" onScroll={rememberScroll} onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <h2 className="modal-title notification-title">聊天室</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            {labels.close}
          </button>
        </div>

        <p className="chat-room-intro">你建立或參與的團購與託購聊天室會集中顯示在這裡。</p>

        <div className="notification-tabs" role="tablist" aria-label="聊天室交易狀態">
          {tabs.map((tab) => {
            const unread = tab.rooms.reduce((total, room) => total + getChatRoomUnreadCount(room), 0);
            return <button key={tab.key} type="button" role="tab"
              id={`chat-tab-${tab.key}`} aria-selected={activeTab === tab.key}
              aria-controls="chat-room-panel"
              className={`notification-tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => changeTab(tab.key)}>
              {tab.label}
              {unread > 0 && <span className="chat-room-tab-unread" aria-label={`${unread} 則未讀`}>{unread > 99 ? '99+' : unread}</span>}
            </button>;
          })}
        </div>

        <div className="chat-room-list" id="chat-room-panel" role="tabpanel" aria-labelledby={`chat-tab-${activeTab}`}>
          {isLoading && <p className="muted-copy">載入聊天室中...</p>}
          {!isLoading && error && <p className="inline-error">{error}</p>}
          {!isLoading && visibleRooms.length === 0 && !error && <p className="muted-copy">{activeTab === 'active' ? '目前沒有進行中的聊天室。' : '目前沒有已結束的聊天室。'}</p>}
          {!isLoading &&
            visibleRooms.map((room) => {
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
                    {view.readOnly && <span className="purchase-chat-readonly-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>唯讀</span>}
                  </div>
                  <button
                    type="button"
                    className={hasUnread ? 'text-button chat-room-open-button has-unread' : 'text-button chat-room-open-button'}
                    onClick={() => {
                      rememberScroll();
                      onOpenChat(room);
                    }}
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

export default function ChatRoomsModal(props) {
  const listView = useChatRoomListView(props);
  return props.isOpen ? <ChatRoomsContent {...props} listView={listView} /> : null;
}
