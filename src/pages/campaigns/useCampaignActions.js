import { useEffect } from 'react';
import {
  getSuggestedMeetupTime,
  getInitialCampaignForm,
  isWithinHoduoBusinessHours,
  isHoduoClosingSoon,
  resolveExpireTime,
  resolveExpireDate,
  parseLocalDateTime,
} from '../../homeUtils';
import { createCampaign, joinCampaign } from '../../api';
import { LABELS } from '../../homeConfig';
import { canDisplayMarketCampaign } from '../../homeHelpers';

export default function useCampaignActions({
  createdCampaignSummary,
  createSummaryTimerRef,
  setCreatedCampaignSummary,
  setCampaignForm,
  campaignForm,
  token,
  setIsLoginModalOpen,
  setCreateCampaignError,
  stores,
  categories,
  setIsCreateCampaignOpen,
  activeCampaignType,
  showSuccessToast,
  setIsCreatingCampaign,
  switchActiveType,
  setRefreshKey,
  setSelectedDealToJoin,
  setPurchaseQuantity,
  setPurchaseError,
  isSubmittingPurchase,
  selectedDealToJoin,
  purchaseQuantity,
  setIsSubmittingPurchase,
  setCampaigns,
  setMarketCampaigns,
  hideFullCampaigns
}) {
  useEffect(() => {
    if (!createdCampaignSummary) {
      return undefined;
    }

    createSummaryTimerRef.current = window.setTimeout(() => {
      setCreatedCampaignSummary(null);
    }, 10000);

    return () => {
      if (createSummaryTimerRef.current) {
        window.clearTimeout(createSummaryTimerRef.current);
        createSummaryTimerRef.current = null;
      }
    };
  }, [createSummaryTimerRef, createdCampaignSummary, setCreatedCampaignSummary]);

  useEffect(() => {
    setCampaignForm((current) => {
      const nextExpirePreset = current.scenarioType === 'SCHEDULED' ? 'custom' : current.expirePreset || '10m';
      const nextSuggestedMeetupTime = getSuggestedMeetupTime({ ...current, expirePreset: nextExpirePreset });

      if (current.expirePreset === nextExpirePreset && current.meetupTime === nextSuggestedMeetupTime) {
        return current;
      }

      return {
        ...current,
        expirePreset: nextExpirePreset,
        meetupTime: nextSuggestedMeetupTime,
      };
    });
  }, [campaignForm.scenarioType, campaignForm.expirePreset, campaignForm.expireTime, setCampaignForm]);

  const handleOpenCreateCampaign = (scenarioType = 'SCHEDULED') => {
    if (!token) {
      setIsLoginModalOpen(true);
      setCreateCampaignError('');
      return;
    }

    setCreateCampaignError('');
    setCampaignForm((current) => ({
      ...getInitialCampaignForm(),
      storeId: current.storeId || stores[0]?.id?.toString() || '',
      categoryId: current.categoryId || categories[0]?.id?.toString() || '',
      scenarioType,
      expirePreset: scenarioType === 'SCHEDULED' ? 'custom' : current.expirePreset || '10m',
    }));
    setIsCreateCampaignOpen(true);
  };

  const handleOpenCreateCampaignForCurrentType = () => {
    const currentScenarioType = activeCampaignType === 'INSTANT' ? 'INSTANT' : 'SCHEDULED';
    handleOpenCreateCampaign(currentScenarioType);
  };

  const handleSubmitCreateCampaign = async () => {
    if (!token) {
      setCreateCampaignError('請先登入後再發起團購。');
      return;
    }

    if (campaignForm.scenarioType === 'INSTANT') {
      if (!isWithinHoduoBusinessHours()) {
        showSuccessToast('營業時間提醒', '現在非營業時間，但仍可建立即時團。');
      } else if (isHoduoClosingSoon()) {
        showSuccessToast('營業時間提醒', '賣場即將打烊，請留意截止與面交時間。');
      }
    }

    const requiredChecks = [
      ['店面', campaignForm.storeId],
      ['類別', campaignForm.categoryId],
      ['團購類型', campaignForm.scenarioType],
      ['商品名稱', campaignForm.itemName.trim()],
      ['商品圖片', campaignForm.images.length > 0 ? 'ok' : ''],
      ['單價', campaignForm.pricePerUnit],
      ['總數量', campaignForm.productTotalQuantity],
      ['待認購數量', campaignForm.openQuantity],
      ['截止時間', campaignForm.expirePreset === 'custom' ? campaignForm.expireTime : campaignForm.expirePreset],
      ['面交時間', campaignForm.meetupTime],
      ['面交地點', campaignForm.meetupLocation.trim()],
    ];

    if (campaignForm.scenarioType !== 'INSTANT') {
      requiredChecks[9][1] = 'ok';
    }

    const missingField = requiredChecks.find(([, value]) => !value);
    if (missingField) {
      setCreateCampaignError(`${missingField[0]}為必填`);
      return;
    }

    if (campaignForm.images.length > 3) {
      setCreateCampaignError('圖片最多只能上傳 3 張');
      return;
    }

    if (campaignForm.expirePreset === 'custom' && !resolveExpireTime(campaignForm)) {
      setCreateCampaignError('請選擇有效的截止時間');
      return;
    }

    if (Number(campaignForm.openQuantity) > Number(campaignForm.productTotalQuantity)) {
      setCreateCampaignError('待認購數量不能大於總數量');
      return;
    }

    const expireDate = resolveExpireDate(campaignForm);
    const meetupDate = parseLocalDateTime(campaignForm.meetupTime);
    if (!expireDate || !meetupDate) {
      setCreateCampaignError('\u8acb\u9078\u64c7\u6709\u6548\u7684\u622a\u6b62\u6642\u9593\u8207\u9762\u4ea4\u6642\u9593');
      return;
    }

    if (meetupDate.getTime() < expireDate.getTime()) {
      setCreateCampaignError('\u9762\u4ea4\u6642\u9593\u4e0d\u80fd\u65e9\u65bc\u622a\u6b62\u6642\u9593');
      return;
    }

    setIsCreatingCampaign(true);
    setCreateCampaignError('');

    try {
      const resolvedExpireTime = resolveExpireTime(campaignForm);
      const payload = {
        ...campaignForm,
        expireTime: resolvedExpireTime,
        storeId: Number(campaignForm.storeId),
        categoryId: Number(campaignForm.categoryId),
        pricePerUnit: Number(campaignForm.pricePerUnit),
        productTotalQuantity: Number(campaignForm.productTotalQuantity),
        openQuantity: Number(campaignForm.openQuantity),
      };
      delete payload.expirePreset;

      await createCampaign(payload, token);

      setIsCreateCampaignOpen(false);
      switchActiveType(campaignForm.scenarioType);
      setCampaignForm(getInitialCampaignForm());
      setCreatedCampaignSummary({
        itemName: payload.itemName,
        scenarioType: payload.scenarioType,
        storeName: stores.find((store) => store.id === payload.storeId)?.name || LABELS.noValue,
        categoryName: categories.find((category) => category.id === payload.categoryId)?.name || LABELS.noValue,
        productTotalQuantity: payload.productTotalQuantity,
        openQuantity: payload.openQuantity,
        pricePerUnit: payload.pricePerUnit,
        expireTime: payload.expireTime,
        meetupTime: payload.meetupTime,
        meetupLocation: payload.meetupLocation,
        imageCount: payload.images.length,
      });
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setCreateCampaignError(error.message);
    } finally {
      setIsCreatingCampaign(false);
    }
  };

  const handleOpenJoinCampaign = (deal) => {
    if (!token) {
      setIsLoginModalOpen(true);
      return;
    }

    setSelectedDealToJoin(deal);
    setPurchaseQuantity(deal.availableQuantity > 0 ? '1' : '0');
    setPurchaseError('');
  };

  const handleCloseJoinCampaign = () => {
    if (isSubmittingPurchase) {
      return;
    }

    setSelectedDealToJoin(null);
    setPurchaseQuantity('1');
    setPurchaseError('');
  };

  const handleSubmitJoinCampaign = async () => {
    if (!selectedDealToJoin) {
      return;
    }

    const normalizedQuantity = Number(purchaseQuantity);
    if (!Number.isInteger(normalizedQuantity)) {
      setPurchaseError('\u8acb\u8f38\u5165\u6b63\u6574\u6578\u7684\u8a8d\u8cfc\u6578\u91cf');
      return;
    }

    if (normalizedQuantity <= 0) {
      setPurchaseError('\u8a8d\u8cfc\u6578\u91cf\u4e0d\u80fd\u70ba 0 \u6216\u8ca0\u6578');
      return;
    }

    if (normalizedQuantity > selectedDealToJoin.availableQuantity) {
      setPurchaseError('\u8a8d\u8cfc\u6578\u91cf\u4e0d\u80fd\u8d85\u904e\u5f85\u8a8d\u8cfc\u6578\u91cf');
      return;
    }

    setIsSubmittingPurchase(true);
    setPurchaseError('');

    try {
      const joinResponse = await joinCampaign(
        selectedDealToJoin.id,
        { quantity: normalizedQuantity },
        token
      );

      setCampaigns((current) => {
        const nextCampaigns = current.map((campaign) =>
          campaign.id === selectedDealToJoin.id
            ? {
                ...campaign,
                availableQuantity:
                  joinResponse?.availableQuantity ??
                  joinResponse?.available_quantity ??
                  campaign.availableQuantity - normalizedQuantity,
              }
            : campaign
        );

        return nextCampaigns;
      });
      setMarketCampaigns(current => current.filter(campaign => canDisplayMarketCampaign(campaign, activeCampaignType, hideFullCampaigns)));
      setSelectedDealToJoin(null);
      setPurchaseQuantity('1');
      setPurchaseError('');
      showSuccessToast('已加入團購', `認購 ${normalizedQuantity} 件，請留意後續通知。`);
    } catch (error) {
      setPurchaseError(error.message);
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  return {
    handleOpenCreateCampaign,
    handleOpenCreateCampaignForCurrentType,
    handleSubmitCreateCampaign,
    handleOpenJoinCampaign,
    handleCloseJoinCampaign,
    handleSubmitJoinCampaign
  };
}
