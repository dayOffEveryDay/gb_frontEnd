import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { fetchUserDeliveryProfiles } from '../../api';
import { getDeliveryLabel } from './purchaseRequestUtils';
import DeliveryProfileSingleSelect from './DeliveryProfileSingleSelect';
import PurchaseDeliveryProfilesModal from './PurchaseDeliveryProfilesModal';

const MAX_PURCHASE_REQUEST_IMAGES = 3;

function getImageFileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

const INITIAL_FORM = {
  itemName: '',
  itemDescription: '',
  rewardType: 'FIXED',
  fixedRewardAmount: '',
  deliveryMethod: 'FACE_TO_FACE',
  requestExpireTime: '',
  deliveryDeadlineHours: '72',
  minCreditScore: '',
  selectedProfileIds: [],
  images: [],
};

export default function PurchaseRequestCreateModal({ isOpen, token, isSubmitting, error, onClose, onSubmit }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [deliveryProfiles, setDeliveryProfiles] = useState([]);
  const [isDeliveryProfilesOpen, setIsDeliveryProfilesOpen] = useState(false);
  const [deliveryProfileError, setDeliveryProfileError] = useState('');
  const previewTouchStartXRef = useRef(null);

  const imagePreviews = useMemo(
    () =>
      (form.images ?? []).map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [form.images]
  );
  const activePreview = imagePreviews[activePreviewIndex] ?? null;

  useEffect(() => {
    return () => {
      imagePreviews.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  const loadDeliveryProfiles = useCallback(async () => {
    if (!isOpen || !token) return;
    setDeliveryProfileError('');
    try {
      const data = await fetchUserDeliveryProfiles(form.deliveryMethod, token);
      setDeliveryProfiles(Array.isArray(data) ? data : []);
    } catch (nextError) {
      setDeliveryProfileError(nextError instanceof Error ? nextError.message : '常用交付資料載入失敗');
    }
  }, [form.deliveryMethod, isOpen, token]);

  useEffect(() => {
    if (!isOpen || !token) return undefined;
    let cancelled = false;
    fetchUserDeliveryProfiles(form.deliveryMethod, token)
      .then((data) => {
        if (!cancelled) setDeliveryProfiles(Array.isArray(data) ? data : []);
      })
      .catch((nextError) => {
        if (!cancelled) setDeliveryProfileError(nextError instanceof Error ? nextError.message : '常用交付資料載入失敗');
      });
    return () => { cancelled = true; };
  }, [form.deliveryMethod, isOpen, token]);

  if (!isOpen) {
    return null;
  }

  const updateField = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'deliveryMethod' ? { selectedProfileIds: [] } : {}),
    }));
  };

  const updateImages = (files) => {
    setForm((current) => ({ ...current, images: files }));
  };

  const handleImageChange = (event) => {
    const selectedImages = Array.from(event.target.files ?? []);
    if (selectedImages.length === 0) {
      event.target.value = '';
      return;
    }

    const existingImages = form.images ?? [];
    const existingImageKeys = new Set(existingImages.map(getImageFileKey));
    const uniqueSelectedImages = selectedImages.filter((file) => !existingImageKeys.has(getImageFileKey(file)));
    const availableSlots = Math.max(0, MAX_PURCHASE_REQUEST_IMAGES - existingImages.length);
    const imagesToAdd = uniqueSelectedImages.slice(0, availableSlots);

    if (imagesToAdd.length > 0) {
      updateImages([...existingImages, ...imagesToAdd]);
      setActivePreviewIndex(existingImages.length);
    }

    event.target.value = '';
  };

  const reorderImages = (fromIndex, toIndex) => {
    const currentImages = form.images ?? [];
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= currentImages.length ||
      toIndex >= currentImages.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const nextImages = [...currentImages];
    const [movedImage] = nextImages.splice(fromIndex, 1);
    nextImages.splice(toIndex, 0, movedImage);
    updateImages(nextImages);
  };

  const removeImage = (targetIndex) => {
    updateImages((form.images ?? []).filter((_, index) => index !== targetIndex));
    setActivePreviewIndex((current) => Math.max(0, current - (targetIndex <= current ? 1 : 0)));
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
    event.stopPropagation();
    previewTouchStartXRef.current = event.touches?.[0]?.clientX ?? null;
  };

  const handlePreviewTouchMove = (event) => {
    event.stopPropagation();
  };

  const handlePreviewTouchEnd = (event) => {
    event.stopPropagation();
    const startX = previewTouchStartXRef.current;
    const endX = event.changedTouches?.[0]?.clientX ?? null;
    previewTouchStartXRef.current = null;

    if (startX == null || endX == null || Math.abs(endX - startX) < 40) {
      return;
    }

    if (endX < startX) {
      movePreviewRight();
      return;
    }

    movePreviewLeft();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal create-campaign-modal purchase-request-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <p className="eyebrow">託購建單</p>
          <button type="button" className="modal-close" onClick={onClose}>
            關閉
          </button>
        </div>
        <h2 className="modal-title">建立託購需求</h2>

        <form
          className="purchase-request-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(form);
          }}
        >
          <label className="form-field">
            <span>商品名稱 *</span>
            <input
              type="text"
              value={form.itemName}
              onChange={(event) => updateField('itemName', event.target.value)}
              placeholder="例如：柯克蘭衛生紙"
              required
            />
          </label>

          <label className="form-field">
            <span>商品圖片，最多三張</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
            />
            <span className="field-hint">最多 1～3 張，可調整順序，第一張會作為主要圖片。</span>
            {activePreview && (
              <div className="image-preview-card purchase-request-image-preview">
                <div
                  className="image-preview-frame"
                  onTouchStart={handlePreviewTouchStart}
                  onTouchMove={handlePreviewTouchMove}
                  onTouchEnd={handlePreviewTouchEnd}
                >
                  <img src={activePreview.url} alt={`${activePreview.file.name} preview`} className="image-preview-thumb" />
                  <span className="image-preview-badge">
                    {activePreviewIndex === 0 ? '主要圖片' : `第 ${activePreviewIndex + 1} 張`}
                  </span>
                  {imagePreviews.length > 1 && (
                    <>
                      <button type="button" className="image-preview-nav prev" onClick={movePreviewLeft} aria-label="上一張">
                        ‹
                      </button>
                      <button type="button" className="image-preview-nav next" onClick={movePreviewRight} aria-label="下一張">
                        ›
                      </button>
                      <span className="image-preview-counter">
                        {activePreviewIndex + 1} / {imagePreviews.length}
                      </span>
                    </>
                  )}
                </div>
                <div className="image-preview-meta">
                  <strong title={activePreview.file.name}>{activePreview.file.name}</strong>
                </div>
                <div className="image-preview-actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      reorderImages(activePreviewIndex, 0);
                      setActivePreviewIndex(0);
                    }}
                    disabled={activePreviewIndex === 0}
                  >
                    設為主要
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
                    往前
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
                    往後
                  </button>
                  <button type="button" className="text-button danger" onClick={() => removeImage(activePreviewIndex)}>
                    刪除
                  </button>
                </div>
                {imagePreviews.length > 1 && (
                  <div className="image-preview-strip" aria-label="已選圖片縮圖">
                    {imagePreviews.map((preview, index) => (
                      <button
                        key={`${preview.file.name}-${index}`}
                        type="button"
                        className={
                          index === activePreviewIndex
                            ? 'image-preview-thumb-button active'
                            : 'image-preview-thumb-button'
                        }
                        onClick={() => setActivePreviewIndex(index)}
                        aria-label={`查看第 ${index + 1} 張圖片`}
                      >
                        <img src={preview.url} alt="" className="image-preview-thumbnail" />
                        <span>{index === 0 ? '主圖' : index + 1}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </label>

          <div className="purchase-request-two-col">
            <label className="form-field">
              <span>酬金模式 *</span>
              <select value={form.rewardType} onChange={(event) => updateField('rewardType', event.target.value)}>
                <option value="FIXED">固定酬金</option>
                <option value="QUOTE">跑腿者報價</option>
              </select>
            </label>

            {form.rewardType === 'FIXED' && (
              <label className="form-field">
                <span>酬金，不含商品 *</span>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={form.fixedRewardAmount}
                  onChange={(event) => updateField('fixedRewardAmount', event.target.value)}
                  required
                />
              </label>
            )}
          </div>

          <label className="form-field">
            <span>交貨方式 *</span>
            <select value={form.deliveryMethod} onChange={(event) => updateField('deliveryMethod', event.target.value)}>
              <option value="FACE_TO_FACE">面交</option>
              <option value="HOME_DELIVERY">宅配</option>
              <option value="STORE_TO_STORE">店到店</option>
              <option value="IBOX">i郵箱</option>
            </select>
          </label>

          <section className="delivery-profile-picker">
            <div className="delivery-profile-picker-header">
              <div>
                <strong>選擇{getDeliveryLabel(form.deliveryMethod)}資料 *</strong>
                {form.deliveryMethod === 'FACE_TO_FACE' && <p className="field-hint">面交地點可以複選。</p>}
              </div>
              <button type="button" className="text-button" onClick={() => setIsDeliveryProfilesOpen(true)}>
                新增/編輯 我的地點
              </button>
            </div>
            {deliveryProfiles.length === 0 ? (
              <p className="field-hint">尚未建立{getDeliveryLabel(form.deliveryMethod)}資料，請先點「新增/編輯 我的地點」新增。</p>
            ) : form.deliveryMethod === 'FACE_TO_FACE' ? (
              <div className="delivery-profile-picker-options">
                {deliveryProfiles.map((profile) => {
                  const checked = form.selectedProfileIds.some((id) => String(id) === String(profile.id));
                  const detail = [profile.city, profile.district, profile.locationName || profile.address, profile.provider].filter(Boolean).join(' ');
                  return (
                    <label key={profile.id} className="market-checkbox-filter">
                      <input
                        type="checkbox"
                        name="delivery-profile"
                        checked={checked}
                        onChange={(event) => updateField('selectedProfileIds', event.target.checked ? [...form.selectedProfileIds, profile.id] : form.selectedProfileIds.filter((id) => String(id) !== String(profile.id)))}
                      />
                      <span>{profile.label || detail || getDeliveryLabel(profile.profileType)}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <DeliveryProfileSingleSelect
                profiles={deliveryProfiles}
                deliveryMethod={form.deliveryMethod}
                selectedProfileIds={form.selectedProfileIds}
                onChange={(profileId) => updateField('selectedProfileIds', [profileId])}
              />
            )}
            {deliveryProfileError && <p className="inline-error">{deliveryProfileError}</p>}
          </section>

          <div className="purchase-request-two-col">
            <label className="form-field">
              <span>委託到期日 *</span>
              <input
                type="date"
                className="local-date-input"
                max="9999-12-31"
                value={form.requestExpireTime}
                onChange={(event) => updateField('requestExpireTime', event.target.value)}
                required
              />
            </label>
            <label className="form-field">
              <span>成立後交付時限（小時）*</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={form.deliveryDeadlineHours}
                onChange={(event) => updateField('deliveryDeadlineHours', event.target.value)}
                required
              />
            </label>
          </div>

          <label className="form-field">
            <span>最低信用分</span>
            <input
              type="number"
              min="0"
              max="100"
              inputMode="numeric"
              value={form.minCreditScore}
              onChange={(event) => updateField('minCreditScore', event.target.value)}
              placeholder="不限"
            />
          </label>

          <label className="form-field">
            <span>補充說明</span>
            <textarea
              rows="3"
              value={form.itemDescription}
              onChange={(event) => updateField('itemDescription', event.target.value)}
              placeholder="商品規格、數量、替代品、取貨細節"
            />
          </label>

          {error && <p className="inline-error">{error}</p>}

          <div className="purchase-request-submit-row">
            <button type="button" className="text-button" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="create-button active" disabled={isSubmitting}>
              {isSubmitting ? '送出中...' : '建立委託'}
            </button>
          </div>
        </form>
        <PurchaseDeliveryProfilesModal
          isOpen={isDeliveryProfilesOpen}
          token={token}
          initialProfileType={form.deliveryMethod}
          onChanged={loadDeliveryProfiles}
          onClose={() => setIsDeliveryProfilesOpen(false)}
        />
      </div>
    </div>
  );
}
