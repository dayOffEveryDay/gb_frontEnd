import { useEffect, useMemo, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { fetchCampaignChatMessages, getBackendBaseUrl } from './api';

function normalizeChatMessage(message) {
  return {
    senderId: message.senderId ?? message.sender_id ?? null,
    senderName: message.senderName ?? message.sender_name ?? '匿名',
    content: message.content ?? '',
    timestamp: message.timestamp ?? message.createdAt ?? message.created_at ?? '',
  };
}

function formatMessageTime(value) {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function CampaignChatModal({ isOpen, campaign, token, currentUser, onClose }) {
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef(null);
  const bodyRef = useRef(null);

  const campaignId = campaign?.id;
  const wsUrl = useMemo(() => new URL('/ws', getBackendBaseUrl()).toString(), []);

  useEffect(() => {
    if (!isOpen || !campaignId || !token) {
      return undefined;
    }

    let cancelled = false;

    fetchCampaignChatMessages(campaignId, token)
      .then((data) => {
        if (!cancelled) {
          setMessages(Array.isArray(data) ? data.map(normalizeChatMessage) : []);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(nextError.message);
          setMessages([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId, isOpen, token]);

  useEffect(() => {
    if (!isOpen || !campaignId || !token) {
      return undefined;
    }

    let disposed = false;

    const connect = async () => {
      try {
        const sockJsModule = await import('sockjs-client/dist/sockjs');
        const SockJS = sockJsModule.default;

        if (disposed) {
          return;
        }

        const client = new Client({
          webSocketFactory: () => new SockJS(wsUrl),
          connectHeaders: {
            Authorization: `Bearer ${token}`,
          },
          reconnectDelay: 5000,
          debug: () => {},
          onConnect: () => {
            setIsConnected(true);
            client.subscribe(`/topic/campaigns/${campaignId}`, (frame) => {
              try {
                const nextMessage = normalizeChatMessage(JSON.parse(frame.body));
                setMessages((current) => [...(current ?? []), nextMessage]);
              } catch {
                setError('聊天訊息解析失敗');
              }
            });
          },
          onStompError: (frame) => {
            setError(frame.headers.message || '聊天連線失敗');
          },
          onWebSocketClose: () => {
            setIsConnected(false);
          },
        });

        client.activate();
        clientRef.current = client;
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '聊天元件載入失敗');
      }
    };

    connect();

    return () => {
      disposed = true;
      setIsConnected(false);
      clientRef.current?.deactivate();
      clientRef.current = null;
    };
  }, [campaignId, isOpen, token, wsUrl]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages]);

  if (!isOpen || !campaign) {
    return null;
  }

  const handleSend = () => {
    const content = draft.trim();
    if (!content) {
      return;
    }

    if (!clientRef.current?.connected) {
      setError('聊天尚未連線，請稍後再試');
      return;
    }

    clientRef.current.publish({
      destination: `/app/chat/${campaignId}/sendMessage`,
      body: JSON.stringify({ content }),
    });

    setDraft('');
    setError('');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="chat-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          關閉
        </button>
        <p className="eyebrow">團購對話</p>
        <h2 className="modal-title">{campaign.itemName ?? '團購對話'}</h2>
        <div className="chat-status-row">
          <span>{isConnected ? '已連線' : '連線中'}</span>
          <span>{campaign.meetupLocation || '未設定面交地點'}</span>
        </div>
        <div className="chat-message-list" ref={bodyRef}>
          {messages == null && <p className="muted-copy">載入訊息中...</p>}
          {messages != null && messages.length === 0 && <p className="muted-copy">目前還沒有對話訊息</p>}
          {(messages ?? []).map((message, index) => {
            const isMine = message.senderId != null && message.senderId === currentUser?.id;

            return (
              <article key={`${message.timestamp}-${index}`} className={isMine ? 'chat-bubble mine' : 'chat-bubble'}>
                <header className="chat-bubble-header">
                  <strong>{isMine ? '我' : message.senderName}</strong>
                  <time>{formatMessageTime(message.timestamp)}</time>
                </header>
                <p>{message.content}</p>
              </article>
            );
          })}
        </div>
        {error && <p className="inline-error">{error}</p>}
        <div className="chat-composer">
          <input
            type="text"
            value={draft}
            placeholder="輸入訊息"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <button type="button" className="text-button" onClick={handleSend}>
            送出
          </button>
          <button type="button" className="text-button" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

export default CampaignChatModal;
