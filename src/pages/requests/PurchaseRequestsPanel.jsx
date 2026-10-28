import useSessionPreference from '../../layouts/useSessionPreference';
import PurchaseRequestReviewModal from "../../components/purchase/PurchaseRequestReviewModal";
import PurchaseRequestCancelConfirmModal from "../../components/purchase/PurchaseRequestCancelConfirmModal";
import PurchaseRequestQuoteModal from "../../components/purchase/PurchaseRequestQuoteModal";
import PurchaseRequestEditModal from "../../components/purchase/PurchaseRequestEditModal";
import PurchaseRequestCard from "../../components/purchase/PurchaseRequestCard";
import PurchaseRequestCreateModal from "../../components/purchase/PurchaseRequestCreateModal";
import { STATUS_LABELS, getDeliveryLabel, isSameUser } from "../../components/purchase/purchaseRequestUtils";
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  acceptPurchaseRequest,
  addPurchaseRequestImages,
  acceptPurchaseRequestQuote,
  cancelPurchaseRequest,
  checkPurchaseRequestReviewStatus,
  completePurchaseOrder,
  createPurchaseRequest,
  createPurchaseRequestQuote,
  createPurchaseRequestReview,
  deliverPurchaseOrder,
  deletePurchaseRequestImage,
  extendPurchaseRequest,
  fetchMyAssignedPurchaseRequests,
  fetchMyCreatedPurchaseRequests,
  fetchMyQuotedPurchaseRequests,
  fetchPurchaseOrders,
  fetchPurchaseRequest,
  fetchPurchaseRequestQuotes,
  fetchPurchaseRequests,
  uploadFiles,
  updatePurchaseRequest,
  updatePurchaseRequestQuote,
  updatePurchaseRequestImageOrder,
  withdrawPurchaseRequestQuote,
} from "../../api";
import ImageGalleryModal from "../../components/media/ImageGalleryModal";
import PurchaseOrderModal from "../../components/purchase/PurchaseOrderModal";
import { sharePurchaseRequest } from "../../shareUtils";
import ActionDialog from "../../components/feedback/ActionDialog";

const PAGE_SIZE = 20;

function toRequestExpireDateTime(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T23:59:59`;
  if (value?.length === 16) return `${value}:00`;
  return value;
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: '全部' },
  { value: 'OPEN', label: STATUS_LABELS.OPEN },
  { value: 'QUOTING', label: STATUS_LABELS.QUOTING },
  { value: 'ORDERED', label: STATUS_LABELS.ORDERED },
  { value: 'CANCELLED', label: STATUS_LABELS.CANCELLED },
  { value: 'EXPIRED', label: STATUS_LABELS.EXPIRED },
];

const MARKET_STATUS_OPTIONS = [
  { value: 'ALL', label: '全部' },
  { value: 'OPEN', label: '直接承接' },
  { value: 'QUOTING', label: '可報價' },
];

function normalizeUserSummary(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id ?? user.userId ?? user.user_id ?? null,
    displayName: user.displayName ?? user.display_name ?? '--',
    profileImageUrl: user.profileImageUrl ?? user.profile_image_url ?? user.avatarUrl ?? user.avatar_url ?? '',
    creditScore: user.creditScore ?? user.credit_score ?? '--',
  };
}

function normalizePurchaseRequest(item) {
  const imageUrls = Array.isArray(item?.imageUrls)
    ? item.imageUrls
    : Array.isArray(item?.image_urls)
      ? item.image_urls
      : [];
  const requester = item?.requester ?? item?.requesterSummary ?? item?.requester_summary ?? {};
  const deliveryDetails = Array.isArray(item?.deliveryDetails)
    ? item.deliveryDetails
    : Array.isArray(item?.delivery_details)
      ? item.delivery_details
      : [];
  const deliveryAreas = [...new Set(
    deliveryDetails
      .map((detail) => [detail?.city, detail?.district].filter(Boolean).join('').trim())
      .filter(Boolean)
  )];

  return {
    ...item,
    id: item?.id,
    productName: item?.itemName ?? item?.item_name ?? item?.productName ?? item?.product_name ?? '--',
    imageUrls,
    rewardType: (item?.rewardType ?? item?.reward_type ?? 'FIXED').toString().toUpperCase(),
    fixedRewardAmount: item?.fixedRewardAmount ?? item?.fixed_reward_amount ?? null,
    quoteCount: Number(item?.quoteCount ?? item?.quote_count ?? 0),
    deliveryMethod: (item?.deliveryMethod ?? item?.delivery_method ?? '').toString().toUpperCase(),
    requesterCity: item?.requesterCity ?? item?.requester_city ?? '',
    requesterDistrict: item?.requesterDistrict ?? item?.requester_district ?? '',
    requestArea:
      deliveryAreas.join('、') ||
      [item?.requesterCity ?? item?.requester_city, item?.requesterDistrict ?? item?.requester_district]
        .filter(Boolean)
        .join('') || item?.requestArea || item?.request_area || '',
    deliveryPublicSummary:
      item?.deliveryPublicSummary ?? item?.delivery_public_summary ?? item?.deliveryTimeNote ?? item?.delivery_time_note ?? '',
    deliveryDetails,
    deadlineAt: item?.requestExpireTime ?? item?.request_expire_time ?? item?.deadlineAt ?? item?.deadline_at ?? '',
    deliveryDeadlineHours: item?.deliveryDeadlineHours ?? item?.delivery_deadline_hours ?? null,
    minCreditScore: item?.minCreditScore ?? item?.min_credit_score ?? null,
    description: item?.itemDescription ?? item?.item_description ?? item?.description ?? '',
    status: (item?.status ?? 'OPEN').toString().toUpperCase(),
    requester: normalizeUserSummary({
      id: item?.requesterId ?? item?.requester_id ?? requester.id ?? requester.userId ?? requester.user_id,
      displayName:
        item?.requesterDisplayName ?? item?.requester_display_name ?? requester.displayName ?? requester.display_name,
      profileImageUrl:
        item?.requesterProfileImageUrl ??
        item?.requester_profile_image_url ??
        requester.profileImageUrl ??
        requester.profile_image_url ??
        requester.avatarUrl ??
        requester.avatar_url,
      creditScore:
        item?.requesterCreditScore ?? item?.requester_credit_score ?? requester.creditScore ?? requester.credit_score,
    }),
    assignedRunner: normalizeUserSummary(item?.assignedRunner ?? item?.assigned_runner),
    acceptedQuoteId: item?.acceptedQuoteId ?? item?.accepted_quote_id ?? null,
    assignedAt: item?.assignedAt ?? item?.assigned_at ?? '',
    fulfillmentDeadlineAt: item?.fulfillmentDeadlineAt ?? item?.fulfillment_deadline_at ?? '',
    chatRoomId: item?.chatRoomId ?? item?.chat_room_id ?? null,
    canQuote: Boolean(item?.canQuote ?? item?.can_quote),
    canAcceptDirectly: Boolean(item?.canAcceptDirectly ?? item?.can_accept_directly),
    canEdit: Boolean(item?.canEdit ?? item?.can_edit),
    actBlockedReason: item?.actBlockedReason ?? item?.act_blocked_reason ?? '',
    deliveredAt: item?.deliveredAt ?? item?.delivered_at ?? '',
    completedAt: item?.completedAt ?? item?.completed_at ?? '',
    createdAt: item?.createdAt ?? item?.created_at ?? '',
    updatedAt: item?.updatedAt ?? item?.updated_at ?? '',
  };
}

function normalizePurchaseOrderSummary(order) {
  const request = order?.purchaseRequest ?? order?.purchase_request ?? {};
  const merged = {
    ...request,
    ...order,
    id: order?.purchaseRequestId ?? order?.purchase_request_id ?? request?.id ?? order?.id,
    itemName: order?.itemName ?? order?.item_name ?? request?.itemName ?? request?.item_name,
    imageUrls: order?.imageUrls ?? order?.image_urls ?? request?.imageUrls ?? request?.image_urls,
    rewardType: order?.rewardType ?? order?.reward_type ?? request?.rewardType ?? request?.reward_type,
    fixedRewardAmount:
      order?.fixedRewardAmount ??
      order?.fixed_reward_amount ??
      order?.rewardAmount ??
      order?.reward_amount ??
      request?.fixedRewardAmount ??
      request?.fixed_reward_amount,
    requesterId: order?.requesterId ?? order?.requester_id ?? request?.requesterId ?? request?.requester_id,
    requesterDisplayName:
      order?.requesterDisplayName ??
      order?.requester_display_name ??
      request?.requesterDisplayName ??
      request?.requester_display_name,
    requesterProfileImageUrl:
      order?.requesterProfileImageUrl ??
      order?.requester_profile_image_url ??
      request?.requesterProfileImageUrl ??
      request?.requester_profile_image_url,
    requesterCreditScore:
      order?.requesterCreditScore ??
      order?.requester_credit_score ??
      request?.requesterCreditScore ??
      request?.requester_credit_score,
    deliveryMethod: order?.deliveryMethod ?? order?.delivery_method ?? request?.deliveryMethod ?? request?.delivery_method,
    deliveryPublicSummary:
      order?.deliveryPublicSummary ??
      order?.delivery_public_summary ??
      request?.deliveryPublicSummary ??
      request?.delivery_public_summary,
    requesterCity: order?.requesterCity ?? order?.requester_city ?? request?.requesterCity ?? request?.requester_city,
    requesterDistrict:
      order?.requesterDistrict ?? order?.requester_district ?? request?.requesterDistrict ?? request?.requester_district,
    requestExpireTime:
      order?.requestExpireTime ?? order?.request_expire_time ?? request?.requestExpireTime ?? request?.request_expire_time,
    deliveryDeadlineHours:
      order?.deliveryDeadlineHours ??
      order?.delivery_deadline_hours ??
      request?.deliveryDeadlineHours ??
      request?.delivery_deadline_hours,
    status: order?.status ?? order?.orderStatus ?? order?.order_status ?? request?.status,
  };
  const normalized = normalizePurchaseRequest(merged);

  return {
    ...normalized,
    orderId: order?.id ?? order?.orderId ?? order?.order_id ?? null,
    orderStatus: (order?.status ?? order?.orderStatus ?? order?.order_status ?? '').toString().toUpperCase(),
    runner: normalizeUserSummary(
      order?.runner ?? {
        id: order?.runnerId ?? order?.runner_id,
        displayName: order?.runnerDisplayName ?? order?.runner_display_name,
        profileImageUrl: order?.runnerProfileImageUrl ?? order?.runner_profile_image_url,
        creditScore: order?.runnerCreditScore ?? order?.runner_credit_score,
      }
    ),
    selectedQuoteId: order?.selectedQuoteId ?? order?.selected_quote_id ?? null,
    deliveryDeadlineAt: order?.deliveryDeadlineAt ?? order?.delivery_deadline_at ?? '',
  };
}

function normalizeQuote(quote) {
  return {
    id: quote?.id,
    purchaseRequestId: quote?.purchaseRequestId ?? quote?.purchase_request_id,
    quoteAmount: quote?.quoteAmount ?? quote?.quote_amount ?? 0,
    note: quote?.quoteNote ?? quote?.quote_note ?? quote?.note ?? '',
    status: (quote?.status ?? 'PENDING').toString().toUpperCase(),
    runner: normalizeUserSummary(
      quote?.runner ?? {
        id: quote?.quoterId ?? quote?.quoter_id,
        displayName: quote?.quoterDisplayName ?? quote?.quoter_display_name,
        profileImageUrl: quote?.quoterProfileImageUrl ?? quote?.quoter_profile_image_url,
        creditScore: quote?.quoterCreditScore ?? quote?.quoter_credit_score,
      }
    ),
    createdAt: quote?.createdAt ?? quote?.created_at ?? '',
  };
}

function normalizeQuoteAsPurchaseRequest(quote) {
  const normalizedQuote = normalizeQuote(quote);
  const itemImageUrls = Array.isArray(quote?.itemImageUrls)
    ? quote.itemImageUrls
    : Array.isArray(quote?.item_image_urls)
      ? quote.item_image_urls
      : [];

  return {
    ...normalizePurchaseRequest({
      ...quote,
      id: normalizedQuote.purchaseRequestId,
      itemName: quote?.itemName ?? quote?.item_name,
      imageUrls: itemImageUrls,
      requesterDisplayName: quote?.requesterDisplayName ?? quote?.requester_display_name,
      status: normalizedQuote.status,
      rewardType: 'QUOTE',
    }),
    quoteId: normalizedQuote.id,
    quoteStatus: normalizedQuote.status,
    quoteAmount: normalizedQuote.quoteAmount,
    quoteNote: normalizedQuote.note,
  };
}

function normalizePageItems(data, mapper = normalizePurchaseRequest) {
  return Array.isArray(data?.content) ? data.content.map(mapper) : [];
}

function dedupePurchaseRequests(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item?.id == null ? `${item?.productName ?? ''}-${item?.createdAt ?? ''}` : String(item.id);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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

function PurchaseRequestsPanel({
  token,
  user,
  keyword = '',
  viewMode = 'card',
  isCreateOpen,
  initialScope = 'MARKET',
  scopeOptions = [],
  scopeControl = 'dropdown',
  pageHeader = null,
  onCreateOpenChange,
  onModalOpenChange,
  onRequireLogin,
  onShowToast,
  onOpenPurchaseChat,
}) {
  const [scope, setScope] = useSessionPreference(`requests:${initialScope}:scope`, initialScope);
  const [statusFilter, setStatusFilter] = useSessionPreference(`requests:${initialScope}:status`, 'ALL');
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionId, setActionId] = useState(null);
  const [quoteTarget, setQuoteTarget] = useState(null);
  const [quoteEditTarget, setQuoteEditTarget] = useState(null);
  const [quoteSubmitError, setQuoteSubmitError] = useState('');
  const [openQuotesRequestId, setOpenQuotesRequestId] = useState(null);
  const [quotesByRequestId, setQuotesByRequestId] = useState({});
  const [loadingQuotesId, setLoadingQuotesId] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewError, setReviewError] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [actionDialogTarget, setActionDialogTarget] = useState(null);
  const [extendDeadline, setExtendDeadline] = useState('');
  const [extendError, setExtendError] = useState('');
  const [orderTarget, setOrderTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editError, setEditError] = useState('');
  const [expandedCompactRequestId, setExpandedCompactRequestId] = useState('');
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

  useEffect(() => {
    if (!scopeOptions.some((option) => option.value === scope)) {
      setScope(scopeOptions[0]?.value ?? 'MARKET');
    }
  }, [scope, scopeOptions, setScope]);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const query = { page: 0, size: PAGE_SIZE };
      let data;

      if (scope === 'MY_ALL') {
        if (!token) {
          setRequests([]);
          setError('請先登入查看我的託購。');
          return;
        }

        const [createdData, requesterOrderData, quotedData, assignedData] = await Promise.all([
          fetchMyCreatedPurchaseRequests(query, token),
          fetchPurchaseOrders({ ...query, role: 'REQUESTER' }, token),
          fetchMyQuotedPurchaseRequests(query, token),
          fetchMyAssignedPurchaseRequests(query, token),
        ]);
        setRequests(
          dedupePurchaseRequests([
            ...normalizePageItems(requesterOrderData, normalizePurchaseOrderSummary),
            ...normalizePageItems(createdData),
            ...normalizePageItems(quotedData, normalizeQuoteAsPurchaseRequest),
            ...normalizePageItems(assignedData, normalizePurchaseOrderSummary),
          ])
        );
        return;
      }

      if (scope === 'CREATED') {
        if (!token) {
          setRequests([]);
          setError('請先登入查看我發起的託購。');
          return;
        }
        const [createdData, requesterOrderData] = await Promise.all([
          fetchMyCreatedPurchaseRequests(query, token),
          fetchPurchaseOrders({ ...query, role: 'REQUESTER' }, token),
        ]);
        setRequests(
          dedupePurchaseRequests([
            ...normalizePageItems(requesterOrderData, normalizePurchaseOrderSummary),
            ...normalizePageItems(createdData),
          ])
        );
        return;
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
            status: statusFilter === 'ALL' ? undefined : statusFilter,
            keyword: keyword.trim() || undefined,
          },
          token
        );
      }

      if (scope === 'ASSIGNED') {
        setRequests(normalizePageItems(data, normalizePurchaseOrderSummary));
      } else if (scope === 'QUOTED') {
        setRequests(normalizePageItems(data, normalizeQuoteAsPurchaseRequest));
      } else {
        setRequests(normalizePageItems(data));
      }
    } catch (loadError) {
      setError(loadError.message);
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [keyword, scope, statusFilter, token]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests, refreshKey]);

  useEffect(() => {
    if (viewMode !== 'compact') {
      setExpandedCompactRequestId('');
    }
  }, [viewMode]);

  useEffect(() => {
    const hasInternalModalOpen = Boolean(quoteTarget || quoteEditTarget || reviewTarget || cancelTarget || orderTarget || editTarget || imageOrderState.request);
    onModalOpenChange?.(hasInternalModalOpen);

    return () => {
      onModalOpenChange?.(false);
    };
  }, [cancelTarget, editTarget, imageOrderState.request, onModalOpenChange, orderTarget, quoteEditTarget, quoteTarget, reviewTarget]);

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
    if (!form.itemName.trim()) {
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
    if (!Array.isArray(form.selectedProfileIds) || form.selectedProfileIds.length === 0) {
      setCreateError(`請選擇至少一筆${getDeliveryLabel(form.deliveryMethod)}資料`);
      return;
    }
    if (!form.requestExpireTime || Number(form.deliveryDeadlineHours) <= 0) {
      setCreateError('請填寫有效的委託到期日與交付時限');
      return;
    }

    setIsCreating(true);
    setCreateError('');
    try {
      const uploadResult = form.images.length > 0 ? await uploadFiles(form.images, token) : null;
      const imageUrls = Array.isArray(uploadResult?.urls) ? uploadResult.urls : [];
      if (form.images.length > 0 && imageUrls.length !== form.images.length) {
        throw new Error('圖片上傳結果不完整，請稍後再試。');
      }
      const requestExpireTime = toRequestExpireDateTime(form.requestExpireTime);
      await createPurchaseRequest(
        {
          itemName: form.itemName.trim(),
          itemDescription: form.itemDescription.trim() || undefined,
          imageUrls,
          rewardType: form.rewardType,
          fixedRewardAmount: form.rewardType === 'FIXED' ? Number(form.fixedRewardAmount) : undefined,
          deliveryMethod: form.deliveryMethod,
          requestExpireTime,
          deliveryDeadlineHours: Number(form.deliveryDeadlineHours),
          minCreditScore: form.minCreditScore === '' ? 0 : Number(form.minCreditScore),
          selectedProfileIds: form.selectedProfileIds,
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
          quoteNote: payload.note,
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

  const handleUpdateQuote = async (request, payload) => {
    if (!token || request.quoteId == null) {
      setQuoteEditTarget(null);
      onRequireLogin?.();
      return;
    }
    if (!payload.quoteAmount) {
      setQuoteSubmitError('請輸入報價金額');
      return;
    }

    setActionId(request.id);
    setQuoteSubmitError('');
    try {
      await updatePurchaseRequestQuote(
        request.quoteId,
        { quoteAmount: Number(payload.quoteAmount), quoteNote: payload.note?.trim() || undefined },
        token
      );
      setQuoteEditTarget(null);
      onShowToast?.({ title: '報價已更新', message: '新的報價內容已儲存。' });
      refresh();
    } catch (nextError) {
      setQuoteSubmitError(nextError instanceof Error ? nextError.message : '報價更新失敗');
    } finally {
      setActionId(null);
    }
  };

  const LEGACY_HANDLE_WITHDRAW_QUOTE = async (request) => {
    await withAction(
      request,
      () => withdrawPurchaseRequestQuote(request.quoteId, token),
      '報價已撤回。'
    );
  };

  const handleUpdateRequest = async (request, form) => {
    if (!token) {
      setEditTarget(null);
      onRequireLogin?.();
      return;
    }
    if (request.status !== 'QUOTING' && (!Array.isArray(form.selectedProfileIds) || form.selectedProfileIds.length === 0)) {
      setEditError(`請選擇至少一筆${getDeliveryLabel(form.deliveryMethod)}資料`);
      return;
    }
    const requestExpireTime = toRequestExpireDateTime(form.requestExpireTime);
    const payload = request.status === 'QUOTING'
      ? { requestExpireTime }
      : {
          itemName: form.itemName.trim(),
          itemDescription: form.itemDescription.trim() || undefined,
          fixedRewardAmount: request.rewardType === 'FIXED' ? Number(form.fixedRewardAmount) : undefined,
          deliveryMethod: form.deliveryMethod,
          selectedProfileIds: form.selectedProfileIds,
          requestExpireTime,
          deliveryDeadlineHours: Number(form.deliveryDeadlineHours),
          minCreditScore: form.minCreditScore === '' ? 0 : Number(form.minCreditScore),
        };

    setActionId(request.id);
    setEditError('');
    try {
      await updatePurchaseRequest(request.id, payload, token);
      setEditTarget(null);
      onShowToast?.({ title: '委託已更新', message: '委託內容已儲存。' });
      refresh();
    } catch (nextError) {
      setEditError(nextError instanceof Error ? nextError.message : '委託更新失敗');
    } finally {
      setActionId(null);
    }
  };

  const handleOpenEditRequest = async (request) => {
    setEditError('');
    if (!token) {
      onRequireLogin?.();
      return;
    }
    try {
      const detail = await fetchPurchaseRequest(request.id, token);
      setEditTarget(normalizePurchaseRequest({ ...request, ...detail }));
    } catch (nextError) {
      setEditError(nextError instanceof Error ? nextError.message : '委託詳情載入失敗');
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
      const nextImages = Array.isArray(response?.imageUrls) ? response.imageUrls : images;
      const updatedRequest = { ...request, imageUrls: nextImages };

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

  const handleAddRequestImages = async (files) => {
    const request = imageOrderState.request;
    if (!request || !token || files.length === 0) return;
    setImageOrderState((current) => ({ ...current, isSaving: true, error: '', message: '' }));
    try {
      const response = await addPurchaseRequestImages(request.id, files, token);
      const nextImages = Array.isArray(response?.imageUrls) ? response.imageUrls : imageOrderState.images;
      const updatedRequest = { ...request, imageUrls: nextImages };
      setRequests((current) => current.map((item) => (String(item.id) === String(request.id) ? { ...item, imageUrls: nextImages } : item)));
      setImageOrderState((current) => ({
        ...current,
        request: updatedRequest,
        images: nextImages,
        originalImages: nextImages,
        activeIndex: Math.max(nextImages.length - 1, 0),
        canReorder: nextImages.length > 1,
        isSaving: false,
        message: '圖片已新增。',
      }));
      onShowToast?.({ title: '圖片已新增', message: '託購圖片已更新。' });
    } catch (nextError) {
      setImageOrderState((current) => ({ ...current, isSaving: false, error: nextError instanceof Error ? nextError.message : '圖片新增失敗' }));
    }
  };

  const LEGACY_HANDLE_DELETE_REQUEST_IMAGE = async (imageUrl, imageIndex) => {
    const request = imageOrderState.request;
    if (!request || !token) return;
    const path = (() => {
      try {
        return new URL(imageUrl, window.location.origin).pathname;
      } catch {
        return imageUrl;
      }
    })();
    const fileName = decodeURIComponent(path.split('/').filter(Boolean).pop() ?? '');
    if (!fileName) return;

    setImageOrderState((current) => ({ ...current, isSaving: true, error: '', message: '' }));
    try {
      const response = await deletePurchaseRequestImage(request.id, fileName, token);
      const nextImages = Array.isArray(response?.imageUrls)
        ? response.imageUrls
        : imageOrderState.images.filter((_, index) => index !== imageIndex);
      const updatedRequest = { ...request, imageUrls: nextImages };
      setRequests((current) => current.map((item) => (String(item.id) === String(request.id) ? { ...item, imageUrls: nextImages } : item)));
      setImageOrderState((current) => ({
        ...current,
        request: updatedRequest,
        images: nextImages,
        originalImages: nextImages,
        activeIndex: Math.min(current.activeIndex, Math.max(nextImages.length - 1, 0)),
        canReorder: nextImages.length > 1,
        isSaving: false,
        message: '圖片已刪除。',
      }));
    } catch (nextError) {
      setImageOrderState((current) => ({ ...current, isSaving: false, error: nextError instanceof Error ? nextError.message : '圖片刪除失敗' }));
    }
  };

  const handleOpenReview = async (request) => {
    if (!token) {
      onRequireLogin?.();
      return;
    }
    if (request.orderId == null) {
      setError('這筆託購尚未取得訂單編號，無法評價。');
      return;
    }
    setReviewError('');
    try {
      const status = await checkPurchaseRequestReviewStatus(request.orderId, token);
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
      await createPurchaseRequestReview(reviewTarget.orderId, payload, token);
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

  const LEGACY_HANDLE_EXTEND = async (request) => {
    if (!token) {
      onRequireLogin?.();
      return;
    }

    const nextValue = '';
    if (!nextValue) {
      return;
    }

    const requestExpireTime = toRequestExpireDateTime(nextValue);
    await withAction(
      request,
      () => extendPurchaseRequest(request.id, requestExpireTime, token),
      '委託期限已延長。'
    );
  };

  const handleWithdrawQuote = (request) => setActionDialogTarget({ type: 'WITHDRAW_QUOTE', request });

  const handleDeleteRequestImage = (imageUrl, imageIndex) => {
    if (imageOrderState.request) setActionDialogTarget({ type: 'DELETE_IMAGE', imageUrl, imageIndex, request: imageOrderState.request });
  };

  const handleExtend = (request) => {
    if (!token) {
      onRequireLogin?.();
      return;
    }
    setExtendError('');
    setExtendDeadline(request.deadlineAt ? request.deadlineAt.slice(0, 10) : '');
    setActionDialogTarget({ type: 'EXTEND', request });
  };

  const handleActionDialogConfirm = async () => {
    const target = actionDialogTarget;
    if (!target || !token) return;
    if (target.type === 'WITHDRAW_QUOTE') {
      await withAction(target.request, () => withdrawPurchaseRequestQuote(target.request.quoteId, token), '已撤回報價。');
      setActionDialogTarget(null);
      return;
    }
    if (target.type === 'EXTEND') {
      if (!extendDeadline) {
        setExtendError('請選擇新的委託到期日。');
        return;
      }
      const requestExpireTime = toRequestExpireDateTime(extendDeadline);
      await withAction(target.request, () => extendPurchaseRequest(target.request.id, requestExpireTime, token), '委託期限已延長。');
      setActionDialogTarget(null);
      return;
    }
    if (target.type === 'DELETE_IMAGE') {
      const path = (() => {
        try { return new URL(target.imageUrl, window.location.origin).pathname; } catch { return target.imageUrl; }
      })();
      const fileName = decodeURIComponent(path.split('/').filter(Boolean).pop() ?? '');
      if (!fileName) return;
      setImageOrderState((current) => ({ ...current, isSaving: true, error: '', message: '' }));
      try {
        const response = await deletePurchaseRequestImage(target.request.id, fileName, token);
        const nextImages = Array.isArray(response?.imageUrls) ? response.imageUrls : imageOrderState.images.filter((_, index) => index !== target.imageIndex);
        const updatedRequest = { ...target.request, imageUrls: nextImages };
        setRequests((current) => current.map((item) => (String(item.id) === String(target.request.id) ? { ...item, imageUrls: nextImages } : item)));
        setImageOrderState((current) => ({ ...current, request: updatedRequest, images: nextImages, originalImages: nextImages, activeIndex: Math.min(current.activeIndex, Math.max(nextImages.length - 1, 0)), canReorder: nextImages.length > 1, isSaving: false, message: '圖片已刪除。' }));
        setActionDialogTarget(null);
      } catch (nextError) {
        setImageOrderState((current) => ({ ...current, isSaving: false, error: nextError instanceof Error ? nextError.message : '圖片刪除失敗。' }));
      }
    }
  };

  const emptyText = useMemo(() => {
    if (scope === 'MARKET') {
      return '目前沒有開放中的託購單。';
    }
    if (scope === 'MY_ALL') {
      return '你還沒有相關託購。';
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
    let nextRequests = requests;

    if (statusFilter !== 'ALL') {
      nextRequests = nextRequests.filter((request) => request.status === statusFilter);
    }

    return nextRequests;
  }, [requests, statusFilter]);

  const useScopeTabs = scopeControl === 'tabs';
  const statusOptions = scope === 'MARKET' ? MARKET_STATUS_OPTIONS : STATUS_OPTIONS;

  useEffect(() => {
    if (!statusOptions.some((option) => option.value === statusFilter)) {
      setStatusFilter('ALL');
    }
  }, [statusFilter, statusOptions, setStatusFilter]);

  return (
    <>
      <section className={`purchase-request-toolbar${pageHeader ? ' purchase-request-page-header page-header-panel' : ''}`}>
        {pageHeader}
        {useScopeTabs && (
          <div className="purchase-request-controls">
            <section className="category-strip purchase-request-scope-tabs" aria-label="委託範圍">
              {scopeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={scope === option.value ? 'category-button active' : 'category-button'}
                  onClick={() => setScope(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </section>
          </div>
        )}
        <section className="mine-status-inline-filter purchase-request-status-filter">
          {useScopeTabs && <span className="mine-status-filter-label">狀態</span>}
          <div className="purchase-request-status-row">
            <div className="mine-status-filter-options">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={statusFilter === option.value ? 'status-filter-button active' : 'status-filter-button'}
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>
        <label className="mine-status-filter purchase-request-status-select">
          <span className="mine-status-filter-label">狀態</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
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
              onDeliver={(item) => withAction(item, () => deliverPurchaseOrder(item.orderId, token), '已標記交付。')}
              onComplete={(item) => withAction(item, () => completePurchaseOrder(item.orderId, token), '託購已完成。')}
              onCancel={(item) => setCancelTarget(item)}
              onExtend={handleExtend}
              onReview={handleOpenReview}
              onOpenOrder={setOrderTarget}
              onOpenChat={onOpenPurchaseChat}
              onShare={sharePurchaseRequest}
              onEditOwnQuote={(item) => {
                setQuoteSubmitError('');
                setQuoteEditTarget(item);
              }}
              onWithdrawOwnQuote={handleWithdrawQuote}
              onEditRequest={(item) => void handleOpenEditRequest(item)}
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
              {requestCard}
            </div>
          );
        })}
      </section>

      <PurchaseRequestCreateModal
        key={isCreateOpen ? 'purchase-create-open' : 'purchase-create-closed'}
        isOpen={isCreateOpen}
        token={token}
        isSubmitting={isCreating}
        error={createError}
        onClose={() => onCreateOpenChange?.(false)}
        onSubmit={handleCreate}
      />

      <PurchaseRequestReviewModal
        key={reviewTarget ? `purchase-review-${reviewTarget.orderId}` : 'purchase-review-closed'}
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

      <ActionDialog
        isOpen={Boolean(actionDialogTarget)}
        eyebrow="託購委託"
        title={actionDialogTarget?.type === 'WITHDRAW_QUOTE' ? '撤回報價' : actionDialogTarget?.type === 'DELETE_IMAGE' ? '刪除圖片' : '延長委託到期日'}
        description={actionDialogTarget?.type === 'WITHDRAW_QUOTE' ? '撤回後不能再次建立同一筆委託的報價。' : actionDialogTarget?.type === 'DELETE_IMAGE' ? '確定刪除這張圖片？' : '請設定新的委託到期日。'}
        confirmLabel={actionDialogTarget?.type === 'WITHDRAW_QUOTE' ? '確認撤回' : actionDialogTarget?.type === 'DELETE_IMAGE' ? '確認刪除' : '確認延長'}
        confirmClassName={actionDialogTarget?.type === 'EXTEND' ? 'save-button' : 'ghost-button danger'}
        isSubmitting={Boolean(actionDialogTarget?.request) && actionId === actionDialogTarget.request.id || imageOrderState.isSaving}
        onClose={() => !imageOrderState.isSaving && setActionDialogTarget(null)}
        onConfirm={handleActionDialogConfirm}
      >
        {actionDialogTarget?.type === 'EXTEND' && <label className="form-field"><span>新的委託到期日 *</span><input type="date" className="local-date-input" max="9999-12-31" value={extendDeadline} onChange={(event) => { setExtendDeadline(event.target.value); setExtendError(''); }} autoFocus />{extendError && <p className="inline-error">{extendError}</p>}</label>}
      </ActionDialog>

      <PurchaseRequestQuoteModal
        key={quoteTarget ? `create-${quoteTarget.id}` : 'create-closed'}
        request={quoteTarget}
        isSubmitting={Boolean(quoteTarget) && actionId === quoteTarget.id}
        error={quoteSubmitError}
        onClose={() => {
          setQuoteTarget(null);
          setQuoteSubmitError('');
        }}
        onSubmit={handleSubmitQuote}
      />

      <PurchaseRequestQuoteModal
        key={quoteEditTarget ? `edit-${quoteEditTarget.quoteId}` : 'edit-closed'}
        request={quoteEditTarget}
        initialQuote={quoteEditTarget ? { quoteAmount: quoteEditTarget.quoteAmount, quoteNote: quoteEditTarget.quoteNote } : null}
        isSubmitting={Boolean(quoteEditTarget) && actionId === quoteEditTarget.id}
        error={quoteSubmitError}
        onClose={() => {
          setQuoteEditTarget(null);
          setQuoteSubmitError('');
        }}
        onSubmit={handleUpdateQuote}
      />

      <PurchaseRequestEditModal
        key={editTarget ? `request-edit-${editTarget.id}` : 'request-edit-closed'}
        request={editTarget}
        token={token}
        isSubmitting={Boolean(editTarget) && actionId === editTarget.id}
        error={editError}
        onClose={() => {
          setEditTarget(null);
          setEditError('');
        }}
        onSubmit={handleUpdateRequest}
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
        canAdd={Boolean(imageOrderState.request) && imageOrderState.request?.status === 'OPEN'}
        canDelete={Boolean(imageOrderState.request) && imageOrderState.request?.status === 'OPEN'}
        isManagingImages={imageOrderState.isSaving}
        onAddImages={handleAddRequestImages}
        onDeleteImage={handleDeleteRequestImage}
      />

      <PurchaseOrderModal
        isOpen={Boolean(orderTarget)}
        orderId={orderTarget?.orderId}
        token={token}
        currentUser={user}
        onOpenChat={async (order) => {
          const returnOrderTarget = orderTarget;
          const opened = await onOpenPurchaseChat?.({
            ...orderTarget,
            ...order,
            id: order.chatRoomId,
            roomType: 'PURCHASE',
            orderId: order.id,
            itemName: order.itemName,
            counterpartId: String(order.requesterId) === String(user?.id) ? order.runnerId : order.requesterId,
            counterpartName:
              String(order.requesterId) === String(user?.id) ? order.runnerDisplayName : order.requesterDisplayName,
          }, {
            returnContext: {
              type: 'PURCHASE_ORDER',
              restore: () => setOrderTarget(returnOrderTarget),
            },
          });
          if (opened) {
            setOrderTarget(null);
          }
        }}
        onUpdated={() => {
          refresh();
          onShowToast?.({ title: '訂單已更新', message: '最新狀態已同步。' });
        }}
        onClose={() => setOrderTarget(null)}
      />

    </>
  );
}

export default PurchaseRequestsPanel;
