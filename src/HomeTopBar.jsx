import { useMemo, useState } from 'react';
import { AvatarIcon, BellIcon, ChatRoomsIcon, RefreshIcon } from './Icons';

function HomeTopBar({
  labels,
  token,
  user,
  stores,
  activeStoreIds = [],
  chatUnreadRoomCount = 0,
  unreadCount = 0,
  onChangeStores,
  onOpenProfile,
  onOpenChatRooms,
  onOpenNotifications,
  onRefresh,
  isRefreshing,
}) {
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
  const selectedStoreIds = useMemo(() => activeStoreIds.map((id) => Number(id)).filter(Boolean), [activeStoreIds]);
  const selectedStoreIdSet = useMemo(() => new Set(selectedStoreIds), [selectedStoreIds]);
  const storeLabel = useMemo(() => {
    if (selectedStoreIds.length === 0) {
      return labels.all;
    }

    if (selectedStoreIds.length === 1) {
      return stores.find((store) => Number(store.id) === selectedStoreIds[0])?.name ?? labels.all;
    }

    return `${selectedStoreIds.length} 間`;
  }, [labels.all, selectedStoreIds, stores]);

  const toggleStore = (storeId) => {
    const normalizedStoreId = Number(storeId);
    if (!normalizedStoreId) {
      onChangeStores?.([]);
      return;
    }

    const nextIds = selectedStoreIdSet.has(normalizedStoreId)
      ? selectedStoreIds.filter((id) => id !== normalizedStoreId)
      : [...selectedStoreIds, normalizedStoreId];
    onChangeStores?.(nextIds);
  };

  return (
    <header className={token ? 'topbar' : 'topbar guest-topbar'}>
      <button
        type="button"
        className={token ? 'profile-trigger icon-button' : 'icon-chip profile-trigger login-chip'}
        onClick={onOpenProfile}
        aria-label={token ? 'profile' : 'login'}
      >
        <span className="avatar-circle">
          {user?.profileImageUrl ? (
            <img src={user.profileImageUrl} alt={user.displayName || 'avatar'} className="avatar-image" />
          ) : (
            <AvatarIcon />
          )}
        </span>
        {!token && <span className="login-chip-label">{labels.login}</span>}
      </button>

      <div
        className="store-selector"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsStoreMenuOpen(false);
          }
        }}
      >
        <button
          type="button"
          className="store-selector-trigger"
          onClick={() => setIsStoreMenuOpen((current) => !current)}
          aria-haspopup="listbox"
          aria-expanded={isStoreMenuOpen}
        >
          <span className="selector-label">{labels.currentStore}</span>
          <span className="store-selector-value">{storeLabel}</span>
          <span className="store-selector-chevron" aria-hidden="true"></span>
        </button>
        {isStoreMenuOpen && (
          <div className="store-selector-menu" role="listbox" aria-label="門市">
            <label className="store-selector-option">
              <input type="checkbox" checked={selectedStoreIds.length === 0} onChange={() => onChangeStores?.([])} />
              <span>{labels.all}</span>
            </label>
            {stores.map((store) => {
              const storeId = Number(store.id);
              return (
                <label key={store.id} className="store-selector-option">
                  <input
                    type="checkbox"
                    checked={selectedStoreIdSet.has(storeId)}
                    onChange={() => toggleStore(storeId)}
                  />
                  <span>{store.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className={`refresh-trigger icon-button desktop-only${isRefreshing ? ' spinning' : ''}`}
          onClick={onRefresh}
          aria-label="refresh"
          disabled={isRefreshing}
          title="重新整理"
        >
          <RefreshIcon />
        </button>

        {token ? (
          <>
            <button
              type="button"
              className="chat-room-trigger icon-button"
              onClick={onOpenChatRooms}
              aria-label="聊天室"
              title="聊天室"
            >
              <ChatRoomsIcon />
              {chatUnreadRoomCount > 0 && (
                <span className="notification-badge">{chatUnreadRoomCount > 99 ? '99+' : chatUnreadRoomCount}</span>
              )}
            </button>

            <button
              type="button"
              className="notification-trigger icon-button"
              onClick={onOpenNotifications}
              aria-label="notifications"
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
          </>
        ) : (
          <div className="topbar-side right">
            <span className="panel-note">{labels.latestMessages}</span>
          </div>
        )}
      </div>
    </header>
  );
}

export default HomeTopBar;
