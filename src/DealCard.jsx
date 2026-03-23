import { AvatarIcon } from './Icons';

function DealCard({ labels, deal, countdownNow, formatCountdown, getScenarioLabel, getTypeClass }) {
  return (
    <article className="deal-card">
      <div className="deal-upper">
        <div className="deal-image-wrap">
          <img src={deal.image} alt={deal.itemName} className="deal-image" />
          <span className="countdown-badge">倒數: {formatCountdown(deal.expireTime ?? deal.meetupTime, countdownNow)}</span>
        </div>

        <div className="deal-body">
          <div className="deal-title-row">
            <h3>{deal.itemName}</h3>
            <div className="deal-tag-row">
              <span className={`type-pill ${getTypeClass(deal.scenarioType)}`}>{getScenarioLabel(deal.scenarioType)}</span>
              <span className="type-pill category-pill">{deal.categoryName || labels.noValue}</span>
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
          <strong>{deal.meetupLocation || labels.noValue}</strong>
        </div>
      </div>
    </article>
  );
}

export default DealCard;
