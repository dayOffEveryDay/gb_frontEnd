import { AvatarIcon, ChatRoomsIcon, MoreIcon } from './Icons';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function interpolateRgb(start, end, progress) {
  const nextProgress = clamp(progress, 0, 1);
  const [startRed, startGreen, startBlue] = start;
  const [endRed, endGreen, endBlue] = end;

  return `rgb(${Math.round(startRed + (endRed - startRed) * nextProgress)}, ${Math.round(
    startGreen + (endGreen - startGreen) * nextProgress
  )}, ${Math.round(startBlue + (endBlue - startBlue) * nextProgress)})`;
}

function getRemainingQuantityStyle(deal) {
  const available = Number(deal?.availableQuantity ?? 0);
  if (!Number.isFinite(available) || available <= 0) {
    return undefined;
  }

  if (available <= 1) {
    return {
      color: 'rgb(220, 38, 38)',
      fontWeight: 900,
    };
  }

  const baselineSource = Number(
    deal?.openQuantity ??
      deal?.open_quantity ??
      deal?.totalQuantity ??
      deal?.total_quantity ??
      deal?.productTotalQuantity ??
      deal?.product_total_quantity ??
      0
  );
  const baseline = Math.max(available, baselineSource);

  if (!Number.isFinite(baseline) || baseline <= 0) {
    return undefined;
  }

  const ratio = available / baseline;
  if (ratio > 0.3) {
    return undefined;
  }

  return {
    color: interpolateRgb([245, 158, 11], [220, 38, 38], (0.3 - ratio) / 0.3),
    fontWeight: 800,
  };
}

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
  onOpenUserProfile,
  showJoinAction = true,
  isHighlighted = false,
}) {
  const isChatEnabled = typeof onOpenChat === 'function';
  const canManageParticipation = typeof onOpenParticipation === 'function';
  const statusSource = (deal.status ?? deal.campaignStatus ?? deal.campaign_status ?? deal.state ?? '').toString().toUpperCase();
  const isSoldOut = statusSource.includes('FULL') || Number(deal.availableQuantity) <= 0;
  const hasJoinAction = showJoinAction && !isSoldOut;
  const remainingQuantityStyle = getRemainingQuantityStyle(deal);

  const handleOpenUserProfile = (event) => {
    event.stopPropagation();
    onOpenUserProfile?.({
      id: deal.host?.id,
      displayName: deal.host?.displayName,
      profileImageUrl: deal.host?.profileImageUrl,
      creditScore: deal.host?.creditScore,
    });
  };

  return (
    <article
      id={`deal-card-${deal.id}`}
      className={[
        isChatEnabled ? 'deal-card deal-card-clickable' : 'deal-card',
        hasJoinAction ? 'deal-card-with-actions' : '',
        isHighlighted ? 'deal-card-highlighted' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={isChatEnabled ? () => onOpenChat(deal) : undefined}
    >
      {isSoldOut && (
        <span className="deal-full-stamp" aria-hidden="true">
          <span className="deal-full-stamp-badge">滿</span>
        </span>
      )}

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
              {canManageParticipation && (
                <div className="deal-tag-actions">
                  <button
                    type="button"
                    className="chat-action-button more-action-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenParticipation(deal);
                    }}
                    aria-label="管理團購"
                    title="管理團購"
                  >
                    <MoreIcon />
                  </button>
                </div>
              )}
            </div>
          </div>

          <ul className="deal-metrics">
            <li>
              {labels.remaining}:{' '}
              <span className="deal-metric-value" style={remainingQuantityStyle}>
                {deal.availableQuantity} {labels.itemUnit}
              </span>
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
            <button
              type="button"
              className="host-avatar host-avatar-button"
              onClick={handleOpenUserProfile}
              disabled={!deal.host?.id || !onOpenUserProfile}
              aria-label={`查看 ${deal.host?.displayName ?? '使用者'} 的個人資料`}
              title="查看個人資料"
            >
              {deal.host?.profileImageUrl ? (
                <img src={deal.host.profileImageUrl} alt={deal.host.displayName || 'host avatar'} className="avatar-image" />
              ) : (
                <AvatarIcon />
              )}
            </button>
            <strong>{deal.host?.displayName ?? labels.noValue}</strong>
            {isChatEnabled && (
              <button
                type="button"
                className="chat-action-button host-chat-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenChat(deal);
                }}
                aria-label="前往團購聊天室"
                title="前往團購聊天室"
              >
                <ChatRoomsIcon />
              </button>
            )}
          </div>
        </div>
        <div className="footer-item credit-item">
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
                <strong>{formatDateTime(deal.expireTime ?? deal.meetupTime)}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {hasJoinAction && (
        <div className="deal-actions">
          <button
            type="button"
            className="join-campaign-button"
            aria-label={labels.joinCampaign}
            title={labels.joinCampaign}
            onClick={(event) => {
              event.stopPropagation();
              onJoin(deal);
            }}
          >
            <span className="join-campaign-symbol" aria-hidden="true">+1</span>
          </button>
        </div>
      )}
    </article>
  );
}

export default DealCard;
