import { useEffect, useMemo, useRef, useState } from 'react';
import { getSuggestedMeetupTime } from './homeUtils';

function CreateCampaignModal({
  labels,
  isOpen,
  stores,
  categories,
  typeOptions,
  expirePresetOptions,
  campaignForm,
  createCampaignError,
  isCreatingCampaign,
  onClose,
  setCampaignForm,
  onSubmit,
  setCreateCampaignError,
}) {
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const previewTouchStartXRef = useRef(null);

  const imagePreviews = useMemo(
    () =>
      (campaignForm.images ?? []).map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [campaignForm.images]
  );

  useEffect(() => {
    return () => {
      imagePreviews.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  useEffect(() => {
    if (imagePreviews.length === 0) {
      setActivePreviewIndex(0);
      return;
    }

    setActivePreviewIndex((current) => Math.min(current, imagePreviews.length - 1));
  }, [imagePreviews.length]);

  if (!isOpen) {
    return null;
  }

  const isScheduledCampaign = campaignForm.scenarioType === 'SCHEDULED';
  const showExpirePresets = !isScheduledCampaign;
  const showExpireCustomInput = isScheduledCampaign || campaignForm.expirePreset === 'custom';
  const activePreview = imagePreviews[activePreviewIndex] ?? null;

  const syncExpirePreset = (value) => {
    setCampaignForm((current) => {
      const nextForm = {
        ...current,
        expirePreset: value,
      };

      return {
        ...nextForm,
        meetupTime: getSuggestedMeetupTime(nextForm),
      };
    });
  };

  const syncExpireTime = (value) => {
    setCampaignForm((current) => {
      const nextForm = {
        ...current,
        expireTime: value,
      };

      return {
        ...nextForm,
        meetupTime: getSuggestedMeetupTime(nextForm),
      };
    });
  };

  const handleScenarioTypeChange = (value) => {
    setCampaignForm((current) => {
      const nextForm = {
        ...current,
        scenarioType: value,
        expirePreset: value === 'SCHEDULED' ? 'custom' : current.expirePreset || '10m',
      };

      return {
        ...nextForm,
        meetupTime: getSuggestedMeetupTime(nextForm),
      };
    });
  };

  const reorderImages = (fromIndex, toIndex) => {
    setCampaignForm((current) => {
      const nextImages = [...(current.images ?? [])];
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= nextImages.length ||
        toIndex >= nextImages.length ||
        fromIndex === toIndex
      ) {
        return current;
      }

      const [movedImage] = nextImages.splice(fromIndex, 1);
      nextImages.splice(toIndex, 0, movedImage);

      return {
        ...current,
        images: nextImages,
      };
    });
  };

  const removeImage = (targetIndex) => {
    setCampaignForm((current) => ({
      ...current,
      images: (current.images ?? []).filter((_, index) => index !== targetIndex),
    }));
    setCreateCampaignError('');
    setActivePreviewIndex((current) => Math.max(0, Math.min(current, imagePreviews.length - 2)));
  };

  const moveImageToFront = (targetIndex) => {
    reorderImages(targetIndex, 0);
    setActivePreviewIndex(0);
  };

  const movePreviewLeft = () => {
    if (imagePreviews.length <= 1) {
      return;
    }

    setActivePreviewIndex((current) => (current - 1 + imagePreviews.length) % imagePreviews.length);
  };

  const movePreviewRight = () => {
    if (imagePreviews.length <= 1) {
      return;
    }

    setActivePreviewIndex((current) => (current + 1) % imagePreviews.length);
  };

  const handlePreviewTouchStart = (event) => {
    previewTouchStartXRef.current = event.touches?.[0]?.clientX ?? null;
  };

  const handlePreviewTouchEnd = (event) => {
    const startX = previewTouchStartXRef.current;
    const endX = event.changedTouches?.[0]?.clientX ?? null;
    previewTouchStartXRef.current = null;

    if (startX == null || endX == null) {
      return;
    }

    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 40) {
      return;
    }

    if (deltaX < 0) {
      movePreviewRight();
      return;
    }

    movePreviewLeft();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal create-campaign-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <p className="eyebrow">{labels.createDeal}</p>
          <button type="button" className="modal-close" onClick={onClose}>
            {labels.close}
          </button>
        </div>
        <h2 className="modal-title">{labels.createCampaignTitle}</h2>
        <p className="create-campaign-disclaimer">請上傳清楚商品照片，避免造成誤解。</p>

        <div className="campaign-form">
          <label className="profile-field">
            <span>{labels.store}</span>
            <select
              required
              value={campaignForm.storeId}
              onChange={(event) => setCampaignForm((current) => ({ ...current, storeId: event.target.value }))}
            >
              <option value="">{labels.selectStore}</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>

          <label className="profile-field">
            <span>{labels.category}</span>
            <select
              required
              value={campaignForm.categoryId}
              onChange={(event) => setCampaignForm((current) => ({ ...current, categoryId: event.target.value }))}
            >
              <option value="">{labels.selectCategory}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="profile-field">
            <span>{labels.scenarioType}</span>
            <select
              required
              value={campaignForm.scenarioType}
              onChange={(event) => handleScenarioTypeChange(event.target.value)}
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="profile-field">
            <span>{labels.itemName}</span>
            <input
              type="text"
              required
              value={campaignForm.itemName}
              onChange={(event) => setCampaignForm((current) => ({ ...current, itemName: event.target.value }))}
            />
          </label>

          <label className="profile-field">
            <span>{labels.itemImages}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              required
              onChange={(event) => {
                const nextImages = Array.from(event.target.files ?? []).slice(0, 3);
                setCampaignForm((current) => ({
                  ...current,
                  images: nextImages,
                }));
                setActivePreviewIndex(0);

                if ((event.target.files?.length ?? 0) > 3) {
                  setCreateCampaignError('圖片最多只能選 3 張，系統只會保留前 3 張。');
                } else {
                  setCreateCampaignError('');
                }
              }}
            />
            <span className="field-hint">可複選，最多 3 張。預覽一次只顯示一張，可左右切換。</span>
            {activePreview && (
              <div className="image-preview-card">
                <div
                  className="image-preview-frame"
                  onTouchStart={handlePreviewTouchStart}
                  onTouchEnd={handlePreviewTouchEnd}
                >
                  <img src={activePreview.url} alt={`${activePreview.file.name} preview`} className="image-preview-thumb" />
                  <span className="image-preview-badge">{activePreviewIndex === 0 ? '封面' : `第 ${activePreviewIndex + 1} 張`}</span>
                  {imagePreviews.length > 1 && (
                    <>
                      <button type="button" className="image-preview-nav prev" onClick={movePreviewLeft} aria-label="上一張">
                        ‹
                      </button>
                      <button type="button" className="image-preview-nav next" onClick={movePreviewRight} aria-label="下一張">
                        ›
                      </button>
                    </>
                  )}
                </div>
                <div className="image-preview-meta">
                  <strong title={activePreview.file.name}>{activePreview.file.name}</strong>
                  <span>{Math.round(activePreview.file.size / 1024)} KB</span>
                  {imagePreviews.length > 1 && (
                    <span className="image-preview-counter">
                      {activePreviewIndex + 1} / {imagePreviews.length}
                    </span>
                  )}
                </div>
                <div className="image-preview-actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => moveImageToFront(activePreviewIndex)}
                    disabled={activePreviewIndex === 0}
                  >
                    設為封面
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      reorderImages(activePreviewIndex, activePreviewIndex - 1);
                      setActivePreviewIndex((current) => Math.max(current - 1, 0));
                    }}
                    disabled={activePreviewIndex === 0}
                  >
                    左移
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      reorderImages(activePreviewIndex, activePreviewIndex + 1);
                      setActivePreviewIndex((current) => Math.min(current + 1, imagePreviews.length - 1));
                    }}
                    disabled={activePreviewIndex === imagePreviews.length - 1}
                  >
                    右移
                  </button>
                  <button type="button" className="text-button danger" onClick={() => removeImage(activePreviewIndex)}>
                    刪除
                  </button>
                </div>
              </div>
            )}
          </label>

          <label className="profile-field">
            <span>{labels.unitPrice}</span>
            <input
              type="number"
              min="1"
              required
              value={campaignForm.pricePerUnit}
              onChange={(event) => setCampaignForm((current) => ({ ...current, pricePerUnit: event.target.value }))}
            />
          </label>

          <label className="profile-field">
            <span>{labels.totalQuantityLabel ?? '商品總數量'}</span>
            <input
              type="number"
              min="1"
              required
              value={campaignForm.productTotalQuantity}
              onChange={(event) =>
                setCampaignForm((current) => ({ ...current, productTotalQuantity: event.target.value }))
              }
            />
          </label>

          <label className="profile-field">
            <span>{labels.pendingQuantity}</span>
            <input
              type="number"
              min="1"
              required
              value={campaignForm.openQuantity}
              onChange={(event) => setCampaignForm((current) => ({ ...current, openQuantity: event.target.value }))}
            />
          </label>

          <label className="profile-field">
            <span>{labels.expireTime}</span>
            {showExpirePresets && (
              <div className="preset-row">
                {expirePresetOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={campaignForm.expirePreset === option.value ? 'preset-button active' : 'preset-button'}
                    onClick={() => syncExpirePreset(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            {showExpireCustomInput && (
              <input
                type="datetime-local"
                required
                value={campaignForm.expireTime}
                onChange={(event) => syncExpireTime(event.target.value)}
              />
            )}
          </label>

          <label className="profile-field">
            <span>{labels.meetupDateTime}</span>
            <input
              type="datetime-local"
              required
              value={campaignForm.meetupTime}
              onChange={(event) => setCampaignForm((current) => ({ ...current, meetupTime: event.target.value }))}
            />
          </label>

          <label className="profile-field">
            <span>{labels.meetupLocationLabel}</span>
            <input
              type="text"
              required
              value={campaignForm.meetupLocation}
              onChange={(event) =>
                setCampaignForm((current) => ({ ...current, meetupLocation: event.target.value }))
              }
            />
          </label>
        </div>

        {createCampaignError && <p className="inline-error">{createCampaignError}</p>}

        <button type="button" className="save-button" onClick={onSubmit} disabled={isCreatingCampaign}>
          {isCreatingCampaign ? labels.savingCampaign : labels.saveCampaign}
        </button>
      </div>
    </div>
  );
}

export default CreateCampaignModal;
