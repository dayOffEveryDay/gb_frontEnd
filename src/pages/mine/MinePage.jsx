import { useOutletContext } from 'react-router-dom';
import { MY_PURCHASE_REQUEST_SCOPE_OPTIONS } from '../../components/purchase/purchaseRequestConfig';
import PurchaseRequestsPanel from '../requests/PurchaseRequestsPanel';
import CampaignList from '../../components/campaign/CampaignList';

export default function MinePage() {
  const {
    localizedMineDomains,
    activeMineDomain,
    setActiveMineDomain,
    localizedMyCampaignScopes,
    activeMyCampaignScope,
    setActiveMyCampaignScope,
    localizedMyCampaignOptions,
    activeMyCampaignFilter,
    setActiveMyCampaignFilter,
    token,
    user,
    deferredSearch,
    dealViewMode,
    setIsProxyRequestModalOpen,
    setIsLoginModalOpen,
    showSuccessToast,
    handleOpenPurchaseChat,
    campaignListProps,
  } = useOutletContext().mine;
  return (
    <>
      <section className="mine-page-header page-header-panel">
        <div className="page-identity-heading compact">
          <h1>我的</h1>
          <p className="eyebrow">個人內容</p>
        </div>
        <div className="mine-domain-switch" role="tablist" aria-label="我的分類">
          {localizedMineDomains.map((option) => (
            <button
              key={option.value}
              type="button"
              className={activeMineDomain === option.value ? 'active' : ''}
              role="tab"
              aria-selected={activeMineDomain === option.value}
              onClick={() => setActiveMineDomain(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
      <div className="mine-filter-stack">
        {activeMineDomain === 'CAMPAIGN' && (
          <>
            <section className="category-strip">
              {localizedMyCampaignScopes.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={activeMyCampaignScope === option.value ? 'category-button active' : 'category-button'}
                  onClick={() => setActiveMyCampaignScope(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </section>
            <section className="mine-status-inline-filter">
              <span className="mine-status-filter-label">狀態</span>
              <div className="mine-status-filter-options">
                {localizedMyCampaignOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={activeMyCampaignFilter === option.value ? 'status-filter-button active' : 'status-filter-button'}
                    onClick={() => setActiveMyCampaignFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
            <label className="mine-status-filter">
              <span className="mine-status-filter-label">狀態</span>
              <select value={activeMyCampaignFilter} onChange={(event) => setActiveMyCampaignFilter(event.target.value)}>
                {localizedMyCampaignOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
      {activeMineDomain === 'REQUEST' ? (
        <PurchaseRequestsPanel
          token={token}
          user={user}
          keyword={deferredSearch}
          viewMode={dealViewMode}
          isCreateOpen={false}
          initialScope="MY_ALL"
          scopeOptions={MY_PURCHASE_REQUEST_SCOPE_OPTIONS}
          scopeControl="tabs"
          onCreateOpenChange={() => {}}
          onModalOpenChange={setIsProxyRequestModalOpen}
          onRequireLogin={() => setIsLoginModalOpen(true)}
          onShowToast={({ title, message }) => showSuccessToast(title, message)}
          onOpenPurchaseChat={handleOpenPurchaseChat}
        />
      ) : (
        <CampaignList {...campaignListProps} />
      )}
    </>
  );
}
