import { LABELS } from '../../homeConfig';
import { getDealViewKey } from './campaignCardUtils';
import { formatCountdown, formatDateTime, getScenarioLabel, getTypeClass } from '../../homeUtils';
import { shareCampaign } from '../../shareUtils';
import CompactMineDealRow from './CompactMineDealRow';
import CompactDealRow from './CompactDealRow';
import DealCard from './DealCard';

export default function CampaignList({
  isCompactDealList,
  isMineCompactList,
  isReferenceLoading,
  referenceError,
  campaignError,
  isInitialLoading,
  campaigns,
  expandedCompactDealId,
  focusedCampaignId,
  uiLabels,
  setExpandedCompactDealId,
  handleOpenGallery,
  handleOpenUserProfile,
  activeType,
  countdownNow,
  handleOpenJoinCampaign,
  canOpenCampaignChat,
  handleOpenChat,
  handleOpenParticipation,
  isSameUserId,
  user,
  sentinelRef,
  isLoadingMore,
  hasMore,
}) {
  return (
    <>
      <section
        className={[
          'deal-grid',
          isCompactDealList ? 'compact-list-grid' : '',
          isMineCompactList ? 'mine-compact-grid' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {isReferenceLoading && <p className="state-message">{LABELS.referenceLoading}</p>}
        {referenceError && <p className="inline-error">{referenceError}</p>}
        {campaignError && <p className="inline-error">{campaignError}</p>}

        {!isInitialLoading && campaigns.length === 0 && !campaignError && (
          <p className="state-message empty-card">{LABELS.emptyDeals}</p>
        )}

        {campaigns.map((deal, index) => {
          const dealViewKey = getDealViewKey(deal, index);
          const isExpandedCompactDeal = isCompactDealList && expandedCompactDealId === dealViewKey;
          const isHighlighted = String(deal.id) === String(focusedCampaignId);

          if (isMineCompactList && !isExpandedCompactDeal) {
            return (
              <CompactMineDealRow
                key={dealViewKey}
                deal={deal}
                index={index}
                labels={uiLabels}
                isHighlighted={isHighlighted}
                onExpand={setExpandedCompactDealId}
                onOpenGallery={handleOpenGallery}
                onOpenUserProfile={(profileUser) => handleOpenUserProfile(profileUser, 'card')}
              />
            );
          }

          if (isCompactDealList && activeType !== 'MINE' && !isExpandedCompactDeal) {
            return (
              <CompactDealRow
                key={dealViewKey}
                deal={deal}
                index={index}
                labels={uiLabels}
                countdownNow={countdownNow}
                formatCountdown={formatCountdown}
                formatDateTime={formatDateTime}
                getScenarioLabel={getScenarioLabel}
                getTypeClass={getTypeClass}
                isHighlighted={isHighlighted}
                onExpand={setExpandedCompactDealId}
                onOpenGallery={handleOpenGallery}
                onOpenUserProfile={(profileUser) => handleOpenUserProfile(profileUser, 'card')}
              />
            );
          }

          return (
            <div key={dealViewKey} className={isCompactDealList ? 'mine-expanded-card' : undefined}>
              {isCompactDealList && (
                <div className="mine-expanded-card-actions">
                  <button type="button" className="text-button" onClick={() => setExpandedCompactDealId('')}>
                    收合
                  </button>
                </div>
              )}
              <DealCard
                labels={uiLabels}
                deal={deal}
                countdownNow={countdownNow}
                formatCountdown={formatCountdown}
                formatDateTime={formatDateTime}
                getScenarioLabel={getScenarioLabel}
                getTypeClass={getTypeClass}
                onJoin={handleOpenJoinCampaign}
                onOpenGallery={handleOpenGallery}
                onOpenChat={activeType === 'MINE' && canOpenCampaignChat(deal) ? handleOpenChat : undefined}
                onOpenParticipation={activeType === 'MINE' ? handleOpenParticipation : undefined}
                onOpenUserProfile={(profileUser) => handleOpenUserProfile(profileUser, 'card')}
                onShare={shareCampaign}
                showJoinAction={activeType !== 'MINE' && !isSameUserId(deal.host?.id, user?.id)}
                isHighlighted={isHighlighted}
              />
            </div>
          );
        })}
      </section>
      <div ref={sentinelRef} className="list-sentinel">
        {isInitialLoading || isLoadingMore ? LABELS.loadingMore : hasMore ? LABELS.loadingMore : LABELS.noMoreData}
      </div>
    </>
  );
}
