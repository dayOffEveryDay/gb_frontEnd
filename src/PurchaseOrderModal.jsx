import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  blockPurchaseUser,
  cancelPurchaseOrderAsRequester,
  cancelPurchaseOrderAsRunner,
  completePurchaseOrder,
  confirmPurchaseOrderAsRequester,
  confirmPurchaseOrderAsRunner,
  deliverPurchaseOrder,
  fetchPurchaseOrder,
  fetchPurchaseOrderEvents,
  markPurchaseOrderItemUnavailable,
  reportPurchaseOrderAbnormal,
  respondPurchaseOrderAbnormal,
  shipPurchaseOrder,
  startPurchaseOrder,
} from './api';
import { formatDateTime } from './homeUtils';
import ActionDialog from './ActionDialog';

const ORDER_STATUS_LABELS = {
  WAITING_CONFIRMATION: '等待雙方確認',
  CONFIRMED: '雙方已確認',
  IN_PROGRESS: '採買處理中',
  SHIPPED: '已寄出',
  DELIVERED_PENDING_CONFIRM: '已交付，等待確認',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  UNAVAILABLE_CANCELLED: '缺貨取消',
  ABNORMAL_PENDING_RESPONSE: '異常待回應',
  PENALIZED_CANCELLED: '有責取消',
  DISPUTE_CLOSED_NO_PENALTY: '異常已結案',
};

const DELIVERY_METHOD_LABELS = {
  FACE_TO_FACE: '面交',
  STORE_TO_STORE: '店到店',
  HOME_DELIVERY: '宅配',
};

const EVENT_LABELS = {
  ORDER_CREATED_FROM_QUOTE: '選定報價並成立訂單',
  ORDER_CREATED_BY_ACCEPT: '直接承接並成立訂單',
  ORDER_CONFIRMED: '雙方已確認',
  REQUESTER_CONFIRMED: '委託人確認',
  RUNNER_CONFIRMED: '接單人確認',
  RUNNER_STARTED: '接單人開始處理',
  ORDER_SHIPPED: '商品已寄出',
  RUNNER_MARKED_DELIVERED: '接單人標記交付',
  ORDER_DELIVERED: '商品已交付',
  ORDER_COMPLETED: '訂單完成',
  ORDER_COMPLETED_BY_REQUESTER: '委託人確認完成',
  ORDER_AUTO_COMPLETED: '系統自動完成',
  ITEM_UNAVAILABLE: '商品缺貨',
  ITEM_UNAVAILABLE_REPORTED: '回報商品缺貨',
  ORDER_CANCELLED: '訂單取消',
  ORDER_CANCELLED_BY_REQUESTER: '委託人取消訂單',
  ORDER_CANCELLED_BY_RUNNER: '接單人取消訂單',
  ORDER_CONFIRMATION_TIMEOUT: '訂單確認逾時',
  ABNORMAL_REPORTED: '提出交易異常',
  ABNORMAL_RESPONDED_NO_PENALTY: '已回應交易異常',
  ABNORMAL_TIMEOUT_PENALIZED: '異常逾時處理',
};

function getLabel(map, value) {
  const key = (value ?? '').toString().toUpperCase();
  return map[key] ?? value ?? '--';
}

function UNUSED_PROMPT_REQUIRED() {
  const value = null;
  if (value == null) return null;
  const normalized = value.trim();
  return normalized || null;
}

function getAvailableActions(order, isRequester, isRunner) {
  const actions = new Set(Array.isArray(order?.availableActions) ? order.availableActions : []);
  const status = (order?.status ?? '').toString().toUpperCase();

  if (isRunner && ['WAITING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS'].includes(status)) {
    actions.add('ITEM_UNAVAILABLE');
  }
  if ((isRequester || isRunner) && ['WAITING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS'].includes(status)) {
    actions.add('CANCEL');
  }
  return actions;
}

function PurchaseOrderModal({ isOpen, orderId, token, currentUser, onOpenChat, onUpdated, onClose }) {
  const [order, setOrder] = useState(null);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isUnavailableDialogOpen, setIsUnavailableDialogOpen] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState('');
  const [unavailableStoreName, setUnavailableStoreName] = useState('');
  const [unavailableError, setUnavailableError] = useState('');
  const [actionDialog, setActionDialog] = useState('');
  const [actionDialogError, setActionDialogError] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [shippingForm, setShippingForm] = useState({ logisticsProvider: '', trackingNumber: '', trackingUrl: '' });
  const [abnormalForm, setAbnormalForm] = useState({ abnormalType: 'OTHER', description: '' });
  const [abnormalResponse, setAbnormalResponse] = useState('');

  const loadOrder = useCallback(async () => {
    if (!isOpen || !token || orderId == null) return;
    setIsLoading(true);
    setError('');
    try {
      const [detail, eventData] = await Promise.all([
        fetchPurchaseOrder(orderId, token),
        fetchPurchaseOrderEvents(orderId, token),
      ]);
      setOrder(detail);
      setEvents(Array.isArray(eventData) ? eventData : []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '訂單載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, orderId, token]);

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setIsUnavailableDialogOpen(false);
      setUnavailableReason('');
      setUnavailableStoreName('');
      setUnavailableError('');
      setActionDialog('');
      setActionDialogError('');
      void loadOrder();
    } else {
      setOrder(null);
      setEvents([]);
      setError('');
      setIsUnavailableDialogOpen(false);
      setActionDialog('');
    }
  }, [isOpen, loadOrder]);

  const isRequester = String(order?.requesterId) === String(currentUser?.id);
  const isRunner = String(order?.runnerId) === String(currentUser?.id);
  const availableActions = useMemo(() => getAvailableActions(order, isRequester, isRunner), [isRequester, isRunner, order]);
  const counterpartId = isRequester ? order?.runnerId : order?.requesterId;
  const counterpartName = isRequester ? order?.runnerDisplayName : order?.requesterDisplayName;
  const deliveryMethod = (order?.deliveryMethod ?? '').toString().toUpperCase();

  if (!isOpen) return null;

  const runAction = async (actionName, action, successMessage) => {
    setBusyAction(actionName);
    setError('');
    setMessage('');
    try {
      const updated = await action();
      if (updated) setOrder(updated);
      setMessage(successMessage);
      onUpdated?.(updated);
      await loadOrder();
      return true;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '訂單操作失敗');
      return false;
    } finally {
      setBusyAction('');
    }
  };

  const handleConfirm = () =>
    runAction(
      'CONFIRM',
      () => (isRequester ? confirmPurchaseOrderAsRequester(orderId, token) : confirmPurchaseOrderAsRunner(orderId, token)),
      '已完成交易確認。'
    );

  const LEGACY_HANDLE_CANCEL = () => {
    const reason = UNUSED_PROMPT_REQUIRED();
    if (!reason) return;
    void runAction(
      'CANCEL',
      () =>
        isRequester
          ? cancelPurchaseOrderAsRequester(orderId, { reason }, token)
          : cancelPurchaseOrderAsRunner(orderId, { reason }, token),
      '訂單已取消。'
    );
  };

  const handleSubmitUnavailable = async (event) => {
    event.preventDefault();
    const reason = unavailableReason.trim();

    if (!reason) {
      setUnavailableError('請輸入缺貨原因。');
      return;
    }

    setUnavailableError('');
    const succeeded = await runAction(
      'ITEM_UNAVAILABLE',
      () =>
        markPurchaseOrderItemUnavailable(
          orderId,
          { reason, storeName: unavailableStoreName.trim() || undefined, imageUrls: [] },
          token
        ),
      '已回報商品缺貨。'
    );

    if (succeeded) {
      setIsUnavailableDialogOpen(false);
      setUnavailableReason('');
      setUnavailableStoreName('');
    }
  };

  const LEGACY_HANDLE_SHIP = () => {
    const logisticsProvider = UNUSED_PROMPT_REQUIRED();
    if (!logisticsProvider) return;
    const trackingNumber = UNUSED_PROMPT_REQUIRED();
    if (!trackingNumber) return;
    const trackingUrl = undefined;
    void runAction(
      'SHIP',
      () => shipPurchaseOrder(orderId, { logisticsProvider, trackingNumber, trackingUrl }, token),
      '出貨資訊已更新。'
    );
  };

  const LEGACY_HANDLE_REPORT_ABNORMAL = () => {
    const abnormalType =
      String(
        '異常類型：REQUESTER_NO_SHOW、RUNNER_NO_SHOW、RUNNER_NOT_DELIVERED、REQUESTER_UNREACHABLE、ITEM_NOT_RECEIVED、OTHER',
        'OTHER'
      )?.trim().toUpperCase() || '';
    if (!abnormalType) return;
    const description = UNUSED_PROMPT_REQUIRED();
    if (!description) return;
    void runAction(
      'REPORT_ABNORMAL',
      () => reportPurchaseOrderAbnormal(orderId, { abnormalType, description, imageUrls: [] }, token),
      '異常已提出，等待交易對方回應。'
    );
  };

  const LEGACY_HANDLE_RESPOND_ABNORMAL = () => {
    const responseText = UNUSED_PROMPT_REQUIRED();
    if (!responseText) return;
    void runAction(
      'RESPOND_ABNORMAL',
      () => respondPurchaseOrderAbnormal(orderId, { responseText, imageUrls: [] }, token),
      '異常回應已送出。'
    );
  };

  const LEGACY_HANDLE_BLOCK = async () => {
    if (counterpartId == null) return;
    await runAction('BLOCK', () => blockPurchaseUser(counterpartId, token), '已封鎖交易對象。');
  };

  const closeActionDialog = () => {
    if (busyAction) return;
    setActionDialog('');
    setActionDialogError('');
  };

  const handleCancel = async () => {
    const reason = cancelReason.trim();
    if (!reason) {
      setActionDialogError('請輸入取消原因。');
      return;
    }
    const succeeded = await runAction(
      'CANCEL',
      () => (isRequester ? cancelPurchaseOrderAsRequester(orderId, { reason }, token) : cancelPurchaseOrderAsRunner(orderId, { reason }, token)),
      '訂單已取消。'
    );
    if (succeeded) {
      setCancelReason('');
      closeActionDialog();
    }
  };

  const handleShip = async () => {
    const logisticsProvider = shippingForm.logisticsProvider.trim();
    const trackingNumber = shippingForm.trackingNumber.trim();
    if (!logisticsProvider || !trackingNumber) {
      setActionDialogError('請填寫物流公司與物流單號。');
      return;
    }
    const succeeded = await runAction(
      'SHIP',
      () => shipPurchaseOrder(orderId, { logisticsProvider, trackingNumber, trackingUrl: shippingForm.trackingUrl.trim() || undefined }, token),
      '已送出出貨資訊。'
    );
    if (succeeded) {
      setShippingForm({ logisticsProvider: '', trackingNumber: '', trackingUrl: '' });
      closeActionDialog();
    }
  };

  const handleReportAbnormal = async () => {
    const description = abnormalForm.description.trim();
    if (!description) {
      setActionDialogError('請說明異常狀況。');
      return;
    }
    const succeeded = await runAction(
      'REPORT_ABNORMAL',
      () => reportPurchaseOrderAbnormal(orderId, { abnormalType: abnormalForm.abnormalType, description, imageUrls: [] }, token),
      '已提出異常回報，等待對方回應。'
    );
    if (succeeded) {
      setAbnormalForm({ abnormalType: 'OTHER', description: '' });
      closeActionDialog();
    }
  };

  const handleRespondAbnormal = async () => {
    const responseText = abnormalResponse.trim();
    if (!responseText) {
      setActionDialogError('請輸入異常回應內容。');
      return;
    }
    const succeeded = await runAction(
      'RESPOND_ABNORMAL',
      () => respondPurchaseOrderAbnormal(orderId, { responseText, imageUrls: [] }, token),
      '已回應異常。'
    );
    if (succeeded) {
      setAbnormalResponse('');
      closeActionDialog();
    }
  };

  const handleBlock = async () => {
    if (counterpartId == null) return;
    const succeeded = await runAction('BLOCK', () => blockPurchaseUser(counterpartId, token), '已封鎖交易對象。');
    if (succeeded) closeActionDialog();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal purchase-order-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <div>
            <p className="eyebrow">託購訂單 #{orderId}</p>
            <h2 className="modal-title">{order?.itemName ?? '訂單詳情'}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>關閉</button>
        </div>

        {isLoading && !order && <p className="muted-copy">載入訂單中...</p>}
        {order && (
          <>
            <div className="purchase-order-summary-grid">
              <span>狀態<strong>{getLabel(ORDER_STATUS_LABELS, order.status)}</strong></span>
              <span>委託人<strong>{order.requesterDisplayName || '--'}</strong></span>
              <span>接單人<strong>{order.runnerDisplayName || '--'}</strong></span>
              <span>酬金<strong>NT$ {order.rewardAmount ?? 0}</strong></span>
              <span>交付方式<strong>{getLabel(DELIVERY_METHOD_LABELS, deliveryMethod || order.deliveryMethod)}</strong></span>
              <span>交付期限<strong>{formatDateTime(order.deliveryDeadlineAt) || '--'}</strong></span>
            </div>

            {order.deliveryPublicSummary && <p className="panel-note">交付摘要：{order.deliveryPublicSummary}</p>}
            {order.deliveryPrivateDetail && (
              <details className="purchase-order-private-detail">
                <summary>查看私密交付資料</summary>
                <pre>{JSON.stringify(order.deliveryPrivateDetail, null, 2)}</pre>
              </details>
            )}

            <div className="purchase-order-actions">
              {order.chatRoomId != null && (
                <button type="button" className="text-button" onClick={() => onOpenChat?.(order)}>開啟聊天室</button>
              )}
              {availableActions.has('CONFIRM') && <button type="button" className="save-button" onClick={() => void handleConfirm()} disabled={Boolean(busyAction)}>確認交易</button>}
              {availableActions.has('START') && <button type="button" className="save-button" onClick={() => void runAction('START', () => startPurchaseOrder(orderId, token), '已開始處理訂單。')} disabled={Boolean(busyAction)}>開始採買</button>}
              {availableActions.has('ITEM_UNAVAILABLE') && <button type="button" className="ghost-button" onClick={() => setIsUnavailableDialogOpen(true)} disabled={Boolean(busyAction)}>回報缺貨</button>}
              {availableActions.has('SHIP') && <button type="button" className="save-button" onClick={() => { setActionDialogError(''); setActionDialog('ship'); }} disabled={Boolean(busyAction)}>填寫出貨資訊</button>}
              {availableActions.has('DELIVER') && <button type="button" className="save-button" onClick={() => void runAction('DELIVER', () => deliverPurchaseOrder(orderId, token), '已標記交付。')} disabled={Boolean(busyAction)}>標記交付</button>}
              {availableActions.has('COMPLETE') && <button type="button" className="save-button" onClick={() => void runAction('COMPLETE', () => completePurchaseOrder(orderId, token), '訂單已完成。')} disabled={Boolean(busyAction)}>確認完成</button>}
              {availableActions.has('REPORT_ABNORMAL') && <button type="button" className="ghost-button danger" onClick={() => { setActionDialogError(''); setActionDialog('abnormal'); }} disabled={Boolean(busyAction)}>提出異常</button>}
              {availableActions.has('RESPOND_ABNORMAL') && <button type="button" className="save-button" onClick={() => { setActionDialogError(''); setActionDialog('respond'); }} disabled={Boolean(busyAction)}>回應異常</button>}
              {availableActions.has('CANCEL') && <button type="button" className="ghost-button danger" onClick={() => { setActionDialogError(''); setActionDialog('cancel'); }} disabled={Boolean(busyAction)}>取消訂單</button>}
              {counterpartId != null && <button type="button" className="ghost-button danger" onClick={() => { setActionDialogError(''); setActionDialog('block'); }} disabled={Boolean(busyAction)}>封鎖交易對象</button>}
            </div>
          </>
        )}

        {busyAction && <p className="muted-copy">處理中...</p>}
        {message && <p className="panel-note">{message}</p>}
        {error && <p className="inline-error">{error}</p>}

        <ActionDialog
          isOpen={actionDialog === 'cancel'}
          eyebrow="託購訂單"
          title="取消訂單"
          description="取消後可能會影響信用分，請填寫取消原因。"
          confirmLabel="確認取消"
          confirmClassName="ghost-button danger"
          isSubmitting={busyAction === 'CANCEL'}
          onClose={closeActionDialog}
          onConfirm={handleCancel}
        >
          <label className="form-field"><span>取消原因 *</span><textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows="3" autoFocus /></label>
          {actionDialogError && <p className="inline-error">{actionDialogError}</p>}
        </ActionDialog>

        <ActionDialog isOpen={actionDialog === 'ship'} eyebrow="託購訂單" title="填寫出貨資訊" description="請提供收件人可查詢的物流資訊。" confirmLabel="送出出貨資訊" isSubmitting={busyAction === 'SHIP'} onClose={closeActionDialog} onConfirm={handleShip}>
          <label className="form-field"><span>物流公司 *</span><input value={shippingForm.logisticsProvider} onChange={(event) => setShippingForm((current) => ({ ...current, logisticsProvider: event.target.value }))} autoFocus /></label>
          <label className="form-field"><span>物流單號 *</span><input value={shippingForm.trackingNumber} onChange={(event) => setShippingForm((current) => ({ ...current, trackingNumber: event.target.value }))} /></label>
          <label className="form-field"><span>物流查詢網址（可留空）</span><input type="url" value={shippingForm.trackingUrl} onChange={(event) => setShippingForm((current) => ({ ...current, trackingUrl: event.target.value }))} /></label>
          {actionDialogError && <p className="inline-error">{actionDialogError}</p>}
        </ActionDialog>

        <ActionDialog isOpen={actionDialog === 'abnormal'} eyebrow="託購訂單" title="提出異常" description="請選擇異常類型並說明狀況，送出後會通知交易對方。" confirmLabel="送出回報" confirmClassName="ghost-button danger" isSubmitting={busyAction === 'REPORT_ABNORMAL'} onClose={closeActionDialog} onConfirm={handleReportAbnormal}>
          <label className="form-field"><span>異常類型 *</span><select value={abnormalForm.abnormalType} onChange={(event) => setAbnormalForm((current) => ({ ...current, abnormalType: event.target.value }))}><option value="REQUESTER_NO_SHOW">委託人未出現</option><option value="RUNNER_NO_SHOW">接單人未出現</option><option value="RUNNER_NOT_DELIVERED">接單人未交付</option><option value="REQUESTER_UNREACHABLE">委託人聯繫不上</option><option value="ITEM_NOT_RECEIVED">未收到商品</option><option value="OTHER">其他</option></select></label>
          <label className="form-field"><span>異常說明 *</span><textarea value={abnormalForm.description} onChange={(event) => setAbnormalForm((current) => ({ ...current, description: event.target.value }))} rows="4" autoFocus /></label>
          {actionDialogError && <p className="inline-error">{actionDialogError}</p>}
        </ActionDialog>

        <ActionDialog isOpen={actionDialog === 'respond'} eyebrow="託購訂單" title="回應異常" description="請說明你的回應，送出後將交由系統依流程處理。" confirmLabel="送出回應" isSubmitting={busyAction === 'RESPOND_ABNORMAL'} onClose={closeActionDialog} onConfirm={handleRespondAbnormal}>
          <label className="form-field"><span>回應內容 *</span><textarea value={abnormalResponse} onChange={(event) => setAbnormalResponse(event.target.value)} rows="4" autoFocus /></label>
          {actionDialogError && <p className="inline-error">{actionDialogError}</p>}
        </ActionDialog>

        <ActionDialog isOpen={actionDialog === 'block'} eyebrow="安全設定" title="封鎖交易對象" description={`確定封鎖 ${counterpartName || '交易對象'}？封鎖後雙方不能成立新交易。`} confirmLabel="確認封鎖" confirmClassName="ghost-button danger" isSubmitting={busyAction === 'BLOCK'} onClose={closeActionDialog} onConfirm={handleBlock} />

        {isUnavailableDialogOpen && (
          <div className="purchase-order-dialog-backdrop" onClick={() => !busyAction && setIsUnavailableDialogOpen(false)}>
            <form className="purchase-order-dialog" onSubmit={handleSubmitUnavailable} onClick={(event) => event.stopPropagation()}>
              <div className="purchase-order-dialog-heading">
                <div>
                  <p className="eyebrow">託購訂單</p>
                  <h3>回報商品缺貨</h3>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setIsUnavailableDialogOpen(false)}
                  disabled={Boolean(busyAction)}
                >
                  關閉
                </button>
              </div>
              <p>請提供缺貨原因，系統會通知委託人並記錄本次回報。</p>
              <label className="form-field">
                <span>缺貨原因 *</span>
                <textarea
                  value={unavailableReason}
                  onChange={(event) => setUnavailableReason(event.target.value)}
                  placeholder="例如：門市商品已售完，近期無補貨資訊"
                  rows="4"
                  autoFocus
                />
              </label>
              <label className="form-field">
                <span>門市名稱（選填）</span>
                <input
                  value={unavailableStoreName}
                  onChange={(event) => setUnavailableStoreName(event.target.value)}
                  placeholder="例如：中和店"
                />
              </label>
              {unavailableError && <p className="inline-error">{unavailableError}</p>}
              <div className="purchase-order-dialog-actions">
                <button type="button" className="ghost-button" onClick={() => setIsUnavailableDialogOpen(false)} disabled={Boolean(busyAction)}>取消</button>
                <button type="submit" className="save-button" disabled={Boolean(busyAction)}>{busyAction === 'ITEM_UNAVAILABLE' ? '送出中...' : '確認回報'}</button>
              </div>
            </form>
          </div>
        )}

        <section className="purchase-order-events">
          <h3>訂單紀錄</h3>
          {!isLoading && events.length === 0 && <p className="muted-copy">目前沒有事件紀錄。</p>}
          {events.map((event) => (
            <article key={event.id}>
              <strong>{getLabel(EVENT_LABELS, event.eventType)}</strong>
              <span>{event.actorDisplayName || '系統'} · {formatDateTime(event.createdAt)}</span>
              {event.description && <p>{event.description}</p>}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

export default PurchaseOrderModal;
