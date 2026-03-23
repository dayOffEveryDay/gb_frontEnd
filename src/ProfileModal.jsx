import { BulbIcon } from './Icons';

function ProfileModal({
  labels,
  user,
  profileDraft,
  isOpen,
  isSavingProfile,
  themeMode,
  onClose,
  onLogout,
  onSaveProfile,
  setProfileDraft,
  onToggleTheme,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal profile-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          {labels.close}
        </button>
        <div className="panel-header">
          <div>
            <p className="eyebrow">{labels.account}</p>
            <h2>{user?.displayName ?? labels.guestState}</h2>
          </div>
          <button type="button" className="text-button" onClick={onLogout}>
            {labels.logout}
          </button>
        </div>

        <section className="panel-section">
          <div className="section-title-row">
            <h3>{labels.memberInfo}</h3>
          </div>
          <label className="profile-field">
            <span>{labels.displayName}</span>
            <input
              type="text"
              value={profileDraft.displayName}
              onChange={(event) =>
                setProfileDraft((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
            />
          </label>
          <label className="switch-row">
            <span>{labels.membershipCard}</span>
            <input
              type="checkbox"
              checked={profileDraft.hasCostcoMembership}
              onChange={(event) =>
                setProfileDraft((current) => ({
                  ...current,
                  hasCostcoMembership: event.target.checked,
                }))
              }
            />
          </label>
          <button type="button" className="save-button" onClick={onSaveProfile} disabled={isSavingProfile}>
            {isSavingProfile ? labels.saving : labels.save}
          </button>
          <button type="button" className="text-button theme-toggle" onClick={onToggleTheme}>
            <BulbIcon />
            <span>
              {labels.theme}: {themeMode === 'dark' ? 'Dark' : 'Light'}
            </span>
          </button>
        </section>
      </div>
    </div>
  );
}

export default ProfileModal;
