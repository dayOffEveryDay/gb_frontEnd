import { getDealViewKey } from './campaignCardUtils';
import { AvatarIcon, DiagonalExpandIcon } from '../icons/Icons';

export default function CompactDealRow({
  deal,
  index,
  labels,
  countdownNow,
  formatCountdown,
  formatDateTime,
  getScenarioLabel,
  getTypeClass,
  isHighlighted,
  onExpand,
  onOpenGallery,
  onOpenUserProfile,
}) {
  const viewKey = getDealViewKey(deal, index);
  const hostName = deal.host?.displayName ?? labels.noValue;
  const deadlineValue = deal.expireTime ?? deal.meetupTime;

  return (
    <article className={isHighlighted ? 'compact-market-row compact-market-row-highlighted' : 'compact-market-row'}>
      <button
        type="button"
        className="compact-market-image-button"
        onClick={() => onOpenGallery?.(deal, 0)}
        aria-label={`查看 ${deal.itemName} 圖片`}
      >
        <img src={deal.image} alt={deal.itemName} className="compact-market-image" />
      </button>

      <div className="compact-market-main">
        <div className="compact-market-title-row">
          <strong className="compact-market-title">{deal.itemName}</strong>
          <span className={`compact-market-type ${getTypeClass(deal.scenarioType)}`}>
            {getScenarioLabel(deal.scenarioType)}
          </span>
        </div>
        <div className="compact-market-meta">
          <span>NT$ {deal.pricePerUnit}</span>
          <span>剩 {deal.availableQuantity} 件</span>
          <span>{deal.storeName || labels.noValue}</span>
        </div>
        <div className="compact-market-bottom">
          <button
            type="button"
            className="compact-market-host"
            onClick={() =>
              onOpenUserProfile?.({
                id: deal.host?.id,
                displayName: deal.host?.displayName,
                profileImageUrl: deal.host?.profileImageUrl,
                creditScore: deal.host?.creditScore,
              })
            }
            disabled={!deal.host?.id || !onOpenUserProfile}
            aria-label={`查看 ${hostName} 的個人資料`}
            title="查看個人資料"
          >
            <span className="compact-host-avatar">
              {deal.host?.profileImageUrl ? (
                <img src={deal.host.profileImageUrl} alt="" className="avatar-image" />
              ) : (
                <AvatarIcon />
              )}
            </span>
            <span>{hostName}</span>
          </button>
          <span className="compact-market-deadline">
            <span className="compact-market-countdown">{formatCountdown(deadlineValue, countdownNow)}</span>
            <span>{formatDateTime(deadlineValue)}</span>
          </span>
        </div>
      </div>

      <button
        type="button"
        className="compact-expand-button"
        onClick={() => onExpand(viewKey)}
        aria-label={`放大 ${deal.itemName} 團購卡片`}
        title="放大"
      >
        <DiagonalExpandIcon />
      </button>
    </article>
  );
}
