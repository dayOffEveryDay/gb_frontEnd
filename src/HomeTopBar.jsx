import { AvatarIcon, BellIcon, RefreshIcon } from './Icons';

function HomeTopBar({
  labels,
  token,
  user,
  stores,
  activeStore,
  onChangeStore,
  onOpenProfile,
  onOpenNotifications,
  onRefresh,
  isRefreshing,
}) {
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

      <div className="store-selector">
        <span className="selector-label">{labels.currentStore}</span>
        <select value={activeStore} onChange={(event) => onChangeStore(Number(event.target.value))}>
          <option value={0}>{labels.all}</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
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
          <button
            type="button"
            className="notification-trigger icon-button"
            onClick={onOpenNotifications}
            aria-label="notifications"
          >
            <BellIcon />
          </button>
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
