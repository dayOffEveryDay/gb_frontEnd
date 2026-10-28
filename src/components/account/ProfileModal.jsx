import { useState } from 'react';
import { BulbIcon } from '../icons/Icons';
import PurchaseDeliveryProfilesModal from '../purchase/PurchaseDeliveryProfilesModal';

function ProfileModal({
  labels,
  token,
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
  const [isDeliveryProfilesOpen, setIsDeliveryProfilesOpen] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    setIsDeliveryProfilesOpen(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="login-modal profile-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={handleClose}>
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
          <button type="button" className="save-button" onClick={onSaveProfile} disabled={isSavingProfile}>
            {isSavingProfile ? labels.saving : labels.save}
          </button>
          <button type="button" className="text-button theme-toggle" onClick={onToggleTheme}>
            <BulbIcon />
            <span>
              {labels.theme}: {themeMode === 'dark' ? 'Dark' : 'Light'}
            </span>
          </button>

          <div className="profile-address-settings">
            <div>
              <strong>我的地址</strong>
              <span>管理面交、宅配、店到店與 i郵箱資料</span>
            </div>
            <button type="button" className="secondary-button" onClick={() => setIsDeliveryProfilesOpen(true)}>
              新增/編輯 我的地點
            </button>
          </div>
        </section>

        <PurchaseDeliveryProfilesModal
          isOpen={isDeliveryProfilesOpen}
          token={token}
          onClose={() => setIsDeliveryProfilesOpen(false)}
        />
      </div>
    </div>
  );
}

export default ProfileModal;
