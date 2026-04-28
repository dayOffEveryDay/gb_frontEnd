import { useRef, useState } from 'react';
import { ChatRoomsIcon, GhostIcon } from './Icons';

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
  onUnlockRevision,
  onKickParticipant,
  onOpenReview,
  reviewedReviewKeys = {},
  onOpenChat,
  canOpenChat,
  onOpenImageOrder,
  canReorderImages = false,
}) {
  const [isCancelConfirming, setIsCancelConfirming] = useState(false);
  const [pendingKickParticipant, setPendingKickParticipant] = useState(null);
  const [kickReasonDraft, setKickReasonDraft] = useState('');
  const [activeHostView, setActiveHostView] = useState(() =>
    campaign?.initialHostView === 'participants' ? 'participants' : 'overview'
  );
  const swipeStartXRef = useRef(null);
  const swipeStartYRef = useRef(null);

  const handleClose = () => {
    setIsCancelConfirming(false);
    setPendingKickParticipant(null);
    setKickReasonDraft('');
    setActiveHostView('overview');
    onClose();
  };

  const handleToggleCancelConfirm = () => {
    setIsCancelConfirming((current) => !current);
  };

  const handleConfirmCancel = () => {
    setIsCancelConfirming(false);
    onCancelCampaign();
  };

  const handleKickClick = (participant) => {
    const targetId = participant?.participantId ?? participant?.userId;
    const participantStatus = (participant?.status ?? '').toString().toUpperCase();

    if (!targetId || !onKickParticipant || participantStatus !== 'JOINED') {
      return;
    }

    setKickReasonDraft('');
    setPendingKickParticipant((current) =>
      current && (current.participantId ?? current.userId) === targetId ? null : participant
    );
  };

  const handleConfirmKick = () => {
    if (!pendingKickParticipant) {
      return;
    }

    onKickParticipant({
      participant: pendingKickParticipant,
      reason: kickReasonDraft,
    });
    setPendingKickParticipant(null);
    setKickReasonDraft('');
  };

  const handleOpenParticipants = () => {
    setPendingKickParticipant(null);
    setKickReasonDraft('');
    setActiveHostView('participants');
  };

  const handleBackToOverview = () => {
    setPendingKickParticipant(null);
    setKickReasonDraft('');
    setActiveHostView('overview');
  };

  if (!isOpen || !campaign) {
    return null;
  }

  const isHostMode = campaign.managementMode === 'HOST';
  const dashboard = campaign.dashboard ?? {};
  const participants = Array.isArray(dashboard.participants) ? dashboard.participants : [];
  const hasJoinedParticipants = participants.length > 0 || Number(dashboard.alreadySoldQuantity ?? 0) > 0;
  const status = (dashboard.status ?? campaign.status ?? '').toString().toUpperCase();
  const allowRevision = Boolean(dashboard.allowRevision ?? campaign.allowRevision);
  const canUnlockRevision = isHostMode && status.includes('FULL') && !allowRevision;
  const isDeliveredStatus = status === 'DELIVERED';
  const isParticipantReadOnly = !isHostMode && Boolean(campaign.isReadonlyParticipation || status === 'COMPLETED');
  const canReviewParticipants = isHostMode && ['DELIVERED', 'CONFIRMED', 'COMPLETED'].includes(status);

  const cancelMessage = hasJoinedParticipants
    ? '\u76ee\u524d\u5df2\u6709\u5718\u54e1\u53c3\u8207\uff0c\u53d6\u6d88\u5718\u8cfc\u6703\u4e00\u4f75\u901a\u77e5\u6240\u6709\u5718\u54e1\u4e26\u95dc\u9589\u5f8c\u7e8c\u64cd\u4f5c\u3002'
    : '\u53d6\u6d88\u5f8c\u9019\u7b46\u5718\u8cfc\u6703\u76f4\u63a5\u95dc\u9589\u3002';

  const handleTouchStart = (event) => {
    const touch = event.touches?.[0];
    swipeStartXRef.current = touch?.clientX ?? null;
    swipeStartYRef.current = touch?.clientY ?? null;
  };

  const handleTouchEnd = (event) => {
    const startX = swipeStartXRef.current;
    const startY = swipeStartYRef.current;
    const touch = event.changedTouches?.[0];

    swipeStartXRef.current = null;
    swipeStartYRef.current = null;

    if (startX == null || startY == null || !touch || !isHostMode) {
      return;
    }

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (Math.abs(deltaX) < 56 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    if (deltaX < 0 && activeHostView === 'overview') {
      handleOpenParticipants();
      return;
    }

    if (deltaX > 0 && activeHostView === 'participants') {
      handleBackToOverview();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div
        className="participation-modal"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
      >
        <div className="modal-top-row">
          <p className="eyebrow">{isHostMode ? '\u4e3b\u63ea\u7ba1\u7406' : '\u53c3\u8207\u7ba1\u7406'}</p>
          <button type="button" className="modal-close" onClick={handleClose}>
            {'\u95dc\u9589'}
          </button>
        </div>
        <div className="modal-title-row">
          <h2 className="modal-title">{campaign.itemName}</h2>
          <button
            type="button"
            className="small-icon-button"
            onClick={() => onOpenChat?.(campaign)}
            disabled={!canOpenChat || isSubmitting}
            title={canOpenChat ? '\u524d\u5f80\u804a\u5929\u5ba4' : '\u672a\u6eff\u55ae\u7121\u6cd5\u958b\u555f\u804a\u5929\u5ba4'}
            aria-label={'\u524d\u5f80\u804a\u5929\u5ba4'}
          >
            <ChatRoomsIcon />
          </button>
        </div>

        {isHostMode ? (
          <>
            <div
              className={activeHostView === 'participants' ? 'participation-host-pages is-participants' : 'participation-host-pages'}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <section className="participation-host-page">
                <div className="participation-panel">
                  <div className="participation-row">
                    <span className="participation-label">{'\u5be6\u969b\u7e3d\u6578\u91cf'}</span>
                    <strong>{dashboard.totalPhysicalQuantity ?? campaign.productTotalQuantity ?? 0}</strong>
                  </div>
                  <div className="participation-row">
                    <span className="participation-label">{'\u5df2\u552e\u51fa\u6578\u91cf'}</span>
                    <strong>{dashboard.alreadySoldQuantity ?? 0}</strong>
                  </div>
                  <div className="participation-row">
                    <span className="participation-label">{'\u76ee\u524d\u958b\u653e\u6578\u91cf'}</span>
                    <strong>{dashboard.openQuantity ?? 0}</strong>
                  </div>
                  <div className="participation-row">
                    <span className="participation-label">{'\u4e3b\u63ea\u4fdd\u7559\u6578\u91cf'}</span>
                    <strong>{dashboard.hostReservedQuantity ?? 0}</strong>
                  </div>
                  <label className="profile-field participation-field">
                    <span>{'\u4fee\u6539\u4e3b\u63ea\u4fdd\u7559\u6578\u91cf'}</span>
                    <input
                      type="number"
                      min="0"
                      value={quantityDraft}
                      onChange={(event) => onChangeQuantity(event.target.value)}
                    />
                  </label>
                  <div className={allowRevision ? 'participation-permission-card is-open' : 'participation-permission-card'}>
                    <div className="participation-permission-copy">
                      <span className="participation-permission-title">團員修改數量</span>
                      <span className="participation-permission-description">
                        {allowRevision ? '已開放，團員可自行調整認購數量。' : '目前未開放，滿單後可開放團員調整認購數量。'}
                      </span>
                    </div>
                    {allowRevision ? (
                      <span className="participation-permission-status">已開放</span>
                    ) : (
                      <button
                        type="button"
                        className="participation-permission-button"
                        onClick={() => onUnlockRevision?.(campaign.id)}
                        disabled={isSubmitting || !canUnlockRevision}
                      >
                        {isSubmitting ? '處理中...' : '開放修改'}
                      </button>
                    )}
                  </div>
                  {!status.includes('FULL') && !allowRevision && (
                    <p className="panel-note">{'\u5718\u8cfc\u9700\u5148\u6eff\u55ae\uff0c\u624d\u80fd\u958b\u555f\u6eff\u55ae\u5f8c\u4fee\u6539\u3002'}</p>
                  )}
                </div>

                <button type="button" className="participation-panel participation-link-panel" onClick={handleOpenParticipants}>
                  <div className="participation-row">
                    <span className="participation-label">{'\u5718\u54e1\u540d\u55ae'}</span>
                    <strong>{participants.length} {'\u4eba'}</strong>
                  </div>
                  <p className="participation-link-copy">{participants.length > 0 ? '\u67e5\u770b\u4e26\u7ba1\u7406\u5718\u54e1' : '\u76ee\u524d\u6c92\u6709\u5718\u54e1'}</p>
                </button>

                {canReorderImages && (
                  <button
                    type="button"
                    className="participation-panel participation-link-panel"
                    onClick={() => onOpenImageOrder?.(campaign)}
                    disabled={isSubmitting || !onOpenImageOrder}
                  >
                    <div className="participation-row">
                      <span className="participation-label">圖片順序</span>
                      <strong>{campaign.imageUrls?.length ?? 0} 張</strong>
                    </div>
                    <p className="participation-link-copy">調整封面與顯示順序</p>
                  </button>
                )}
              </section>

              <section className="participation-host-page participation-host-page-secondary">
                <div className="participation-subpage-header">
                  <button type="button" className="text-button participation-back-button" onClick={handleBackToOverview}>
                    {'\u8fd4\u56de'}
                  </button>
                  <strong>{'\u5718\u54e1\u540d\u55ae'}</strong>
                  <span>{participants.length} {'\u4eba'}</span>
                </div>

                <div className="participation-panel">
                  {participants.length > 0 ? (
                    <ul className="participation-list">
                      {participants.map((participant) => {
                        const participantKey = participant.participantId ?? participant.userId;
                        const isParticipantReviewed =
                          participant?.userId != null &&
                          Boolean(reviewedReviewKeys[`${Number(campaign.id)}:${Number(participant.userId)}`]);
                        const canKickParticipant = (participant.status ?? '').toString().toUpperCase() === 'JOINED';
                        const isKickRevealed =
                          canKickParticipant &&
                          participantKey != null &&
                          (pendingKickParticipant?.participantId ?? pendingKickParticipant?.userId) === participantKey;
                        const actionLabel = isDeliveredStatus ? '未到場' : '剔除';
                        const reasonLabel = isDeliveredStatus ? '未到場原因' : '剔除原因';
                        const reasonPlaceholder = isDeliveredStatus ? '例如：找不到人' : '可選填剔除原因';

                        return (
                          <li
                            key={`${participantKey}-${participant.displayName}`}
                            className={isKickRevealed ? 'participation-list-item is-kick-revealed' : 'participation-list-item'}
                          >
                            <div className="participation-list-top">
                              <button
                                type="button"
                                className="participation-kick-action"
                                onClick={handleConfirmKick}
                                disabled={isSubmitting || !isKickRevealed}
                              >
                                {isSubmitting && isKickRevealed ? '\u8655\u7406\u4e2d...' : actionLabel}
                              </button>
                              <div
                                className="participation-list-card"
                                onClick={() => {
                                  if (isKickRevealed) {
                                    setPendingKickParticipant(null);
                                    setKickReasonDraft('');
                                  }
                                }}
                              >
                                <div className="participation-member-copy">
                                  <span>{participant.displayName}</span>
                                  <strong>
                                    {participant.quantity} {'\u4ef6 / '} {participant.status || 'JOINED'}
                                  </strong>
                                </div>
                                <div className="participation-member-actions">
                                  {canReviewParticipants && onOpenReview && participant?.userId != null && (
                                    <button
                                      type="button"
                                      className="text-button participation-review-button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (isParticipantReviewed) {
                                          return;
                                        }
                                        onOpenReview({
                                          campaignId: campaign.id,
                                          revieweeId: participant.userId,
                                          revieweeName: participant.displayName,
                                          source: 'host',
                                        });
                                      }}
                                      disabled={isSubmitting || isParticipantReviewed}
                                      data-label={isParticipantReviewed ? '已評價' : '評價'}
                                    >
                                      評價
                                    </button>
                                  )}
                                  {canKickParticipant && (
                                    <button
                                      type="button"
                                      className="text-button danger participation-kick-button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleKickClick(participant);
                                      }}
                                      disabled={isSubmitting || !participantKey}
                                      title={`${isDeliveredStatus ? '\u6a19\u8a18\u672a\u5230\u5834' : '\u5254\u9664'} ${participant.displayName ?? '\u5718\u54e1'}`}
                                    >
                                      {isDeliveredStatus ? <GhostIcon /> : '\ud83d\uddd1'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            {isKickRevealed && (
                              <div className="participation-reason-panel">
                                <label className="profile-field participation-reason-field">
                                  <span>{reasonLabel}</span>
                                  <input
                                    type="text"
                                    value={kickReasonDraft}
                                    placeholder={reasonPlaceholder}
                                    onChange={(event) => setKickReasonDraft(event.target.value)}
                                  />
                                </label>
                                <div className="participation-reason-actions">
                                  <button
                                    type="button"
                                    className="text-button danger"
                                    onClick={handleConfirmKick}
                                    disabled={isSubmitting}
                                  >
                                    {isSubmitting ? '處理中...' : `確認${actionLabel}`}
                                  </button>
                                  <button
                                    type="button"
                                    className="text-button"
                                    onClick={() => {
                                      setPendingKickParticipant(null);
                                      setKickReasonDraft('');
                                    }}
                                    disabled={isSubmitting}
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="panel-note">{'\u76ee\u524d\u6c92\u6709\u5718\u54e1\u3002'}</p>
                  )}
                </div>
              </section>
            </div>

            {hasJoinedParticipants && (
              <p className="inline-warning">{'\u82e5\u8981\u53d6\u6d88\u6574\u7b46\u5718\u8cfc\uff0c\u7cfb\u7d71\u6703\u540c\u6b65\u901a\u77e5\u76ee\u524d\u6240\u6709\u5718\u54e1\u3002'}</p>
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
                    {isSubmitting ? '\u8655\u7406\u4e2d...' : '\u78ba\u8a8d\u53d6\u6d88\u5718\u8cfc'}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setIsCancelConfirming(false)}
                    disabled={isSubmitting}
                  >
                    {'\u8fd4\u56de'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="participation-panel">
            <div className="participation-row">
              <span className="participation-label">{'\u76ee\u524d\u8a8d\u8cfc\u6578\u91cf'}</span>
              <strong>{campaign.quantity}</strong>
            </div>
            <label className="profile-field participation-field">
              <span>{'\u4fee\u6539\u8a8d\u8cfc\u6578\u91cf'}</span>
              <input
                type="number"
                min="1"
                value={quantityDraft}
                onChange={(event) => onChangeQuantity(event.target.value)}
                disabled={isSubmitting || isParticipantReadOnly}
              />
            </label>
            {isParticipantReadOnly && (
              <p className="panel-note">{'\u6b64\u5718\u8cfc\u5df2\u5b8c\u6210\uff0c\u50c5\u53ef\u67e5\u770b\u8a8d\u8cfc\u8cc7\u8a0a\u3002'}</p>
            )}
          </div>
        )}

        {error && <p className="inline-error">{error}</p>}

        <div className="participation-actions">
          <button
            type="button"
            className="save-button"
            onClick={onSubmit}
            disabled={isSubmitting || isParticipantReadOnly}
          >
            {isSubmitting ? '\u8655\u7406\u4e2d...' : isHostMode ? '\u5132\u5b58\u4e3b\u63ea\u8abf\u6574' : '\u66f4\u65b0\u8a8d\u8cfc\u6578\u91cf'}
          </button>
          {isHostMode ? (
            <button
              type="button"
              className="text-button danger"
              onClick={handleToggleCancelConfirm}
              disabled={isSubmitting}
            >
              {isCancelConfirming ? '\u8fd4\u56de\u53d6\u6d88\u78ba\u8a8d' : '\u53d6\u6d88\u6574\u7b46\u5718\u8cfc'}
            </button>
          ) : (
            <button
              type="button"
              className="text-button danger"
              onClick={onWithdraw}
              disabled={isSubmitting || isParticipantReadOnly}
            >
              {'\u9000\u51fa\u5718\u8cfc'}
            </button>
          )}
          <button type="button" className="text-button" onClick={handleClose} disabled={isSubmitting}>
            {'\u53d6\u6d88'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ParticipationActionModal;
