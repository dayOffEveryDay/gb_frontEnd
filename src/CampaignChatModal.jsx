import { useEffect, useMemo, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { fetchCampaignChatMessages, getBackendBaseUrl } from './api';
import { MoreIcon } from './Icons';

const UNLOCK_COMMAND = '/解鎖修改';
const COMPLETED_CHAT_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
const COMPLETED_CHAT_NOTICE = '團購已完成 聊天室將在3天後終止連線';

function getCampaignStatus(campaign) {
  return (campaign?.status ?? campaign?.campaignStatus ?? campaign?.campaign_status ?? '').toString().toUpperCase();
}

function getCampaignCompletedAt(campaign) {
  return campaign?.completedAt ?? campaign?.completed_at ?? campaign?.completedTime ?? campaign?.completed_time ?? '';
}

function getCampaignChatExpiresAt(campaign) {
  return (
    campaign?.chatExpiresAt ??
    campaign?.chat_expires_at ??
    campaign?.chatExpiredAt ??
    campaign?.chat_expired_at ??
    campaign?.chatEndAt ??
    campaign?.chat_end_at ??
    ''
  );
}

function hasExplicitStoppedChat(campaign) {
  const stopped = campaign?.chatStopped ?? campaign?.chat_stopped ?? campaign?.chatClosed ?? campaign?.chat_closed;
  if (stopped === true) {
    return true;
  }

  const available =
    campaign?.chatAvailable ?? campaign?.chat_available ?? campaign?.chatEnabled ?? campaign?.chat_enabled ?? campaign?.canChat;
  return available === false;
}

function isCompletedChatExpiredByFields(status, completedAt) {
  if (status !== 'COMPLETED') {
    return false;
  }

  if (!completedAt) {
    return false;
  }

  const completedDate = new Date(completedAt);
  if (Number.isNaN(completedDate.getTime())) {
    return false;
  }

  return Date.now() >= completedDate.getTime() + COMPLETED_CHAT_RETENTION_MS;
}

function isPastChatExpiresAt(expiresAt) {
  if (!expiresAt) {
    return false;
  }

  const expiresDate = new Date(expiresAt);
  if (Number.isNaN(expiresDate.getTime())) {
    return false;
  }

  return Date.now() >= expiresDate.getTime();
}

function normalizeChatMessage(message) {
  return {
    senderId: message.senderId ?? message.sender_id ?? null,
    senderName: message.senderName ?? message.sender_name ?? '未知使用者',
    avatarUrl:
      message.avatarUrl ??
      message.avatar_url ??
      message.profileImageUrl ??
      message.profile_image_url ??
      '',
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

function getChatAvatarLabel(name, isMine) {
  if (isMine) {
    return '我';
  }

  const normalizedName = (name ?? '').trim();
  return normalizedName ? normalizedName.slice(0, 1).toUpperCase() : '?';
}

function resolveMessageAvatar(message, campaign, currentUser, isMine) {
  if (message.avatarUrl) {
    return message.avatarUrl;
  }

  if (isMine) {
    return currentUser?.profileImageUrl ?? '';
  }

  if (message.senderId != null && Number(message.senderId) === Number(campaign?.host?.id)) {
    return campaign?.host?.profileImageUrl ?? '';
  }

  return '';
}

function CampaignChatModal({
  isOpen,
  campaign,
  token,
  currentUser,
  onUnlockRevision,
  onOpenParticipation,
  onOpenUserProfile,
  onDeliverCampaign,
  onConfirmReceipt,
  onRaiseDispute,
  onOpenReview,
  onCampaignStatusChange,
  externalStatusEvent,
  isParticipantReviewCompleted = false,
  isHostReviewCompleted = false,
  onClose,
}) {
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isDeliveringCampaign, setIsDeliveringCampaign] = useState(false);
  const [isConfirmingReceipt, setIsConfirmingReceipt] = useState(false);
  const [isRaisingDispute, setIsRaisingDispute] = useState(false);
  const [isChatStopped, setIsChatStopped] = useState(false);
  const [hasConfirmedReceipt, setHasConfirmedReceipt] = useState(false);
  const [hasRaisedDispute, setHasRaisedDispute] = useState(false);
  const [isDisputeDialogOpen, setIsDisputeDialogOpen] = useState(false);
  const [disputeReasonDraft, setDisputeReasonDraft] = useState('');
  const clientRef = useRef(null);
  const bodyRef = useRef(null);
  const lastExternalStatusEventIdRef = useRef('');

  const campaignId = campaign?.id;
  const wsUrl = useMemo(() => new URL('/ws', getBackendBaseUrl()).toString(), []);
  const isHost = Boolean(Number(campaign?.host?.id) === Number(currentUser?.id) || campaign?.isHost);
  const campaignStatus = getCampaignStatus(campaign);
  const campaignCompletedAt = getCampaignCompletedAt(campaign);
  const campaignChatExpiresAt = getCampaignChatExpiresAt(campaign);
  const shouldStopChat =
    hasExplicitStoppedChat(campaign) ||
    isPastChatExpiresAt(campaignChatExpiresAt) ||
    isCompletedChatExpiredByFields(campaignStatus, campaignCompletedAt);
  const showCompletedChatNotice = campaignStatus === 'COMPLETED' && !shouldStopChat;
  const participantStatus = (
    campaign?.myParticipantStatus ??
    campaign?.my_participant_status ??
    campaign?.participantStatus ??
    campaign?.participant_status ??
    ''
  )
    .toString()
    .toUpperCase();

  const canDeliverCampaign = isHost && campaignStatus === 'FULL';
  const showDeliveredBadge = isHost && campaignStatus === 'DELIVERED';
  const canRaiseDispute = !isHost && participantStatus === 'NO_SHOW' && !hasRaisedDispute;
  const showDisputedBadge = !isHost && (participantStatus === 'DISPUTED' || hasRaisedDispute);
  const canConfirmReceipt =
    !isHost &&
    campaignStatus === 'DELIVERED' &&
    participantStatus !== 'NO_SHOW' &&
    participantStatus !== 'DISPUTED' &&
    !hasConfirmedReceipt;
  const showConfirmedBadge = !isHost && (campaignStatus === 'CONFIRMED' || hasConfirmedReceipt);
  const canReviewAsParticipant =
    !isHost &&
    !['NO_SHOW', 'DISPUTED'].includes(participantStatus) &&
    ['CONFIRMED', 'COMPLETED'].includes(participantStatus || campaignStatus);
  const canReviewAsHost = isHost && ['DELIVERED', 'CONFIRMED', 'COMPLETED'].includes(campaignStatus);

  useEffect(() => {
    setHasConfirmedReceipt(false);
    setHasRaisedDispute(false);
    setError('');
    setStatusMessage('');
    setDraft('');
    setIsDisputeDialogOpen(false);
    setDisputeReasonDraft('');
    setIsChatStopped(shouldStopChat);
  }, [campaignCompletedAt, campaignChatExpiresAt, campaignId, campaignStatus, isOpen, shouldStopChat]);

  useEffect(() => {
    setIsChatStopped(shouldStopChat);
  }, [shouldStopChat]);

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
          if (shouldStopChat) {
            setIsChatStopped(true);
            setMessages([]);
            return;
          }

          setError(nextError.message);
          setMessages([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId, isOpen, shouldStopChat, token]);

  useEffect(() => {
    if (!isOpen || !campaignId || !token) {
      return undefined;
    }

    if (shouldStopChat) {
      setIsChatStopped(true);
      setIsConnected(false);
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
                const payload = JSON.parse(frame.body);
                if (payload?.type === 'CAMPAIGN_STATUS_CHANGED') {
                  setMessages((current) => [
                    ...(current ?? []),
                    {
                      type: 'SYSTEM',
                      senderId: null,
                      senderName: '系統通知',
                      avatarUrl: '',
                      content: payload.message || '團購狀態已更新',
                      timestamp: new Date().toISOString(),
                    },
                  ]);
                  onCampaignStatusChange?.({
                    campaignId: payload.campaignId ?? campaignId,
                    status: payload.status,
                    message: payload.message,
                    source: 'topic',
                  });
                  return;
                }

                const nextMessage = normalizeChatMessage(payload);
                setMessages((current) => [...(current ?? []), nextMessage]);
              } catch {
                setError('聊天室訊息格式錯誤');
              }
            });
          },
          onStompError: (frame) => {
            if (campaignStatus === 'COMPLETED') {
              setIsChatStopped(true);
              setIsConnected(false);
              return;
            }

            setError(frame.headers.message || '聊天室連線發生錯誤');
          },
          onWebSocketClose: () => {
            setIsConnected(false);
          },
        });

        client.activate();
        clientRef.current = client;
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '聊天室初始化失敗');
      }
    };

    connect();

    return () => {
      disposed = true;
      setIsConnected(false);
      clientRef.current?.deactivate();
      clientRef.current = null;
    };
  }, [campaignId, campaignStatus, isOpen, onCampaignStatusChange, shouldStopChat, token, wsUrl]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (
      !isOpen ||
      !externalStatusEvent?.id ||
      Number(externalStatusEvent.campaignId) !== Number(campaignId) ||
      lastExternalStatusEventIdRef.current === externalStatusEvent.id
    ) {
      return;
    }

    lastExternalStatusEventIdRef.current = externalStatusEvent.id;
    setMessages((current) => [
      ...(current ?? []),
      {
        type: 'SYSTEM',
        senderId: null,
        senderName: '系統通知',
        avatarUrl: '',
        content: externalStatusEvent.message || '團購狀態已更新',
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [campaignId, externalStatusEvent, isOpen]);

  if (!isOpen || !campaign) {
    return null;
  }

  const handleDeliver = async () => {
    if (!campaignId || !onDeliverCampaign || isDeliveringCampaign) {
      return;
    }

    setIsDeliveringCampaign(true);
    setError('');

    try {
      const result = await onDeliverCampaign(campaignId);
      if (result?.success) {
        setStatusMessage(result.message ?? '已提出面交');
      } else {
        setStatusMessage('');
        setError(result?.message ?? '發起面交失敗');
      }
    } catch (nextError) {
      setStatusMessage('');
      setError(nextError instanceof Error ? nextError.message : '發起面交失敗');
    } finally {
      setIsDeliveringCampaign(false);
    }
  };

  const handleConfirmReceipt = async () => {
    if (!campaignId || !onConfirmReceipt || isConfirmingReceipt) {
      return;
    }

    setIsConfirmingReceipt(true);
    setError('');

    try {
      const result = await onConfirmReceipt(campaignId);
      if (result?.success) {
        setHasConfirmedReceipt(true);
        setStatusMessage(result.message ?? '已確認收到');
      } else {
        setStatusMessage('');
        setError(result?.message ?? '確認收到失敗');
      }
    } catch (nextError) {
      setStatusMessage('');
      setError(nextError instanceof Error ? nextError.message : '確認收到失敗');
    } finally {
      setIsConfirmingReceipt(false);
    }
  };

  const handleSubmitDispute = async () => {
    if (!campaignId || !onRaiseDispute || isRaisingDispute) {
      return;
    }

    setIsRaisingDispute(true);
    setError('');

    try {
      const result = await onRaiseDispute(campaignId, disputeReasonDraft.trim());
      if (result?.success) {
        setHasRaisedDispute(true);
        setIsDisputeDialogOpen(false);
        setDisputeReasonDraft('');
        setStatusMessage(result.message ?? '已提出仲裁');
      } else {
        setStatusMessage('');
        setError(result?.message ?? '提出仲裁失敗');
      }
    } catch (nextError) {
      setStatusMessage('');
      setError(nextError instanceof Error ? nextError.message : '提出仲裁失敗');
    } finally {
      setIsRaisingDispute(false);
    }
  };

  const handleSend = async () => {
    if (isChatStopped) {
      return;
    }

    const content = draft.trim();
    if (!content) {
      return;
    }

    if (isHost && content === UNLOCK_COMMAND) {
      if (!onUnlockRevision) {
        setError('目前無法解鎖修改');
        return;
      }

      setError('');
      const result = await onUnlockRevision(campaignId);
      if (result?.success) {
        setStatusMessage(result.message ?? '已開啟滿單後修改');
        setDraft('');
      } else {
        setStatusMessage('');
        setError(result?.message ?? '解鎖修改失敗');
      }
      return;
    }

    if (!clientRef.current?.connected) {
      setError('聊天室尚未連線，請稍後再試');
      return;
    }

    clientRef.current.publish({
      destination: `/app/chat/${campaignId}/sendMessage`,
      body: JSON.stringify({ content }),
    });

    setDraft('');
    setError('');
    setStatusMessage('');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="chat-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <p className="eyebrow">團購聊天室</p>
          <button type="button" className="modal-close" onClick={onClose}>
            關閉
          </button>
        </div>

        <div className="modal-title-row">
          <h2 className="modal-title">{campaign.itemName ?? '團購聊天室'}</h2>
          <button
            type="button"
            className="small-icon-button"
            onClick={() => onOpenParticipation?.(campaign)}
            title="主揪管理"
            aria-label="主揪管理"
          >
            <MoreIcon />
          </button>
        </div>

        <div className="chat-status-row">
          <span>{isConnected ? '已連線' : '連線中'}</span>

          <div className="chat-status-actions">
            {canDeliverCampaign ? (
              <button
                type="button"
                className="chat-status-action"
                onClick={handleDeliver}
                disabled={isDeliveringCampaign}
              >
                {isDeliveringCampaign ? '送出中..' : '發起面交'}
              </button>
            ) : showDeliveredBadge ? (
              <span className="chat-status-pill">已提出面交</span>
            ) : canRaiseDispute ? (
              <button
                type="button"
                className="chat-status-action danger"
                onClick={() => {
                  setError('');
                  setStatusMessage('');
                  setIsDisputeDialogOpen(true);
                }}
                disabled={isRaisingDispute}
              >
                提出仲裁
              </button>
            ) : showDisputedBadge ? (
              <span className="chat-status-pill danger">已提出仲裁</span>
            ) : canConfirmReceipt ? (
              <button
                type="button"
                className="chat-status-action"
                onClick={handleConfirmReceipt}
                disabled={isConfirmingReceipt}
              >
                {isConfirmingReceipt ? '送出中..' : '確認收到'}
              </button>
            ) : showConfirmedBadge ? (
              <span className="chat-status-pill">已確認收到</span>
            ) : null}

            <span className="chat-status-pill">{`面交地點：${campaign.meetupLocation || '討論'}`}</span>

            {canReviewAsParticipant && campaign?.host?.id != null && (
              <button
                type="button"
                className="chat-status-action review-status-action"
                disabled={isParticipantReviewCompleted}
                data-label={isParticipantReviewCompleted ? '已完成評價' : '評價主揪'}
                onClick={() =>
                  onOpenReview?.({
                    campaignId,
                    revieweeId: campaign.host.id,
                    revieweeName: campaign.host.displayName,
                    source: 'participant',
                  })
                }
              >
                評價主揪
              </button>
            )}

            {canReviewAsHost && (
              <button
                type="button"
                className="chat-status-action review-status-action"
                disabled={isHostReviewCompleted}
                data-label={isHostReviewCompleted ? '評價已完成' : '評價團員'}
                onClick={() => onOpenParticipation?.({ ...campaign, initialHostView: 'participants' })}
              >
                評價團員
              </button>
            )}
          </div>
        </div>

        {isHost && campaignStatus === 'FULL' && (
          <p className="panel-note">
            主揪可在此輸入 <code>{UNLOCK_COMMAND}</code> 開啟滿單後修改。
          </p>
        )}

        <div className="chat-message-list" ref={bodyRef}>
          {showCompletedChatNotice && !isChatStopped && (
            <div className="chat-pinned-notice" role="status">
              {COMPLETED_CHAT_NOTICE}
            </div>
          )}

          {messages == null && <p className="muted-copy">聊天室訊息載入中..</p>}
          {messages != null && messages.length === 0 && <p className="muted-copy">目前沒有訊息</p>}

          {(messages ?? []).map((message, index) => {
            const isSystemMessage = message.type === 'SYSTEM';
            const isMine = message.senderId != null && Number(message.senderId) === Number(currentUser?.id);
            const avatarUrl = resolveMessageAvatar(message, campaign, currentUser, isMine);
            const avatarLabel = getChatAvatarLabel(message.senderName, isMine);

            if (isSystemMessage) {
              return (
                <article key={`${message.timestamp}-${index}`} className="chat-system-announcement">
                  <span>{message.content}</span>
                  <time>{formatMessageTime(message.timestamp)}</time>
                </article>
              );
            }

            return (
              <article
                key={`${message.timestamp}-${index}`}
                className={isMine ? 'chat-message-row mine' : 'chat-message-row'}
              >
                <button
                  type="button"
                  className="chat-avatar chat-avatar-button"
                  onClick={() =>
                    onOpenUserProfile?.({
                      id: message.senderId,
                      displayName: isMine ? currentUser?.displayName ?? '我' : message.senderName,
                      profileImageUrl: avatarUrl,
                      creditScore:
                        Number(message.senderId) === Number(campaign?.host?.id)
                          ? campaign?.host?.creditScore ?? null
                          : null,
                    })
                  }
                  disabled={message.senderId == null || !onOpenUserProfile}
                  aria-label={`查看 ${isMine ? '我' : message.senderName} 的個人資料`}
                  title="查看個人資料"
                >
                  {avatarUrl ? <img src={avatarUrl} alt="" className="avatar-image" /> : <span>{avatarLabel}</span>}
                </button>

                <div className={isMine ? 'chat-bubble mine' : 'chat-bubble'}>
                  <header className="chat-bubble-header">
                    <strong>{isMine ? '我' : message.senderName}</strong>
                    <time>{formatMessageTime(message.timestamp)}</time>
                  </header>
                  <p>{message.content}</p>
                </div>
              </article>
            );
          })}
        </div>

        {statusMessage && <p className="inline-warning">{statusMessage}</p>}
        {error && <p className="inline-error">{error}</p>}

        <div className="chat-composer">
          <input
            type="text"
            value={draft}
            placeholder={isChatStopped ? '聊天室已停止連線' : '輸入訊息'}
            disabled={isChatStopped}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <button type="button" className="text-button" onClick={handleSend} disabled={isChatStopped}>
            送出
          </button>
        </div>

        {isDisputeDialogOpen && (
          <div className="chat-dialog-backdrop" onClick={() => !isRaisingDispute && setIsDisputeDialogOpen(false)}>
            <div className="chat-dialog" onClick={(event) => event.stopPropagation()}>
              <div className="chat-dialog-header">
                <h3>提出仲裁</h3>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setIsDisputeDialogOpen(false)}
                  disabled={isRaisingDispute}
                >
                  關閉
                </button>
              </div>
              <p className="chat-dialog-copy">請填寫未收到商品的原因，送出後會通知系統介入。</p>
              <textarea
                className="chat-dialog-textarea"
                value={disputeReasonDraft}
                onChange={(event) => setDisputeReasonDraft(event.target.value)}
                placeholder="例如：主揪表示已面交，但我實際未收到商品。"
                rows={4}
                disabled={isRaisingDispute}
              />
              <div className="chat-dialog-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setIsDisputeDialogOpen(false)}
                  disabled={isRaisingDispute}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={handleSubmitDispute}
                  disabled={isRaisingDispute || !disputeReasonDraft.trim()}
                >
                  {isRaisingDispute ? '送出中..' : '送出仲裁'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CampaignChatModal;
