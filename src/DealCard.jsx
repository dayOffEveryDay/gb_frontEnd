import { AvatarIcon, ChatIcon, MoreIcon } from './Icons';

function DealCard({
  labels,
  deal,
  countdownNow,
  formatCountdown,
  formatDateTime,
  getScenarioLabel,
  getTypeClass,
  onJoin,
  onOpenGallery,
  onOpenChat,
  onOpenParticipation,
  showJoinAction = true,
}) {
  const isChatEnabled = typeof onOpenChat === 'function';
  const canManageParticipation = typeof onOpenParticipation === 'function';

  return (
    <article
      className={isChatEnabled ? 'deal-card deal-card-clickable' : 'deal-card'}
      onClick={isChatEnabled ? () => onOpenChat(deal) : undefined}
    >
      <div className="deal-upper">
        <button
          type="button"
          className="deal-image-wrap deal-image-button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenGallery(deal, 0);
          }}
        >
          <img src={deal.image} alt={deal.itemName} className="deal-image" />
          <span className="countdown-badge">
            倒數: {formatCountdown(deal.expireTime ?? deal.meetupTime, countdownNow)}
          </span>
          {deal.imageUrls?.length > 1 && <span className="deal-image-count">{deal.imageUrls.length} 張</span>}
        </button>

        <div className="deal-body">
          <div className="deal-title-row">
            <h3>{deal.itemName}</h3>
            <div className="deal-tag-row">
              <span className={`type-pill ${getTypeClass(deal.scenarioType)}`}>{getScenarioLabel(deal.scenarioType)}</span>
              <span className="type-pill category-pill">{deal.categoryName || labels.noValue}</span>
              <div className="deal-tag-actions">
                <button
                  type="button"
                  className={isChatEnabled ? 'chat-action-button' : 'chat-action-button disabled'}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (isChatEnabled) {
                      onOpenChat(deal);
                    }
                  }}
                  disabled={!isChatEnabled}
                  aria-label="開啟團購對話"
                  title={isChatEnabled ? '開啟團購對話' : '團購單尚未成立，暫時不能聊天'}
                >
                  <ChatIcon />
                </button>
                {canManageParticipation && (
                  <button
                    type="button"
                    className="chat-action-button more-action-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenParticipation(deal);
                    }}
                    aria-label="管理我的認購"
                    title="管理我的認購"
                  >
                    <MoreIcon />
                  </button>
                )}
              </div>
            </div>
          </div>

          <ul className="deal-metrics">
            <li>
              {labels.remaining}: {deal.availableQuantity} {labels.itemUnit}
            </li>
            <li>
              {labels.unitPrice}: NT$ {deal.pricePerUnit}
            </li>
            <li>
              {labels.storeName}: {deal.storeName || labels.noValue}
            </li>
          </ul>
        </div>
      </div>

      <div className="deal-lower">
        <div className="footer-item host-item">
          <span className="footer-label">{labels.leader}</span>
          <div className="host-summary">
            <span className="host-avatar">
              {deal.host?.profileImageUrl ? (
                <img src={deal.host.profileImageUrl} alt={deal.host.displayName || 'host avatar'} className="avatar-image" />
              ) : (
                <AvatarIcon />
              )}
            </span>
            <strong>{deal.host?.displayName ?? labels.noValue}</strong>
          </div>
        </div>
        <div className="footer-item">
          <span className="footer-label">{labels.creditScore}</span>
          <strong>{deal.host?.creditScore ?? labels.noValue}</strong>
        </div>
        <div className="footer-item place">
          <span className="footer-label">{labels.meetupPlace}</span>
          <div className="place-meta">
            <strong>{deal.meetupLocation || labels.noValue}</strong>
            {!showJoinAction && (
              <div className="deal-expire-inline">
                <span className="footer-label">截止時間</span>
                <strong>{formatDateTime(deal.expireTime)}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {showJoinAction && (
        <div className="deal-actions">
          <button
            type="button"
            className="join-campaign-button"
            onClick={(event) => {
              event.stopPropagation();
              onJoin(deal);
            }}
            disabled={deal.availableQuantity <= 0}
          >
            {deal.availableQuantity <= 0 ? labels.soldOut : labels.joinCampaign}
          </button>
        </div>
      )}
    </article>
  );
}

export default DealCard;
