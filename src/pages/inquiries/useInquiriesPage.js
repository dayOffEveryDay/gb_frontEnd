import { useState } from 'react';

export default function useInquiriesPage() {
  const [inquiryTargetId, setInquiryTargetId] = useState(null);

  const [isInquiryDetailOpen, setIsInquiryDetailOpen] = useState(false);

  return {
    inquiryTargetId,
    setInquiryTargetId,
    isInquiryDetailOpen,
    setIsInquiryDetailOpen
  };
}
