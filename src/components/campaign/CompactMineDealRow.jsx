import { getMineCampaignBucket, getDealViewKey } from './campaignCardUtils';
import { AvatarIcon, DiagonalExpandIcon } from '../icons/Icons';

const MINE_CAMPAIGN_BUCKET_LABELS = {
  ACTIVE: '進行中',
  COMPLETED: '已完成',
  FAILED: '失敗',
  ISSUE: '異常',
  CANCELLED: '已取消',
};

export default function CompactMineDealRow({
  deal,
  index,
  labels,
  isHighlighted,
  onExpand,
  onOpenGallery,
  onOpenUserProfile,
}) {
  const statusBucket = getMineCampaignBucket(deal);
  const statusLabel = MINE_CAMPAIGN_BUCKET_LABELS[statusBucket] ?? statusBucket;
  const viewKey = getDealViewKey(deal, index);
  const hostName = deal.host?.displayName ?? labels.noValue;

  return (
    <article className={isHighlighted ? 'compact-deal-row compact-deal-row-highlighted' : 'compact-deal-row'}>
      <button
        type="button"
        className="compact-deal-image-button"
        onClick={() => onOpenGallery?.(deal, 0)}
        aria-label={`查看 ${deal.itemName} 圖片`}
      >
        <img src={deal.image} alt={deal.itemName} className="compact-deal-image" />
      </button>

      <div className="compact-deal-main">
        <strong className="compact-deal-title">{deal.itemName}</strong>
        <div className="compact-deal-host">
          <button
            type="button"
            className="compact-host-avatar"
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
            {deal.host?.profileImageUrl ? (
              <img src={deal.host.profileImageUrl} alt="" className="avatar-image" />
            ) : (
              <AvatarIcon />
            )}
          </button>
          <span>{hostName}</span>
        </div>
      </div>

      <span className={`compact-deal-status ${statusBucket.toLowerCase()}`}>{statusLabel}</span>

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
