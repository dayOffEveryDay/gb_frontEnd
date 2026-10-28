import { useState } from 'react';
import {
  getCampaignImageOrderNames,
  canReorderCampaignImages,
  reorderList,
  areStringArraysEqual,
} from '../../homeHelpers';

import { updateCampaignImageOrder } from '../../api';

export default function useCampaignGallery({
  setCampaigns,
  setChatCampaign,
  setParticipationCampaign,
  user,
  setParticipationQuantityDraft,
  setParticipationError,
  token,
  setIsLoginModalOpen,
  showSuccessToast,
}) {
  const [galleryState, setGalleryState] = useState({
    isOpen: false,
    title: '',
    campaignId: null,
    images: [],
    imageOrderNames: [],
    originalImageOrderNames: [],
    activeIndex: 0,
    canReorder: false,
    hasOrderChanges: false,
    isSavingOrder: false,
    orderMessage: '',
    orderError: '',
  });

  const patchCampaignImages = (campaignId, images, imageOrderNames) => {
    const applyImageOrder = (campaign) =>
      campaign && Number(campaign.id ?? campaign.campaignId) === Number(campaignId)
        ? {
            ...campaign,
            imageUrls: images,
            imageRefs: imageOrderNames,
            image: images[0] ?? campaign.image,
          }
        : campaign;

    setCampaigns((current) => current.map(applyImageOrder));
    setChatCampaign((current) => (current ? applyImageOrder(current) : current));
    setParticipationCampaign((current) => (current ? applyImageOrder(current) : current));
  };

  const handleOpenGallery = (deal, startIndex = 0) => {
    const images = (Array.isArray(deal.imageUrls) && deal.imageUrls.length > 0 ? deal.imageUrls : [deal.image]).filter(Boolean);
    const orderNames = getCampaignImageOrderNames({ ...deal, imageUrls: images }, images);
    const canReorder = canReorderCampaignImages({ ...deal, imageUrls: images }, user);

    setGalleryState({
      isOpen: true,
      title: deal.itemName,
      campaignId: deal.id ?? deal.campaignId ?? null,
      images,
      imageOrderNames: canReorder ? orderNames : [],
      originalImageOrderNames: canReorder ? orderNames : [],
      activeIndex: Math.min(Math.max(startIndex, 0), images.length - 1),
      canReorder,
      hasOrderChanges: false,
      isSavingOrder: false,
      orderMessage: '',
      orderError: '',
    });
  };

  const handleOpenImageOrderFromParticipation = (campaign) => {
    if (!campaign) {
      return;
    }

    handleOpenGallery(campaign, 0);
    setParticipationCampaign(null);
    setParticipationQuantityDraft('1');
    setParticipationError('');
  };

  const handleCloseGallery = () => {
    setGalleryState((current) => ({
      ...current,
      isOpen: false,
    }));
  };

  const handleSelectGalleryImage = (nextIndex) => {
    setGalleryState((current) => ({
      ...current,
      activeIndex: nextIndex,
    }));
  };

  const handleStepGallery = (direction) => {
    setGalleryState((current) => {
      if (!current.images.length) {
        return current;
      }

      const step = direction === 'next' ? 1 : -1;
      const nextIndex = (current.activeIndex + step + current.images.length) % current.images.length;

      return {
        ...current,
        activeIndex: nextIndex,
      };
    });
  };

  const handleMoveGalleryImage = (fromIndex, toIndex) => {
    setGalleryState((current) => {
      if (!current.canReorder || current.isSavingOrder) {
        return current;
      }

      const nextImages = reorderList(current.images, fromIndex, toIndex);
      const nextOrderNames = reorderList(current.imageOrderNames, fromIndex, toIndex);

      if (nextImages === current.images || nextOrderNames === current.imageOrderNames) {
        return current;
      }

      return {
        ...current,
        images: nextImages,
        imageOrderNames: nextOrderNames,
        activeIndex: toIndex,
        hasOrderChanges: !areStringArraysEqual(nextOrderNames, current.originalImageOrderNames),
        orderMessage: '',
        orderError: '',
      };
    });
  };

  const handleMoveGalleryImageToFront = (fromIndex) => {
    handleMoveGalleryImage(fromIndex, 0);
  };

  const handleSaveGalleryImageOrder = async () => {
    const {
      campaignId,
      images,
      imageOrderNames,
      canReorder,
      hasOrderChanges,
      isSavingOrder,
    } = galleryState;

    if (!canReorder || !hasOrderChanges || isSavingOrder || !campaignId) {
      return;
    }

    if (!token) {
      setGalleryState((current) => ({
        ...current,
        orderError: '請先登入後再儲存圖片順序。',
      }));
      setIsLoginModalOpen(true);
      return;
    }

    if (imageOrderNames.length !== images.length || imageOrderNames.some((name) => !name)) {
      setGalleryState((current) => ({
        ...current,
        orderError: '圖片資料不完整，請重新整理後再試一次。',
      }));
      return;
    }

    setGalleryState((current) => ({
      ...current,
      isSavingOrder: true,
      orderMessage: '',
      orderError: '',
    }));

    try {
      const response = await updateCampaignImageOrder(campaignId, imageOrderNames, token);

      patchCampaignImages(campaignId, images, imageOrderNames);
      setGalleryState((current) =>
        Number(current.campaignId) === Number(campaignId)
          ? {
              ...current,
              originalImageOrderNames: imageOrderNames,
              hasOrderChanges: false,
              isSavingOrder: false,
              orderMessage: response?.message ?? '圖片順序已成功更新',
              orderError: '',
            }
          : current
      );
      showSuccessToast('圖片順序已更新', '新的封面與排序已儲存。');
    } catch (error) {
      setGalleryState((current) => ({
        ...current,
        isSavingOrder: false,
        orderError: error instanceof Error ? error.message : '圖片順序更新失敗',
      }));
    }
  };

  return {
    galleryState,
    setGalleryState,
    patchCampaignImages,
    handleOpenGallery,
    handleOpenImageOrderFromParticipation,
    handleCloseGallery,
    handleSelectGalleryImage,
    handleStepGallery,
    handleMoveGalleryImage,
    handleMoveGalleryImageToFront,
    handleSaveGalleryImageOrder,
  };
}
