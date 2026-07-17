import { useEffect, useMemo, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import {
  confirmPurchaseOrderAsRequester,
  confirmPurchaseOrderAsRunner,
  fetchPurchaseOrder,
  fetchPurchaseOrderMessages,
  getBackendBaseUrl,
  markPurchaseChatRoomRead,
  sendPurchaseChatRoomMessage,
  uploadFiles,
} from './api';
import ImageGalleryModal from './ImageGalleryModal';

function normalizeMessage(message) {
  return {
    id: message?.id ?? null,
    senderId: message?.senderId ?? message?.sender_id ?? null,
    senderName: message?.senderName ?? message?.sender_name ?? '使用者',
    senderAvatarUrl: message?.senderAvatarUrl ?? message?.sender_avatar_url ?? '',
    messageType: (message?.messageType ?? message?.message_type ?? 'TEXT').toString().toUpperCase(),
    content: message?.content ?? '',
    createdAt: message?.createdAt ?? message?.created_at ?? '',
  };
}

function mergeMessage(current, rawMessage) {
  const nextMessage = normalizeMessage(rawMessage);
  const duplicated = current.some((message) => {
    if (nextMessage.id != null && message.id != null) {
      return String(message.id) === String(nextMessage.id);
    }
    return (
      String(message.senderId) === String(nextMessage.senderId) &&
      message.content === nextMessage.content &&
      message.createdAt === nextMessage.createdAt
    );
  });
  return duplicated ? current : [...current, nextMessage];
}

function formatMessageTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function resolveFileUrl(value) {
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  return new URL(path, `${getBackendBaseUrl()}/`).toString();
}

function splitImageContent(content) {
  return String(content ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(resolveFileUrl);
}

function getOrderUserId(order, role) {
  return order?.[`${role}Id`] ?? order?.[`${role}_id`] ?? order?.[role]?.id ?? null;
}

function getOrderStatus(order) {
  return (order?.status ?? order?.orderStatus ?? order?.order_status ?? '').toString().toUpperCase();
}

function getOrderAvailableActions(order) {
  return Array.isArray(order?.availableActions)
    ? order.availableActions
    : Array.isArray(order?.available_actions)
      ? order.available_actions
      : [];
}

function PurchaseChatModal({ isOpen, room, token, currentUser, onRead, onClose }) {
  const [messages, setMessages] = useState(null);
  const [order, setOrder] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [orderMessage, setOrderMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [gallery, setGallery] = useState({ isOpen: false, images: [], activeIndex: 0 });
  const bodyRef = useRef(null);
  const fileInputRef = useRef(null);
  const roomId = room?.id;
  const orderId = room?.orderId;
  const isReadOnly = Boolean(room?.readOnly);
  const isRequester = String(getOrderUserId(order, 'requester')) === String(currentUser?.id);
  const isRunner = String(getOrderUserId(order, 'runner')) === String(currentUser?.id);
  const orderStatus = getOrderStatus(order);
  const availableActions = getOrderAvailableActions(order);
  const canConfirmOrder =
    !isReadOnly &&
    orderId != null &&
    (availableActions.includes('CONFIRM') ||
      (orderStatus === 'WAITING_CONFIRMATION' &&
        ((isRequester && !order?.requesterConfirmedAt && !order?.requester_confirmed_at) ||
          (isRunner && !order?.runnerConfirmedAt && !order?.runner_confirmed_at))));
  const wsUrl = useMemo(() => new URL('/ws', getBackendBaseUrl()).toString(), []);

  useEffect(() => {
    if (!isOpen || !token || orderId == null || roomId == null) return undefined;

    let cancelled = false;
    setMessages(null);
    setOrder(null);
    setError('');
    setOrderMessage('');
    setDraft('');

    Promise.all([
      fetchPurchaseOrderMessages(orderId, token),
      fetchPurchaseOrder(orderId, token).catch(() => null),
      markPurchaseChatRoomRead(roomId, token),
    ])
      .then(([data, orderData]) => {
        if (cancelled) return;
        setMessages(Array.isArray(data) ? data.map(normalizeMessage) : []);
        setOrder(orderData);
        onRead?.(roomId);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setMessages([]);
          setError(nextError instanceof Error ? nextError.message : '聊天室載入失敗');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, onRead, orderId, roomId, token]);

  useEffect(() => {
    if (!isOpen || !token || roomId == null) return undefined;

    let disposed = false;
    let client;

    const connect = async () => {
      try {
        const sockJsModule = await import('sockjs-client/dist/sockjs');
        if (disposed) return;
        const SockJS = sockJsModule.default;
        client = new Client({
          webSocketFactory: () => new SockJS(wsUrl),
          connectHeaders: { Authorization: `Bearer ${token}` },
          reconnectDelay: 5000,
          debug: () => {},
          onConnect: () => {
            setIsConnected(true);
            client.subscribe(`/topic/chat/rooms/${roomId}`, (frame) => {
              try {
                const payload = JSON.parse(frame.body);
                setMessages((current) => mergeMessage(current ?? [], payload));
                void markPurchaseChatRoomRead(roomId, token).catch(() => {});
                onRead?.(roomId);
              } catch {
                setError('即時訊息格式錯誤');
              }
            });
          },
          onStompError: (frame) => setError(frame.headers?.message || '聊天室連線失敗'),
          onWebSocketClose: () => setIsConnected(false),
        });
        client.activate();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '聊天室連線失敗');
      }
    };

    void connect();
    return () => {
      disposed = true;
      setIsConnected(false);
      void client?.deactivate();
    };
  }, [isOpen, onRead, roomId, token, wsUrl]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages]);

  if (!isOpen || !room) return null;

  const sendMessage = async (messageType, content) => {
    if (!content || isReadOnly) return;
    setIsSending(true);
    setError('');
    try {
      const response = await sendPurchaseChatRoomMessage(roomId, { messageType, content }, token);
      setMessages((current) => mergeMessage(current ?? [], response));
      await markPurchaseChatRoomRead(roomId, token);
      onRead?.(roomId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '訊息傳送失敗');
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (!canConfirmOrder || isConfirming) return;
    setIsConfirming(true);
    setError('');
    setOrderMessage('');
    try {
      const response = isRequester
        ? await confirmPurchaseOrderAsRequester(orderId, token)
        : await confirmPurchaseOrderAsRunner(orderId, token);
      setOrder(response);
      setOrderMessage(getOrderStatus(response) === 'CONFIRMED' ? '雙方已確認，訂單可開始處理。' : '已送出確認，等待對方確認。');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '交易確認失敗');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || isSending) return;
    setDraft('');
    await sendMessage('TEXT', content);
  };

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'));
    event.target.value = '';
    if (files.length === 0) return;

    setIsUploading(true);
    setError('');
    try {
      const result = await uploadFiles(files, token);
      const urls = Array.isArray(result?.urls) ? result.urls : [];
      if (urls.length !== files.length) throw new Error('圖片上傳結果不完整');
      for (const url of urls) {
        await sendMessage('IMAGE', url);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '圖片傳送失敗');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal campaign-chat-modal purchase-chat-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <div>
            <p className="eyebrow">託購聊天室</p>
            <h2 className="modal-title">{room.itemName || '託購交易'}</h2>
            <span className="muted-copy">
              {room.counterpartName ? `交易對象：${room.counterpartName}` : ''} · {isConnected ? '即時連線' : '重新連線中'}
            </span>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>關閉</button>
        </div>

        {(canConfirmOrder || orderMessage) && (
          <div className="chat-status-row purchase-chat-order-status">
            <span>{orderMessage || '雙方都需要確認後，託購訂單才會進入後續流程。'}</span>
            {canConfirmOrder && (
              <button
                type="button"
                className="chat-status-action deliver-status-action"
                onClick={() => void handleConfirmOrder()}
                disabled={isConfirming}
              >
                {isConfirming ? '確認中...' : '確認交易'}
              </button>
            )}
          </div>
        )}

        <div className="chat-message-list" ref={bodyRef}>
          {messages == null && <p className="muted-copy">載入訊息中...</p>}
          {messages?.length === 0 && <p className="muted-copy">目前沒有訊息。</p>}
          {(messages ?? []).map((message, index) => {
            const isMine = String(message.senderId) === String(currentUser?.id);
            const images = message.messageType === 'IMAGE' ? splitImageContent(message.content) : [];
            return (
              <article key={message.id ?? `${message.createdAt}-${index}`} className={isMine ? 'chat-message-row mine' : 'chat-message-row'}>
                <div className="chat-avatar">
                  {message.senderAvatarUrl ? <img src={resolveFileUrl(message.senderAvatarUrl)} alt="" className="avatar-image" /> : <span>{(message.senderName || '?').slice(0, 1)}</span>}
                </div>
                <div className={isMine ? 'chat-bubble mine' : 'chat-bubble'}>
                  <header className="chat-bubble-header">
                    <strong>{isMine ? '你' : message.senderName}</strong>
                    <time>{formatMessageTime(message.createdAt)}</time>
                  </header>
                  {message.messageType !== 'IMAGE' && <p>{message.content}</p>}
                  {images.length > 0 && (
                    <div className={images.length > 1 ? 'chat-image-grid many' : 'chat-image-grid single'}>
                      {images.map((imageUrl, imageIndex) => (
                        <button key={imageUrl} type="button" className="chat-image-thumb" onClick={() => setGallery({ isOpen: true, images, activeIndex: imageIndex })}>
                          <img src={imageUrl} alt="聊天室附件" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {isReadOnly && <p className="inline-warning">交易結束已超過保留期限，此聊天室目前為唯讀。</p>}
        {error && <p className="inline-error">{error}</p>}

        <div className="chat-composer">
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="chat-file-input" onChange={handleUpload} disabled={isReadOnly || isUploading} />
          <button type="button" className="chat-attachment-button" onClick={() => fileInputRef.current?.click()} disabled={isReadOnly || isUploading}>
            {isUploading ? '上傳中' : '圖片'}
          </button>
          <input
            type="text"
            value={draft}
            placeholder={isReadOnly ? '聊天室目前為唯讀' : '輸入訊息'}
            disabled={isReadOnly || isSending || isUploading}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
          <button type="button" className="text-button" onClick={() => void handleSend()} disabled={isReadOnly || isSending || !draft.trim()}>
            {isSending ? '傳送中' : '傳送'}
          </button>
        </div>

        <ImageGalleryModal
          isOpen={gallery.isOpen}
          title="聊天室圖片"
          images={gallery.images}
          activeIndex={gallery.activeIndex}
          onClose={() => setGallery({ isOpen: false, images: [], activeIndex: 0 })}
          onPrev={() => setGallery((current) => ({ ...current, activeIndex: (current.activeIndex - 1 + current.images.length) % current.images.length }))}
          onNext={() => setGallery((current) => ({ ...current, activeIndex: (current.activeIndex + 1) % current.images.length }))}
          onSelect={(activeIndex) => setGallery((current) => ({ ...current, activeIndex }))}
        />
      </div>
    </div>
  );
}

export default PurchaseChatModal;
