import { useOutletContext } from 'react-router-dom';
import { LABELS } from '../../homeConfig';
import LegacyRequestForm from '../requests/components/LegacyRequestForm';
import CampaignList from '../../components/campaign/CampaignList';

const MARKET_STATUS_OPTIONS = [
  { value: 'ALL', label: '全部' },
  { value: 'OPEN', label: '可跟' },
];

export default function CampaignsPage() {
  const {
    handleOpenCreateCampaignForCurrentType,
    campaignTypeOptions,
    activeCampaignType,
    setActiveCampaignType,
    activeType,
    legacyRequestFormProps,
    activeCategory,
    setActiveCategory,
    categories,
    hideFullCampaigns,
    setHideFullCampaigns,
    activeMarketStatus,
    setActiveMarketStatus,
    campaignListProps,
  } = useOutletContext().campaigns;
  return (
    <>
      <section className="campaign-page-header page-header-panel">
        <div className="page-identity-heading compact has-action">
          <div className="page-identity-copy">
            <h1>合購</h1>
            <p className="eyebrow">一起購買</p>
          </div>
          <button
            type="button"
            className="page-primary-action"
            onClick={handleOpenCreateCampaignForCurrentType}
          >
            <span aria-hidden="true">＋</span>
            開團
          </button>
        </div>
        <div className="campaign-type-filter" role="tablist" aria-label="合購類型">
          {campaignTypeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={activeCampaignType === option.value}
              className={activeCampaignType === option.value ? 'active' : ''}
              onClick={() => setActiveCampaignType(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
      {activeType === 'REQUEST_DISABLED' ? (
        <LegacyRequestForm {...legacyRequestFormProps} />
      ) : (
        <div className="market-filter-row">
          <label className="category-select">
            <span className="category-select-label">類別</span>
            <select value={activeCategory} onChange={(event) => setActiveCategory(Number(event.target.value))}>
              <option value={0}>{LABELS.all}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon ? `${category.icon} ${category.name}` : category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="market-checkbox-filter">
            <input
              type="checkbox"
              checked={hideFullCampaigns}
              onChange={(event) => setHideFullCampaigns(event.target.checked)}
            />
            <span>隱藏已滿</span>
          </label>
          <label className="market-filter-hidden">
            <span className="category-select-label">狀態</span>
            <select value={activeMarketStatus} onChange={(event) => setActiveMarketStatus(event.target.value)}>
              {MARKET_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <CampaignList {...campaignListProps} />
    </>
  );
}
