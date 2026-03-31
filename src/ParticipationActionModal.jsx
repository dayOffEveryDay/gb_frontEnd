import { useState } from 'react';

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
  onCancelCampaign,
}) {
  const [isCancelConfirming, setIsCancelConfirming] = useState(false);

  if (!isOpen || !campaign) {
    return null;
  }

  const isHostMode = campaign.managementMode === 'HOST';
  const dashboard = campaign.dashboard ?? {};
  const participants = Array.isArray(dashboard.participants) ? dashboard.participants : [];
  const hasJoinedParticipants = participants.length > 0 || Number(dashboard.alreadySoldQuantity ?? 0) > 0;

  const cancelMessage = hasJoinedParticipants
    ? '目前已有參與者加入，取消團購單會扣除主揪信用分，確定要取消嗎？'
    : '確定要取消這張團購單嗎？';

  const handleClose = () => {
    setIsCancelConfirming(false);
    onClose();
  };

  const handleToggleCancelConfirm = () => {
    setIsCancelConfirming((current) => !current);
  };

  const handleConfirmCancel = () => {
    setIsCancelConfirming(false);
    onCancelCampaign();
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="participation-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={handleClose}>
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

            {hasJoinedParticipants && (
              <p className="inline-warning">取消團購單時，若已有參與者加入，會扣除主揪信用分。</p>
            )}

            {isCancelConfirming && (
              <div className="participation-confirm">
                <p>{cancelMessage}</p>
                <div className="participation-confirm-actions">
                  <button
                    type="button"
                    className="text-button danger"
                    onClick={handleConfirmCancel}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? '處理中...' : '確認取消'}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setIsCancelConfirming(false)}
                    disabled={isSubmitting}
                  >
                    返回
                  </button>
                </div>
              </div>
            )}
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
          {isHostMode ? (
            <button
              type="button"
              className="text-button danger"
              onClick={handleToggleCancelConfirm}
              disabled={isSubmitting}
            >
              {isCancelConfirming ? '收合取消提醒' : '取消團購單'}
            </button>
          ) : (
            <button type="button" className="text-button danger" onClick={onWithdraw} disabled={isSubmitting}>
              退出團購單
            </button>
          )}
          <button type="button" className="text-button" onClick={handleClose} disabled={isSubmitting}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

export default ParticipationActionModal;
