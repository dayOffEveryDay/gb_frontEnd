import { useState } from 'react';

export default function useRequestsPage() {
  const [requestRewardMethod, setRequestRewardMethod] = useState('fixed');

  const [requestDeliveryMethod, setRequestDeliveryMethod] = useState('meetup');

  const [requestCompletionTimeMode, setRequestCompletionTimeMode] = useState('specific');

  const [requestDeadlineMode, setRequestDeadlineMode] = useState('specific');

  const [requestDraftMessage, setRequestDraftMessage] = useState('');

  const [isProxyRequestFormOpen, setIsProxyRequestFormOpen] = useState(false);

  const [isProxyRequestModalOpen, setIsProxyRequestModalOpen] = useState(false);

  const handleSubmitProxyPurchaseRequest = (event) => {
    event.preventDefault();
    setRequestDraftMessage('表單已在前端建立，尚未串接 API。');
  };

  return {
    requestRewardMethod,
    setRequestRewardMethod,
    requestDeliveryMethod,
    setRequestDeliveryMethod,
    requestCompletionTimeMode,
    setRequestCompletionTimeMode,
    requestDeadlineMode,
    setRequestDeadlineMode,
    requestDraftMessage,
    setRequestDraftMessage,
    isProxyRequestFormOpen,
    setIsProxyRequestFormOpen,
    isProxyRequestModalOpen,
    setIsProxyRequestModalOpen,
    handleSubmitProxyPurchaseRequest
  };
}
