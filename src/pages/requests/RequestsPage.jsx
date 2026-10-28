import { useOutletContext } from 'react-router-dom';
import PurchaseRequestsPanel from './PurchaseRequestsPanel';

export default function RequestsPage() {
  const {
    token,
    user,
    deferredSearch,
    dealViewMode,
    isProxyRequestFormOpen,
    setIsProxyRequestFormOpen,
    setIsProxyRequestModalOpen,
    setIsLoginModalOpen,
    showSuccessToast,
    handleOpenPurchaseChat,
  } = useOutletContext().requests;
  return (
    <PurchaseRequestsPanel
      token={token}
      user={user}
      keyword={deferredSearch}
      viewMode={dealViewMode}
      isCreateOpen={isProxyRequestFormOpen}
      pageHeader={(
        <div className="page-identity-heading compact has-action">
          <div className="page-identity-copy">
            <h1>託購</h1>
            <p className="eyebrow">代買需求</p>
          </div>
          <button
            type="button"
            className="page-primary-action"
            onClick={() => setIsProxyRequestFormOpen(true)}
          >
            <span aria-hidden="true">＋</span>
            委託
          </button>
        </div>
      )}
      onCreateOpenChange={setIsProxyRequestFormOpen}
      onModalOpenChange={setIsProxyRequestModalOpen}
      onRequireLogin={() => setIsLoginModalOpen(true)}
      onShowToast={({ title, message }) => showSuccessToast(title, message)}
      onOpenPurchaseChat={handleOpenPurchaseChat}
    />
  );
}
