import { useOutletContext } from 'react-router-dom';
import { InquiryPanel } from './InquiryPage';

export default function InquiriesPage() {
  const {
    token,
    user,
    stores,
    activeStoreIds,
    inquiryTargetId,
    setInquiryTargetId,
    setIsInquiryDetailOpen,
    setIsLoginModalOpen,
    showSuccessToast,
  } = useOutletContext().inquiries;
  return (
    <InquiryPanel
      token={token}
      currentUser={user}
      stores={stores}
      activeStoreIds={activeStoreIds}
      openInquiryId={inquiryTargetId}
      onOpenInquiryHandled={() => setInquiryTargetId(null)}
      onDetailViewChange={setIsInquiryDetailOpen}
      onRequireLogin={() => setIsLoginModalOpen(true)}
      onShowToast={({ title, message }) => showSuccessToast(title, message)}
    />
  );
}
