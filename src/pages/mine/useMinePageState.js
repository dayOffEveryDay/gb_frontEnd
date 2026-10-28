import useSessionPreference from '../../layouts/useSessionPreference';
import { useState } from 'react';

export default function useMinePageState() {
  const localizedMyCampaignScopes = [
    { value: 'ALL', label: '全部' },
    { value: 'HOSTED', label: '我發起的' },
    { value: 'JOINED', label: '我參加的' },
  ];

  const localizedMineDomains = [
    { value: 'CAMPAIGN', label: '我的團購' },
    { value: 'REQUEST', label: '我的託購' },
  ];

  const localizedMyCampaignOptions = [
    { value: 'ALL', label: '全部' },
    { value: 'ACTIVE', label: '進行中' },
    { value: 'COMPLETED', label: '已完成' },
    { value: 'FAILED', label: '失敗' },
    { value: 'ISSUE', label: '異常' },
  ];

  const [activeMineDomain, setActiveMineDomain] = useSessionPreference('activeMineDomain', 'CAMPAIGN');

  const [activeMyCampaignScope, setActiveMyCampaignScope] = useSessionPreference('activeMyCampaignScope', 'ALL');

  const [activeMyCampaignFilter, setActiveMyCampaignFilter] = useSessionPreference('activeMyCampaignFilter', 'ALL');

  const [participationCampaign, setParticipationCampaign] = useState(null);

  const [participationQuantityDraft, setParticipationQuantityDraft] = useState('1');

  const [participationError, setParticipationError] = useState('');

  const [isSubmittingParticipation, setIsSubmittingParticipation] = useState(false);

  const [reviewTarget, setReviewTarget] = useState(null);

  const [reviewedReviewKeys, setReviewedReviewKeys] = useState({});

  const [chatReviewState, setChatReviewState] = useState({
    isParticipantReviewed: false,
    isHostAllReviewed: false,
  });

  const [focusedCampaignId, setFocusedCampaignId] = useState('');

  return {
    localizedMyCampaignScopes,
    localizedMineDomains,
    localizedMyCampaignOptions,
    activeMineDomain,
    setActiveMineDomain,
    activeMyCampaignScope,
    setActiveMyCampaignScope,
    activeMyCampaignFilter,
    setActiveMyCampaignFilter,
    participationCampaign,
    setParticipationCampaign,
    participationQuantityDraft,
    setParticipationQuantityDraft,
    participationError,
    setParticipationError,
    isSubmittingParticipation,
    setIsSubmittingParticipation,
    reviewTarget,
    setReviewTarget,
    reviewedReviewKeys,
    setReviewedReviewKeys,
    chatReviewState,
    setChatReviewState,
    focusedCampaignId,
    setFocusedCampaignId
  };
}
