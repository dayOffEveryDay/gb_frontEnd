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

function promptRequired(message, defaultValue = '') {
  const value = window.prompt(message, defaultValue);
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
      void loadOrder();
    } else {
      setOrder(null);
      setEvents([]);
      setError('');
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
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '訂單操作失敗');
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

  const handleCancel = () => {
    const reason = promptRequired('請輸入取消原因');
    if (!reason) return;
    if (!window.confirm('取消訂單可能扣除信用分，確定繼續嗎？')) return;
    void runAction(
      'CANCEL',
      () =>
        isRequester
          ? cancelPurchaseOrderAsRequester(orderId, { reason }, token)
          : cancelPurchaseOrderAsRunner(orderId, { reason }, token),
      '訂單已取消。'
    );
  };

  const handleUnavailable = () => {
    const reason = promptRequired('請輸入缺貨原因');
    if (!reason) return;
    const storeName = window.prompt('門市名稱（可留空）', '')?.trim() || undefined;
    void runAction(
      'ITEM_UNAVAILABLE',
      () => markPurchaseOrderItemUnavailable(orderId, { reason, storeName, imageUrls: [] }, token),
      '已回報商品缺貨。'
    );
  };

  const handleShip = () => {
    const logisticsProvider = promptRequired('請輸入物流公司');
    if (!logisticsProvider) return;
    const trackingNumber = promptRequired('請輸入物流單號');
    if (!trackingNumber) return;
    const trackingUrl = window.prompt('物流查詢網址（可留空）', '')?.trim() || undefined;
    void runAction(
      'SHIP',
      () => shipPurchaseOrder(orderId, { logisticsProvider, trackingNumber, trackingUrl }, token),
      '出貨資訊已更新。'
    );
  };

  const handleReportAbnormal = () => {
    const abnormalType =
      window.prompt(
        '異常類型：REQUESTER_NO_SHOW、RUNNER_NO_SHOW、RUNNER_NOT_DELIVERED、REQUESTER_UNREACHABLE、ITEM_NOT_RECEIVED、OTHER',
        'OTHER'
      )?.trim().toUpperCase() || '';
    if (!abnormalType) return;
    const description = promptRequired('請說明異常狀況');
    if (!description) return;
    void runAction(
      'REPORT_ABNORMAL',
      () => reportPurchaseOrderAbnormal(orderId, { abnormalType, description, imageUrls: [] }, token),
      '異常已提出，等待交易對方回應。'
    );
  };

  const handleRespondAbnormal = () => {
    const responseText = promptRequired('請輸入異常回應內容');
    if (!responseText) return;
    void runAction(
      'RESPOND_ABNORMAL',
      () => respondPurchaseOrderAbnormal(orderId, { responseText, imageUrls: [] }, token),
      '異常回應已送出。'
    );
  };

  const handleBlock = async () => {
    if (counterpartId == null || !window.confirm(`確定封鎖 ${counterpartName || '交易對象'}？封鎖後雙方不能成立新交易。`)) return;
    await runAction('BLOCK', () => blockPurchaseUser(counterpartId, token), '已封鎖交易對象。');
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
              {availableActions.has('ITEM_UNAVAILABLE') && <button type="button" className="ghost-button" onClick={handleUnavailable} disabled={Boolean(busyAction)}>回報缺貨</button>}
              {availableActions.has('SHIP') && <button type="button" className="save-button" onClick={handleShip} disabled={Boolean(busyAction)}>填寫出貨資訊</button>}
              {availableActions.has('DELIVER') && <button type="button" className="save-button" onClick={() => void runAction('DELIVER', () => deliverPurchaseOrder(orderId, token), '已標記交付。')} disabled={Boolean(busyAction)}>標記交付</button>}
              {availableActions.has('COMPLETE') && <button type="button" className="save-button" onClick={() => void runAction('COMPLETE', () => completePurchaseOrder(orderId, token), '訂單已完成。')} disabled={Boolean(busyAction)}>確認完成</button>}
              {availableActions.has('REPORT_ABNORMAL') && <button type="button" className="ghost-button danger" onClick={handleReportAbnormal} disabled={Boolean(busyAction)}>提出異常</button>}
              {availableActions.has('RESPOND_ABNORMAL') && <button type="button" className="save-button" onClick={handleRespondAbnormal} disabled={Boolean(busyAction)}>回應異常</button>}
              {availableActions.has('CANCEL') && <button type="button" className="ghost-button danger" onClick={handleCancel} disabled={Boolean(busyAction)}>取消訂單</button>}
              {counterpartId != null && <button type="button" className="ghost-button danger" onClick={() => void handleBlock()} disabled={Boolean(busyAction)}>封鎖交易對象</button>}
            </div>
          </>
        )}

        {busyAction && <p className="muted-copy">處理中...</p>}
        {message && <p className="panel-note">{message}</p>}
        {error && <p className="inline-error">{error}</p>}

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
