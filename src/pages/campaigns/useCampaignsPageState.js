import useSessionPreference from '../../layouts/useSessionPreference';
import { TYPE_OPTIONS, EXPIRE_PRESET_OPTIONS } from '../../homeConfig';
import { useState, useRef } from 'react';
import { getInitialMarketHideFullEnabled } from '../../homeHelpers';
import { getInitialCampaignForm } from '../../homeUtils';

export default function useCampaignsPageState() {
  const campaignTypeOptions = [
    { value: 'ALL', label: '全部' },
    ...TYPE_OPTIONS,
  ];

  const localizedExpirePresetOptions = EXPIRE_PRESET_OPTIONS.map((option) => {
    if (option.value === '10m') {
      return { ...option, label: '10 分鐘後' };
    }

    if (option.value === '20m') {
      return { ...option, label: '20 分鐘後' };
    }

    if (option.value === '30m') {
      return { ...option, label: '30 分鐘後' };
    }

    if (option.value === 'custom') {
      return { ...option, label: '自訂' };
    }

    return option;
  });

  const [activeCampaignType, setActiveCampaignType] = useSessionPreference('activeCampaignType', 'ALL');

  const [activeCategory, setActiveCategory] = useSessionPreference('activeCategory', 0);

  const [hideFullCampaigns, setHideFullCampaigns] = useState(getInitialMarketHideFullEnabled);

  const [activeMarketStatus, setActiveMarketStatus] = useSessionPreference('activeMarketStatus', 'ALL');

  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);

  const [campaignForm, setCampaignForm] = useState(getInitialCampaignForm);

  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

  const [createCampaignError, setCreateCampaignError] = useState('');

  const [createdCampaignSummary, setCreatedCampaignSummary] = useState(null);

  const [selectedDealToJoin, setSelectedDealToJoin] = useState(null);

  const [purchaseQuantity, setPurchaseQuantity] = useState('1');

  const [purchaseError, setPurchaseError] = useState('');

  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);

  const createSummaryTimerRef = useRef(null);

  return {
    campaignTypeOptions,
    localizedExpirePresetOptions,
    activeCampaignType,
    setActiveCampaignType,
    activeCategory,
    setActiveCategory,
    hideFullCampaigns,
    setHideFullCampaigns,
    activeMarketStatus,
    setActiveMarketStatus,
    isCreateCampaignOpen,
    setIsCreateCampaignOpen,
    campaignForm,
    setCampaignForm,
    isCreatingCampaign,
    setIsCreatingCampaign,
    createCampaignError,
    setCreateCampaignError,
    createdCampaignSummary,
    setCreatedCampaignSummary,
    selectedDealToJoin,
    setSelectedDealToJoin,
    purchaseQuantity,
    setPurchaseQuantity,
    purchaseError,
    setPurchaseError,
    isSubmittingPurchase,
    setIsSubmittingPurchase,
    createSummaryTimerRef
  };
}
