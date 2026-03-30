function ParticipationActionModal({
  isOpen,
  campaign,
  quantityDraft,
  isSubmitting,
  error,
  onChangeQuantity,
  onClose,
  onSubmit,
  onWithdraw,
}) {
  if (!isOpen || !campaign) {
    return null;
  }

  const isHostMode = campaign.managementMode === 'HOST';
  const dashboard = campaign.dashboard ?? {};
  const participants = Array.isArray(dashboard.participants) ? dashboard.participants : [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="participation-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          關閉
        </button>
        <p className="eyebrow">{isHostMode ? '主揪管理' : '參與設定'}</p>
        <h2 className="modal-title">{campaign.itemName}</h2>

        {isHostMode ? (
          <>
            <div className="participation-panel">
              <div className="participation-row">
                <span className="participation-label">商品總數量</span>
                <strong>{dashboard.totalPhysicalQuantity ?? campaign.productTotalQuantity ?? 0}</strong>
              </div>
              <div className="participation-row">
                <span className="participation-label">已售出數量</span>
                <strong>{dashboard.alreadySoldQuantity ?? 0}</strong>
              </div>
              <div className="participation-row">
                <span className="participation-label">目前開放數量</span>
                <strong>{dashboard.openQuantity ?? 0}</strong>
              </div>
              <div className="participation-row">
                <span className="participation-label">目前自留數量</span>
                <strong>{dashboard.hostReservedQuantity ?? 0}</strong>
              </div>
              <label className="profile-field participation-field">
                <span>調整後自留數量</span>
                <input
                  type="number"
                  min="0"
                  value={quantityDraft}
                  onChange={(event) => onChangeQuantity(event.target.value)}
                />
              </label>
            </div>

            <div className="participation-panel">
              <div className="participation-row">
                <span className="participation-label">參與者名單</span>
                <strong>{participants.length} 人</strong>
              </div>
              {participants.length > 0 ? (
                <ul className="participation-list">
                  {participants.map((participant) => (
                    <li key={`${participant.userId}-${participant.displayName}`}>
                      <span>{participant.displayName}</span>
                      <strong>
                        {participant.quantity} 份 / {participant.status}
                      </strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-note">目前沒有參與者</p>
              )}
            </div>
          </>
        ) : (
          <div className="participation-panel">
            <div className="participation-row">
              <span className="participation-label">自己認購的數量</span>
              <strong>{campaign.quantity}</strong>
            </div>
            <label className="profile-field participation-field">
              <span>調整後數量</span>
              <input
                type="number"
                min="1"
                value={quantityDraft}
                onChange={(event) => onChangeQuantity(event.target.value)}
              />
            </label>
          </div>
        )}

        {error && <p className="inline-error">{error}</p>}

        <div className="participation-actions">
          <button type="button" className="save-button" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? '處理中...' : isHostMode ? '儲存自留調整' : '修改數量'}
          </button>
          {!isHostMode && (
            <button type="button" className="text-button danger" onClick={onWithdraw} disabled={isSubmitting}>
              退出團購單
            </button>
          )}
          <button type="button" className="text-button" onClick={onClose} disabled={isSubmitting}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

export default ParticipationActionModal;
