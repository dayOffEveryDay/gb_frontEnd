import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  acceptPurchaseRequest,
  acceptPurchaseRequestQuote,
  cancelPurchaseRequest,
  checkPurchaseRequestReviewStatus,
  completePurchaseRequest,
  createPurchaseRequest,
  createPurchaseRequestQuote,
  createPurchaseRequestReview,
  deliverPurchaseRequest,
  fetchMyAssignedPurchaseRequests,
  fetchMyCreatedPurchaseRequests,
  fetchMyQuotedPurchaseRequests,
  fetchPurchaseRequestQuotes,
  fetchPurchaseRequests,
  updatePurchaseRequestImageOrder,
} from './api';
import { formatDateTime } from './homeUtils';
import ImageGalleryModal from './ImageGalleryModal';
import { DiagonalExpandIcon } from './Icons';

const PAGE_SIZE = 20;
const MAX_PURCHASE_REQUEST_IMAGES = 3;

function getImageFileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

const SCOPE_OPTIONS = [
  { value: 'MARKET', label: '全部委託' },
  { value: 'CREATED', label: '我發起' },
  { value: 'ASSIGNED', label: '我承接' },
  { value: 'QUOTED', label: '我報價' },
];

const DELIVERY_LABELS = {
  FACE_TO_FACE: '面交',
  STORE_TO_STORE: '店到店',
  HOME_DELIVERY: '宅配',
};

const STATUS_LABELS = {
  OPEN: '開放中',
  ASSIGNED: '已成立',
  DELIVERED: '已交付',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  EXPIRED: '已過期',
};

const INITIAL_FORM = {
  productName: '',
  rewardType: 'FIXED',
  fixedRewardAmount: '',
  deliveryMethod: 'FACE_TO_FACE',
  requestArea: '',
  deadlineMode: 'DATE',
  deadlineAt: '',
  deliveryTimeType: 'DISCUSS',
  deliveryTimeNote: '',
  minCreditScore: '',
  description: '',
  images: [],
};

function normalizeUserSummary(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id ?? null,
    displayName: user.displayName ?? user.display_name ?? '--',
    profileImageUrl: user.profileImageUrl ?? user.profile_image_url ?? '',
    creditScore: user.creditScore ?? user.credit_score ?? '--',
  };
}

function normalizePurchaseRequest(item) {
  const imageUrls = Array.isArray(item?.imageUrls)
    ? item.imageUrls
    : Array.isArray(item?.image_urls)
      ? item.image_urls
      : [];

  return {
    ...item,
    id: item?.id,
    productName: item?.productName ?? item?.product_name ?? '--',
    imageUrls,
    rewardType: (item?.rewardType ?? item?.reward_type ?? 'FIXED').toString().toUpperCase(),
    fixedRewardAmount: item?.fixedRewardAmount ?? item?.fixed_reward_amount ?? null,
    quoteCount: Number(item?.quoteCount ?? item?.quote_count ?? 0),
    deliveryMethod: (item?.deliveryMethod ?? item?.delivery_method ?? '').toString().toUpperCase(),
    requestArea: item?.requestArea ?? item?.request_area ?? '',
    deadlineAt: item?.deadlineAt ?? item?.deadline_at ?? '',
    deliveryTimeType: item?.deliveryTimeType ?? item?.delivery_time_type ?? 'DISCUSS',
    deliveryTimeNote: item?.deliveryTimeNote ?? item?.delivery_time_note ?? '',
    minCreditScore: item?.minCreditScore ?? item?.min_credit_score ?? null,
    description: item?.description ?? '',
    status: (item?.status ?? 'OPEN').toString().toUpperCase(),
    requester: normalizeUserSummary(item?.requester),
    assignedRunner: normalizeUserSummary(item?.assignedRunner ?? item?.assigned_runner),
    acceptedQuoteId: item?.acceptedQuoteId ?? item?.accepted_quote_id ?? null,
    canQuote: Boolean(item?.canQuote ?? item?.can_quote),
    canAcceptDirectly: Boolean(item?.canAcceptDirectly ?? item?.can_accept_directly),
    actBlockedReason: item?.actBlockedReason ?? item?.act_blocked_reason ?? '',
    createdAt: item?.createdAt ?? item?.created_at ?? '',
  };
}

function normalizeQuote(quote) {
  return {
    id: quote?.id,
    purchaseRequestId: quote?.purchaseRequestId ?? quote?.purchase_request_id,
    quoteAmount: quote?.quoteAmount ?? quote?.quote_amount ?? 0,
    note: quote?.note ?? '',
    status: (quote?.status ?? 'PENDING').toString().toUpperCase(),
    runner: normalizeUserSummary(quote?.runner),
    createdAt: quote?.createdAt ?? quote?.created_at ?? '',
  };
}

function normalizePageItems(data) {
  return Array.isArray(data?.content) ? data.content.map(normalizePurchaseRequest) : [];
}

function isSameUser(a, b) {
  return a != null && b != null && String(a) === String(b);
}

function reorderList(items, fromIndex, toIndex) {
  if (
    !Array.isArray(items) ||
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

function areStringArraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

function getRewardLabel(request) {
  if (request.rewardType === 'QUOTE') {
    return `${request.quoteCount} 人報價`;
  }

  return `NT$ ${request.fixedRewardAmount ?? 0}`;
}

function getBlockedLabel(reason) {
  if (reason === 'LOGIN_REQUIRED') {
    return '登入後可操作';
  }
  if (reason === 'IS_REQUESTER') {
    return '自己的委託';
  }
  if (reason === 'CREDIT_SCORE_TOO_LOW') {
    return '信用分不足';
  }
  return '';
}

function PurchaseRequestCreateModal({ isOpen, isSubmitting, error, onClose, onSubmit }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
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

  useEffect(() => {
    if (imagePreviews.length === 0) {
      setActivePreviewIndex(0);
      return;
    }

    setActivePreviewIndex((current) => Math.min(current, imagePreviews.length - 1));
  }, [imagePreviews.length]);

  useEffect(() => {
    if (isOpen) {
      setForm(INITIAL_FORM);
      setActivePreviewIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
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
              value={form.productName}
              onChange={(event) => updateField('productName', event.target.value)}
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
                  min="0"
                  inputMode="numeric"
                  value={form.fixedRewardAmount}
                  onChange={(event) => updateField('fixedRewardAmount', event.target.value)}
                  required
                />
              </label>
            )}
          </div>

          <div className="purchase-request-two-col">
            <label className="form-field">
              <span>交貨方式 *</span>
              <select value={form.deliveryMethod} onChange={(event) => updateField('deliveryMethod', event.target.value)}>
                <option value="FACE_TO_FACE">面交</option>
                <option value="STORE_TO_STORE">店到店</option>
                <option value="HOME_DELIVERY">宅配</option>
              </select>
            </label>

            <label className="form-field">
              <span>委託地區 *</span>
              <input
                type="text"
                value={form.requestArea}
                onChange={(event) => updateField('requestArea', event.target.value)}
                placeholder="台北中山區"
                required
              />
            </label>
          </div>

          <div className="purchase-request-two-col">
            <label className="form-field">
              <span>委託期限</span>
              <select value={form.deadlineMode} onChange={(event) => updateField('deadlineMode', event.target.value)}>
                <option value="DATE">指定期限</option>
                <option value="NONE">無期限</option>
              </select>
            </label>

            {form.deadlineMode === 'DATE' && (
              <label className="form-field">
                <span>期限時間</span>
                <input
                  type="datetime-local"
                  value={form.deadlineAt}
                  onChange={(event) => updateField('deadlineAt', event.target.value)}
                />
              </label>
            )}
          </div>

          <div className="purchase-request-two-col">
            <label className="form-field">
              <span>交貨時間</span>
              <select
                value={form.deliveryTimeType}
                onChange={(event) => updateField('deliveryTimeType', event.target.value)}
              >
                <option value="DISCUSS">討論</option>
                <option value="SPECIFIED">指定</option>
              </select>
            </label>

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
          </div>

          <label className="form-field">
            <span>交貨時間說明</span>
            <input
              type="text"
              value={form.deliveryTimeNote}
              onChange={(event) => updateField('deliveryTimeNote', event.target.value)}
              placeholder="例如：平日晚上可討論"
            />
          </label>

          <label className="form-field">
            <span>補充說明</span>
            <textarea
              rows="3"
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
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
      </div>
    </div>
  );
}

function PurchaseRequestReviewModal({ request, isSubmitting, error, onClose, onSubmit }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (request) {
      setRating(5);
      setComment('');
    }
  }, [request]);

  if (!request) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal purchase-review-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <p className="eyebrow">託購評價</p>
          <button type="button" className="modal-close" onClick={onClose}>
            關閉
          </button>
        </div>
        <h2 className="modal-title">{request.productName}</h2>
        <form
          className="purchase-request-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ rating, comment });
          }}
        >
          <label className="form-field">
            <span>星等</span>
            <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
              <option value={5}>5 星</option>
              <option value={4}>4 星</option>
              <option value={3}>3 星</option>
              <option value={2}>2 星</option>
              <option value={1}>1 星</option>
            </select>
          </label>
          <label className="form-field">
            <span>評價內容</span>
            <textarea rows="3" value={comment} onChange={(event) => setComment(event.target.value)} />
          </label>
          {error && <p className="inline-error">{error}</p>}
          <div className="purchase-request-submit-row">
            <button type="button" className="text-button" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="create-button active" disabled={isSubmitting}>
              {isSubmitting ? '送出中...' : '送出評價'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PurchaseRequestCancelConfirmModal({ request, isSubmitting, onClose, onConfirm }) {
  if (!request) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal purchase-cancel-confirm-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <p className="eyebrow">取消委託</p>
          <button type="button" className="modal-close" onClick={onClose} disabled={isSubmitting}>
            關閉
          </button>
        </div>
        <h2 className="modal-title">確定要取消這筆委託？</h2>
        <p className="panel-note">
          取消後其他人將無法再報價或接單。商品：<strong>{request.productName}</strong>
        </p>
        <div className="purchase-request-submit-row">
          <button type="button" className="text-button" onClick={onClose} disabled={isSubmitting}>
            保留委託
          </button>
          <button type="button" className="create-button danger" onClick={() => onConfirm(request)} disabled={isSubmitting}>
            {isSubmitting ? '取消中...' : '確認取消'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PurchaseRequestQuoteModal({ request, isSubmitting, error, onClose, onSubmit }) {
  const [quoteAmount, setQuoteAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (request) {
      setQuoteAmount('');
      setNote('');
    }
  }, [request]);

  if (!request) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal purchase-quote-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <p className="eyebrow">委託報價</p>
          <button type="button" className="modal-close" onClick={onClose} disabled={isSubmitting}>
            關閉
          </button>
        </div>
        <h2 className="modal-title">{request.productName}</h2>
        <form
          className="purchase-request-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(request, { quoteAmount, note });
          }}
        >
          <label className="form-field">
            <span>報價金額 *</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={quoteAmount}
              onChange={(event) => setQuoteAmount(event.target.value)}
              placeholder="請輸入報價"
              required
            />
          </label>
          <label className="form-field">
            <span>備註</span>
            <textarea
              rows="3"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="可補充購買時間、交貨方式或其他說明"
            />
          </label>
          {error && <p className="inline-error">{error}</p>}
          <div className="purchase-request-submit-row">
            <button type="button" className="text-button" onClick={onClose} disabled={isSubmitting}>
              取消
            </button>
            <button type="submit" className="create-button active" disabled={isSubmitting}>
              {isSubmitting ? '送出中...' : '送出報價'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PurchaseRequestCard({
  request,
  viewMode,
  currentUser,
  quotes,
  isQuotesOpen,
  isQuotesLoading,
  actionId,
  onToggleQuotes,
  onAcceptQuote,
  onOpenQuote,
  onAcceptDirectly,
  onDeliver,
  onComplete,
  onCancel,
  onReview,
  onManageImages,
  onRequireLogin,
  onExpand,
}) {
  const isRequester = isSameUser(request.requester?.id, currentUser?.id);
  const isRunner = isSameUser(request.assignedRunner?.id, currentUser?.id);
  const image = request.imageUrls[0] ?? '';
  const blockedLabel = getBlockedLabel(request.actBlockedReason);
  const isBusy = actionId === request.id;
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const canViewQuotes = isRequester && request.rewardType === 'QUOTE' && request.status === 'OPEN';
  const canManageImages = isRequester && request.status === 'OPEN' && request.imageUrls.length > 1;
  const canCancelRequest = isRequester && request.status === 'OPEN';
  const canQuoteRequest = currentUser && request.status === 'OPEN' && request.rewardType === 'QUOTE' && !isRequester;
  const hasActionMenu = canViewQuotes || canManageImages || canCancelRequest;
  const hasInlineActions =
    (!currentUser && request.status === 'OPEN') ||
    (currentUser && request.status === 'OPEN' && request.rewardType === 'FIXED' && !isRequester) ||
    canQuoteRequest ||
    (isRunner && request.status === 'ASSIGNED') ||
    (isRequester && ['ASSIGNED', 'DELIVERED'].includes(request.status)) ||
    (currentUser && (isRequester || isRunner) && request.status === 'COMPLETED');

  if (viewMode === 'compact') {
    const requesterName = request.requester?.displayName ?? '--';
    const deliveryLabel = DELIVERY_LABELS[request.deliveryMethod] ?? request.deliveryMethod;

    return (
      <article
        className={[
          'compact-market-row',
          'purchase-request-compact-row',
          hasInlineActions ? 'purchase-request-compact-row-with-actions' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {hasActionMenu && (
          <div className="purchase-request-menu-wrap">
            <button
              type="button"
              className="purchase-request-menu-button"
              onClick={() => setIsActionMenuOpen((current) => !current)}
              aria-label="開啟委託操作選單"
              aria-expanded={isActionMenuOpen}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
            {isActionMenuOpen && (
              <div className="purchase-request-menu">
                {canViewQuotes && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleQuotes(request);
                      setIsActionMenuOpen(false);
                    }}
                  >
                    {isQuotesOpen ? '收合報價' : `查看報價 ${request.quoteCount}`}
                  </button>
                )}
                {canManageImages && (
                  <button
                    type="button"
                    onClick={() => {
                      onManageImages(request);
                      setIsActionMenuOpen(false);
                    }}
                  >
                    管理圖片
                  </button>
                )}
                {canCancelRequest && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      onCancel(request);
                      setIsActionMenuOpen(false);
                    }}
                    disabled={isBusy}
                  >
                    取消委託
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className="compact-market-image-button purchase-request-compact-image-button"
          onClick={() => onManageImages(request, 0)}
          disabled={!image}
          aria-label={image ? `查看 ${request.productName} 圖片` : undefined}
        >
          {image ? (
            <img src={image} alt={request.productName} className="compact-market-image" />
          ) : (
            <div className="purchase-request-image placeholder">圖片</div>
          )}
          {request.imageUrls.length > 1 && <span className="purchase-request-image-count">{request.imageUrls.length} 張</span>}
        </button>

        <div className="compact-market-main purchase-request-compact-main">
          <div className="compact-market-title-row">
            <strong className="compact-market-title">{request.productName}</strong>
            <span className={`compact-market-type purchase-request-compact-status ${request.status.toLowerCase()}`}>
              {STATUS_LABELS[request.status] ?? request.status}
            </span>
          </div>
          <div className="compact-market-meta">
            <span>酬金：{getRewardLabel(request)}</span>
            <span>交貨：{deliveryLabel}</span>
          </div>
          <div className="compact-market-bottom">
            <span className="compact-market-host purchase-request-compact-requester">
              <span className="compact-host-avatar">
                {request.requester?.profileImageUrl ? (
                  <img src={request.requester.profileImageUrl} alt="" className="avatar-image" />
                ) : (
                  <span>{requesterName.slice(0, 1)}</span>
                )}
              </span>
              <span>{requesterName}</span>
            </span>
            <span className="purchase-request-compact-area">{request.requestArea || '--'}</span>
          </div>
        </div>

        {hasInlineActions && (
          <div className="purchase-request-actions purchase-request-compact-actions">
            {!currentUser && request.status === 'OPEN' && (
              <button type="button" className="create-button purchase-request-primary-action" onClick={onRequireLogin}>
                登入
              </button>
            )}

            {currentUser && request.status === 'OPEN' && request.rewardType === 'FIXED' && !isRequester && (
              <button
                type="button"
                className="create-button active purchase-request-primary-action"
                onClick={() => onAcceptDirectly(request)}
                disabled={isBusy || Boolean(blockedLabel)}
                title={blockedLabel || '承接'}
              >
                {blockedLabel || (isBusy ? '處理中...' : '承接')}
              </button>
            )}

            {canQuoteRequest && (
              <button
                type="button"
                className="create-button active purchase-request-primary-action"
                onClick={() => onOpenQuote(request)}
                disabled={isBusy || Boolean(blockedLabel)}
                title={blockedLabel || '報價'}
              >
                {blockedLabel || (isBusy ? '處理中...' : '報價')}
              </button>
            )}

            {isRunner && request.status === 'ASSIGNED' && (
              <button
                type="button"
                className="create-button active purchase-request-primary-action"
                onClick={() => onDeliver(request)}
                disabled={isBusy}
              >
                {isBusy ? '處理中...' : '交付'}
              </button>
            )}

            {isRequester && ['ASSIGNED', 'DELIVERED'].includes(request.status) && (
              <button
                type="button"
                className="create-button active purchase-request-primary-action"
                onClick={() => onComplete(request)}
                disabled={isBusy}
              >
                {isBusy ? '處理中...' : '完成'}
              </button>
            )}

            {currentUser && (isRequester || isRunner) && request.status === 'COMPLETED' && (
              <button type="button" className="text-button" onClick={() => onReview(request)}>
                評價
              </button>
            )}
          </div>
        )}

        {onExpand && (
          <button
            type="button"
            className="compact-expand-button"
            onClick={() => onExpand(String(request.id))}
            aria-label={`放大 ${request.productName} 託購卡片`}
            title="放大"
          >
            <DiagonalExpandIcon />
          </button>
        )}
      </article>
    );
  }

  return (
    <article
      className={[
        viewMode === 'compact' ? 'purchase-request-card compact' : 'purchase-request-card',
        canQuoteRequest ? 'purchase-request-card-with-actions' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {hasActionMenu && (
        <div className="purchase-request-menu-wrap">
          <button
            type="button"
            className="purchase-request-menu-button"
            onClick={() => setIsActionMenuOpen((current) => !current)}
            aria-label="開啟委託操作選單"
            aria-expanded={isActionMenuOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          {isActionMenuOpen && (
            <div className="purchase-request-menu">
              {canViewQuotes && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleQuotes(request);
                    setIsActionMenuOpen(false);
                  }}
                >
                  {isQuotesOpen ? '收合報價' : `查看報價 ${request.quoteCount}`}
                </button>
              )}
              {canManageImages && (
                <button
                  type="button"
                  onClick={() => {
                    onManageImages(request);
                    setIsActionMenuOpen(false);
                  }}
                >
                  圖片順序
                </button>
              )}
              {canCancelRequest && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    onCancel(request);
                    setIsActionMenuOpen(false);
                  }}
                  disabled={isBusy}
                >
                  取消委託
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {viewMode === 'compact' && onExpand && (
        <button
          type="button"
          className="compact-expand-button purchase-request-expand-button"
          onClick={() => onExpand(String(request.id))}
          aria-label={`放大 ${request.productName} 託購卡片`}
          title="放大"
        >
          <DiagonalExpandIcon />
        </button>
      )}
      <div className="purchase-request-upper">
      <button
        type="button"
        className="purchase-request-image-wrap purchase-request-image-button"
        onClick={() => onManageImages(request, 0)}
        disabled={!image}
        aria-label={image ? '放大瀏覽託購圖片' : undefined}
      >
        {image ? (
          <img src={image} alt={request.productName} className="purchase-request-image" />
        ) : (
          <div className="purchase-request-image placeholder">託購</div>
        )}
        {request.imageUrls.length > 1 && <span className="purchase-request-image-count">{request.imageUrls.length} 張</span>}
      </button>

      <div className="purchase-request-body">
        <div className="purchase-request-title-row">
          <h3>{request.productName}</h3>
          <span className={`purchase-request-status ${request.status.toLowerCase()}`}>
            {STATUS_LABELS[request.status] ?? request.status}
          </span>
        </div>

        <div className="purchase-request-meta-grid">
          <span>酬金：{getRewardLabel(request)}</span>
          <span>交貨：{DELIVERY_LABELS[request.deliveryMethod] ?? request.deliveryMethod}</span>
        </div>

        {viewMode !== 'compact' && request.description && (
          <p className="purchase-request-description">{request.description}</p>
        )}

      </div>
      </div>

      <div className="purchase-request-lower">
        <div className="footer-item requester-item">
          <span className="footer-label">委託人</span>
          <span className="purchase-request-requester">
            <span className="purchase-request-requester-avatar">
              {request.requester?.profileImageUrl ? (
                <img src={request.requester.profileImageUrl} alt="" />
              ) : (
                <span>{(request.requester?.displayName ?? '?').slice(0, 1)}</span>
              )}
            </span>
            <strong>{request.requester?.displayName ?? '--'}</strong>
          </span>
        </div>
        <div className="footer-item purchase-request-area-item">
          <span className="footer-label">地區</span>
          <strong>{request.requestArea || '--'}</strong>
        </div>
        <div className="footer-item purchase-request-deadline-item">
          <span className="footer-label">期限</span>
          <strong>{request.deadlineAt ? formatDateTime(request.deadlineAt) : '無期限'}</strong>
        </div>
      </div>

        {hasInlineActions && (
        <div className="purchase-request-actions">
          {!currentUser && request.status === 'OPEN' && (
            <button type="button" className="create-button" onClick={onRequireLogin}>
              登入後操作
            </button>
          )}

          {currentUser && request.status === 'OPEN' && request.rewardType === 'FIXED' && !isRequester && (
            <button
              type="button"
              className="create-button active"
              onClick={() => onAcceptDirectly(request)}
              disabled={isBusy || Boolean(blockedLabel)}
              title={blockedLabel || '承接'}
            >
              {blockedLabel || (isBusy ? '處理中...' : '承接')}
            </button>
          )}
          {canQuoteRequest && (
            <button
              type="button"
              className="create-button active purchase-request-primary-action"
              onClick={() => onOpenQuote(request)}
              disabled={isBusy || Boolean(blockedLabel)}
              title={blockedLabel || '\u5831\u50f9'}
            >
              {blockedLabel || (isBusy ? '\u8655\u7406\u4e2d...' : '\u5831\u50f9')}
            </button>
          )}

          {isRunner && request.status === 'ASSIGNED' && (
            <button type="button" className="create-button active" onClick={() => onDeliver(request)} disabled={isBusy}>
              {isBusy ? '處理中...' : '標記已交付'}
            </button>
          )}

          {isRequester && ['ASSIGNED', 'DELIVERED'].includes(request.status) && (
            <button type="button" className="create-button active" onClick={() => onComplete(request)} disabled={isBusy}>
              {isBusy ? '處理中...' : '確認完成'}
            </button>
          )}

          {currentUser && (isRequester || isRunner) && request.status === 'COMPLETED' && (
            <button type="button" className="text-button" onClick={() => onReview(request)}>
              評價對方
            </button>
          )}
        </div>
        )}

        {isQuotesOpen && (
          <div className="purchase-quotes-panel">
            {isQuotesLoading && <p className="state-message">載入報價中...</p>}
            {!isQuotesLoading && quotes.length === 0 && <p className="state-message">目前沒有報價。</p>}
            {quotes.map((quote) => (
              <div key={quote.id} className="purchase-quote-row">
                <div>
                  <strong>{quote.runner?.displayName ?? '--'}</strong>
                  <span>NT$ {quote.quoteAmount}</span>
                  {quote.note && <p>{quote.note}</p>}
                </div>
                <button
                  type="button"
                  className="create-button active"
                  onClick={() => onAcceptQuote(request, quote)}
                  disabled={quote.status !== 'PENDING' || isBusy}
                >
                  {quote.status === 'PENDING' ? '委託' : STATUS_LABELS[quote.status] ?? quote.status}
                </button>
              </div>
            ))}
          </div>
        )}
    </article>
  );
}

function PurchaseRequestsPanel({
  token,
  user,
  keyword = '',
  viewMode = 'card',
  isCreateOpen,
  hideUnavailableRequests = false,
  onCreateOpenChange,
  onHideUnavailableRequestsChange,
  onModalOpenChange,
  onRequireLogin,
  onShowToast,
}) {
  const [scope, setScope] = useState('MARKET');
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionId, setActionId] = useState(null);
  const [quoteTarget, setQuoteTarget] = useState(null);
  const [quoteSubmitError, setQuoteSubmitError] = useState('');
  const [openQuotesRequestId, setOpenQuotesRequestId] = useState(null);
  const [quotesByRequestId, setQuotesByRequestId] = useState({});
  const [loadingQuotesId, setLoadingQuotesId] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewError, setReviewError] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [expandedCompactRequestId, setExpandedCompactRequestId] = useState('');
  const [isScopeMenuOpen, setIsScopeMenuOpen] = useState(false);
  const [imageOrderState, setImageOrderState] = useState({
    request: null,
    images: [],
    originalImages: [],
    activeIndex: 0,
    canReorder: false,
    isSaving: false,
    error: '',
    message: '',
  });

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const query = { page: 0, size: PAGE_SIZE };
      let data;

      if (scope === 'CREATED') {
        if (!token) {
          setRequests([]);
          setError('請先登入查看我發起的託購。');
          return;
        }
        data = await fetchMyCreatedPurchaseRequests(query, token);
      } else if (scope === 'ASSIGNED') {
        if (!token) {
          setRequests([]);
          setError('請先登入查看我承接的託購。');
          return;
        }
        data = await fetchMyAssignedPurchaseRequests(query, token);
      } else if (scope === 'QUOTED') {
        if (!token) {
          setRequests([]);
          setError('請先登入查看我報價過的託購。');
          return;
        }
        data = await fetchMyQuotedPurchaseRequests(query, token);
      } else {
        data = await fetchPurchaseRequests(
          {
            ...query,
            keyword: keyword.trim() || undefined,
          },
          token
        );
      }

      setRequests(normalizePageItems(data));
    } catch (loadError) {
      setError(loadError.message);
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [keyword, scope, token]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests, refreshKey]);

  useEffect(() => {
    if (viewMode !== 'compact') {
      setExpandedCompactRequestId('');
    }
  }, [viewMode]);

  useEffect(() => {
    const hasInternalModalOpen = Boolean(quoteTarget || reviewTarget || cancelTarget || imageOrderState.request);
    onModalOpenChange?.(hasInternalModalOpen);

    return () => {
      onModalOpenChange?.(false);
    };
  }, [cancelTarget, imageOrderState.request, onModalOpenChange, quoteTarget, reviewTarget]);

  const refresh = () => setRefreshKey((current) => current + 1);

  const withAction = async (request, action, successMessage) => {
    if (!token) {
      onRequireLogin?.();
      return;
    }

    setActionId(request.id);
    setError('');
    try {
      await action();
      onShowToast?.({ title: '託購已更新', message: successMessage });
      refresh();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setActionId(null);
    }
  };

  const handleCreate = async (form) => {
    if (!token) {
      onRequireLogin?.();
      return;
    }
    if (!form.productName.trim()) {
      setCreateError('商品名稱必填');
      return;
    }
    if (form.rewardType === 'FIXED' && form.fixedRewardAmount === '') {
      setCreateError('固定酬金必填');
      return;
    }
    if ((form.images ?? []).length > 3) {
      setCreateError('圖片最多三張');
      return;
    }

    setIsCreating(true);
    setCreateError('');
    try {
      await createPurchaseRequest(
        {
          productName: form.productName.trim(),
          rewardType: form.rewardType,
          fixedRewardAmount: form.rewardType === 'FIXED' ? form.fixedRewardAmount : undefined,
          deliveryMethod: form.deliveryMethod,
          requestArea: form.requestArea.trim(),
          deadlineAt: form.deadlineMode === 'DATE' ? form.deadlineAt : undefined,
          deliveryTimeType: form.deliveryTimeType,
          deliveryTimeNote: form.deliveryTimeNote.trim(),
          minCreditScore: form.minCreditScore,
          description: form.description.trim(),
          images: form.images,
        },
        token
      );
      onCreateOpenChange?.(false);
      setScope('CREATED');
      onShowToast?.({ title: '託購已建立', message: '委託單已送出。' });
      refresh();
    } catch (createErrorValue) {
      setCreateError(createErrorValue.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmitQuote = async (request, payload) => {
    if (!token) {
      setQuoteTarget(null);
      onRequireLogin?.();
      return;
    }

    if (!payload.quoteAmount) {
      setQuoteSubmitError('請輸入報價金額');
      return;
    }

    setActionId(request.id);
    setQuoteSubmitError('');
    setError('');

    try {
      await createPurchaseRequestQuote(
        request.id,
        {
          quoteAmount: payload.quoteAmount,
          note: payload.note,
        },
        token
      );
      setQuoteTarget(null);
      onShowToast?.({ title: '報價已送出', message: '已送出你的委託報價。' });
      refresh();
    } catch (quoteError) {
      setQuoteSubmitError(quoteError instanceof Error ? quoteError.message : '報價送出失敗');
    } finally {
      setActionId(null);
    }
  };

  const handleToggleQuotes = async (request) => {
    if (openQuotesRequestId === request.id) {
      setOpenQuotesRequestId(null);
      return;
    }
    if (!token) {
      onRequireLogin?.();
      return;
    }

    setOpenQuotesRequestId(request.id);
    setLoadingQuotesId(request.id);
    try {
      const data = await fetchPurchaseRequestQuotes(request.id, token);
      setQuotesByRequestId((current) => ({
        ...current,
        [request.id]: Array.isArray(data) ? data.map(normalizeQuote) : [],
      }));
    } catch (quoteError) {
      setError(quoteError.message);
    } finally {
      setLoadingQuotesId(null);
    }
  };

  const handleOpenImageOrder = (request, startIndex = 0) => {
    const images = (Array.isArray(request.imageUrls) ? request.imageUrls : []).filter(Boolean);
    if (images.length === 0) {
      return;
    }

    const canReorder = Boolean(token) && isSameUser(request.requester?.id, user?.id) && request.status === 'OPEN' && images.length > 1;

    setImageOrderState({
      request,
      images,
      originalImages: images,
      activeIndex: Math.min(Math.max(startIndex, 0), images.length - 1),
      canReorder,
      isSaving: false,
      error: '',
      message: '',
    });
  };

  const handleCloseImageOrder = () => {
    setImageOrderState((current) => ({
      ...current,
      request: null,
      images: [],
      originalImages: [],
      activeIndex: 0,
      canReorder: false,
      isSaving: false,
      error: '',
      message: '',
    }));
  };

  const handleSelectImageOrder = (nextIndex) => {
    setImageOrderState((current) => ({
      ...current,
      activeIndex: Math.min(Math.max(nextIndex, 0), Math.max(current.images.length - 1, 0)),
    }));
  };

  const handleStepImageOrder = (direction) => {
    setImageOrderState((current) => {
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

  const handleMoveImageOrder = (fromIndex, toIndex) => {
    setImageOrderState((current) => {
      if (!current.request || !current.canReorder || current.isSaving) {
        return current;
      }

      const nextImages = reorderList(current.images, fromIndex, toIndex);
      if (nextImages === current.images) {
        return current;
      }

      return {
        ...current,
        images: nextImages,
        activeIndex: toIndex,
        error: '',
        message: '',
      };
    });
  };

  const handleMoveImageOrderToFront = (fromIndex) => {
    handleMoveImageOrder(fromIndex, 0);
  };

  const handleSaveImageOrder = async () => {
    const { request, images, originalImages, canReorder, isSaving } = imageOrderState;
    if (!request || !canReorder || isSaving || areStringArraysEqual(images, originalImages)) {
      return;
    }

    if (!token) {
      setImageOrderState((current) => ({
        ...current,
        error: '請先登入後再儲存圖片順序。',
      }));
      onRequireLogin?.();
      return;
    }

    setImageOrderState((current) => ({
      ...current,
      isSaving: true,
      error: '',
      message: '',
    }));

    try {
      const response = await updatePurchaseRequestImageOrder(request.id, images, token);
      const updatedRequest = normalizePurchaseRequest(response);
      const nextImages = updatedRequest.imageUrls;

      setRequests((current) =>
        current.map((item) => (String(item.id) === String(updatedRequest.id) ? updatedRequest : item))
      );
      setImageOrderState((current) => ({
        ...current,
        request: updatedRequest,
        images: nextImages,
        originalImages: nextImages,
        activeIndex: Math.min(current.activeIndex, Math.max(nextImages.length - 1, 0)),
        canReorder: current.canReorder && nextImages.length > 1,
        isSaving: false,
        error: '',
        message: '圖片順序已更新。',
      }));
      onShowToast?.({ title: '圖片順序已更新', message: '託購單封面與圖片排序已儲存。' });
    } catch (saveError) {
      setImageOrderState((current) => ({
        ...current,
        isSaving: false,
        error: saveError instanceof Error ? saveError.message : '圖片順序更新失敗',
      }));
    }
  };

  const handleOpenReview = async (request) => {
    if (!token) {
      onRequireLogin?.();
      return;
    }
    setReviewError('');
    try {
      const status = await checkPurchaseRequestReviewStatus(request.id, token);
      if (status?.isReviewed) {
        setError('你已經評價過這張託購單。');
        return;
      }
      setReviewTarget(request);
    } catch (statusError) {
      setError(statusError.message);
    }
  };

  const handleSubmitReview = async (payload) => {
    if (!reviewTarget) {
      return;
    }

    setIsReviewing(true);
    setReviewError('');
    try {
      await createPurchaseRequestReview(reviewTarget.id, payload, token);
      setReviewTarget(null);
      onShowToast?.({ title: '評價已送出', message: '信用分紀錄已同步更新。' });
      refresh();
    } catch (submitError) {
      setReviewError(submitError.message);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleConfirmCancel = async (request) => {
    if (!token) {
      setCancelTarget(null);
      onRequireLogin?.();
      return;
    }

    setActionId(request.id);
    setError('');
    try {
      await cancelPurchaseRequest(request.id, token);
      setCancelTarget(null);
      onShowToast?.({ title: '委託已取消', message: '這筆託購委託已取消。' });
      refresh();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : '取消委託失敗');
    } finally {
      setActionId(null);
    }
  };

  const emptyText = useMemo(() => {
    if (scope === 'MARKET') {
      return '目前沒有開放中的託購單。';
    }
    if (scope === 'CREATED') {
      return '你還沒有發起託購。';
    }
    if (scope === 'ASSIGNED') {
      return '你還沒有承接託購。';
    }
    return '你還沒有報價過託購。';
  }, [scope]);

  const visibleRequests = useMemo(() => {
    if (!hideUnavailableRequests || scope !== 'MARKET') {
      return requests;
    }

    return requests.filter((request) => request.status === 'OPEN');
  }, [hideUnavailableRequests, requests, scope]);

  const currentScopeLabel = SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? SCOPE_OPTIONS[0].label;

  return (
    <>
      <section className="purchase-request-toolbar">
        <div className="purchase-request-controls">
          <div
            className="purchase-request-scope-select"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setIsScopeMenuOpen(false);
              }
            }}
          >
            <button
              type="button"
              className="purchase-request-scope-trigger"
              onClick={() => setIsScopeMenuOpen((current) => !current)}
              aria-haspopup="listbox"
              aria-expanded={isScopeMenuOpen}
            >
              <span>{currentScopeLabel}</span>
              <span className="purchase-request-scope-chevron" aria-hidden="true"></span>
            </button>
            {isScopeMenuOpen && (
              <div className="purchase-request-scope-menu" role="listbox" aria-label="委託範圍">
                {SCOPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={scope === option.value ? 'active' : ''}
                    role="option"
                    aria-selected={scope === option.value}
                    onClick={() => {
                      setScope(option.value);
                      setIsScopeMenuOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="purchase-request-hide-toggle">
            <input
              type="checkbox"
              checked={hideUnavailableRequests}
              onChange={(event) => onHideUnavailableRequestsChange?.(event.target.checked)}
            />
            <span className="purchase-request-hide-toggle-track" aria-hidden="true">
              <span></span>
            </span>
            <span>隱藏已滿</span>
          </label>
        </div>
      </section>

      <section className={viewMode === 'compact' ? 'purchase-request-grid compact' : 'purchase-request-grid'}>
        {isLoading && <p className="state-message">載入託購單中...</p>}
        {error && <p className="inline-error">{error}</p>}
        {!isLoading && visibleRequests.length === 0 && !error && <p className="state-message empty-card">{emptyText}</p>}

        {visibleRequests.map((request) => {
          const requestKey = `${scope}-${request.id}`;
          const isExpandedCompactRequest = viewMode === 'compact' && expandedCompactRequestId === String(request.id);
          const requestCard = (
            <PurchaseRequestCard
              request={request}
              viewMode={isExpandedCompactRequest ? 'card' : viewMode}
              currentUser={user}
              quotes={quotesByRequestId[request.id] ?? []}
              isQuotesOpen={openQuotesRequestId === request.id}
              isQuotesLoading={loadingQuotesId === request.id}
              actionId={actionId}
              onToggleQuotes={handleToggleQuotes}
              onOpenQuote={(item) => {
                setQuoteSubmitError('');
                setQuoteTarget(item);
              }}
              onAcceptDirectly={(item) => withAction(item, () => acceptPurchaseRequest(item.id, token), '已承接委託。')}
              onAcceptQuote={(item, quote) =>
                withAction(item, () => acceptPurchaseRequestQuote(item.id, quote.id, token), '已接受報價並成立委託。')
              }
              onDeliver={(item) => withAction(item, () => deliverPurchaseRequest(item.id, token), '已標記交付。')}
              onComplete={(item) => withAction(item, () => completePurchaseRequest(item.id, token), '託購已完成。')}
              onCancel={(item) => setCancelTarget(item)}
              onReview={handleOpenReview}
              onManageImages={handleOpenImageOrder}
              onRequireLogin={onRequireLogin}
              onExpand={viewMode === 'compact' && !isExpandedCompactRequest ? setExpandedCompactRequestId : undefined}
            />
          );

          if (!isExpandedCompactRequest) {
            return <div key={requestKey}>{requestCard}</div>;
          }

          return (
            <div key={requestKey} className="mine-expanded-card purchase-request-expanded-card">
              <div className="mine-expanded-card-actions">
                <button type="button" className="text-button" onClick={() => setExpandedCompactRequestId('')}>
                  收合
                </button>
              </div>
              {requestCard}
            </div>
          );
        })}
      </section>

      <PurchaseRequestCreateModal
        isOpen={isCreateOpen}
        isSubmitting={isCreating}
        error={createError}
        onClose={() => onCreateOpenChange?.(false)}
        onSubmit={handleCreate}
      />

      <PurchaseRequestReviewModal
        request={reviewTarget}
        isSubmitting={isReviewing}
        error={reviewError}
        onClose={() => setReviewTarget(null)}
        onSubmit={handleSubmitReview}
      />

      <PurchaseRequestCancelConfirmModal
        request={cancelTarget}
        isSubmitting={Boolean(cancelTarget) && actionId === cancelTarget.id}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
      />

      <PurchaseRequestQuoteModal
        request={quoteTarget}
        isSubmitting={Boolean(quoteTarget) && actionId === quoteTarget.id}
        error={quoteSubmitError}
        onClose={() => {
          setQuoteTarget(null);
          setQuoteSubmitError('');
        }}
        onSubmit={handleSubmitQuote}
      />

      <ImageGalleryModal
        isOpen={Boolean(imageOrderState.request)}
        title={imageOrderState.request?.productName ?? '託購圖片'}
        images={imageOrderState.images}
        activeIndex={imageOrderState.activeIndex}
        onClose={handleCloseImageOrder}
        onPrev={() => handleStepImageOrder('prev')}
        onNext={() => handleStepImageOrder('next')}
        onSelect={handleSelectImageOrder}
        canReorder={imageOrderState.canReorder}
        canSaveOrder={imageOrderState.canReorder && !areStringArraysEqual(imageOrderState.images, imageOrderState.originalImages)}
        isSavingOrder={imageOrderState.isSaving}
        orderMessage={imageOrderState.message}
        orderError={imageOrderState.error}
        onMoveImage={handleMoveImageOrder}
        onMoveImageToFront={handleMoveImageOrderToFront}
        onSaveOrder={handleSaveImageOrder}
      />
    </>
  );
}

export default PurchaseRequestsPanel;
