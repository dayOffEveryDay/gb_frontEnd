import { isSameUser, getBlockedLabel, getDeliveryLabel, getStatusLabel, getRewardLabel } from './purchaseRequestUtils';
import { useState, useRef, useEffect } from 'react';
import { formatDateTime } from '../../homeUtils';
import { AvatarIcon, DiagonalExpandIcon } from '../icons/Icons';

export default function PurchaseRequestCard({
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
  onExtend,
  onReview,
  onOpenOrder,
  onOpenChat,
  onEditOwnQuote,
  onWithdrawOwnQuote,
  onEditRequest,
  onManageImages,
  onRequireLogin,
  onExpand,
  onShare,
}) {
  const isRequester = isSameUser(request.requester?.id, currentUser?.id);
  const isRunner = isSameUser(request.assignedRunner?.id ?? request.runner?.id, currentUser?.id);
  const cardStatus = request.orderStatus || request.status;
  const requesterProfileImageUrl = request.requester?.profileImageUrl || (isRequester ? currentUser?.profileImageUrl : '');
  const image = request.imageUrls[0] ?? '';
  const blockedLabel = getBlockedLabel(request.actBlockedReason);
  const isBusy = actionId === request.id;
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef(null);
  const canViewQuotes = isRequester && request.rewardType === 'QUOTE' && ['OPEN', 'QUOTING'].includes(request.status);
  const canManageImages = isRequester && request.status === 'OPEN';
  const canCancelRequest = isRequester && ['OPEN', 'QUOTING'].includes(request.status);
  const canExtendRequest = isRequester && ['OPEN', 'QUOTING'].includes(request.status);
  const canQuoteRequest =
    currentUser && ['OPEN', 'QUOTING'].includes(request.status) && request.rewardType === 'QUOTE' && !isRequester;
  const canDeliverOrder = isRunner && request.orderId != null && cardStatus === 'IN_PROGRESS' && request.deliveryMethod === 'FACE_TO_FACE';
  const canCompleteOrder =
    isRequester &&
    request.orderId != null &&
    ['IN_PROGRESS', 'SHIPPED', 'DELIVERED_PENDING_CONFIRM'].includes(cardStatus);
  const canReviewOrder = currentUser && (isRequester || isRunner) && request.orderId != null && cardStatus === 'COMPLETED';
  const canOpenOrder = currentUser && (isRequester || isRunner) && request.orderId != null;
  const canOpenChat = canOpenOrder && request.chatRoomId != null;
  const canManageOwnQuote = request.quoteId != null && request.quoteStatus === 'ACTIVE';
  const canEditRequest = isRequester && ['OPEN', 'QUOTING'].includes(request.status);
  const hasActionMenu = Boolean(onShare) || canViewQuotes || canManageImages || canCancelRequest || canExtendRequest || canOpenOrder || canManageOwnQuote || canEditRequest;
  const hasInlineActions =
    (!currentUser && request.status === 'OPEN') ||
    (currentUser && request.status === 'OPEN' && request.rewardType === 'FIXED' && !isRequester) ||
    canQuoteRequest ||
    canDeliverOrder ||
    canCompleteOrder ||
    canReviewOrder;

  useEffect(() => {
    if (!isActionMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (actionMenuRef.current?.contains(event.target)) {
        return;
      }
      setIsActionMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isActionMenuOpen]);

  if (viewMode === 'compact') {
    const requesterName = request.requester?.displayName ?? '--';
    const deliveryLabel = getDeliveryLabel(request.deliveryMethod);

    return (
      <article
        className={[
          'compact-market-row',
          'purchase-request-compact-row',
          hasInlineActions ? 'purchase-request-compact-row-with-actions' : '',
          hasActionMenu ? 'purchase-request-compact-row-with-menu' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {hasActionMenu && (
          <div className="purchase-request-menu-wrap" ref={actionMenuRef}>
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
                <button
                  type="button"
                  onClick={() => {
                    void onShare?.(request);
                    setIsActionMenuOpen(false);
                  }}
                >
                  分享到 LINE
                </button>
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
                {canOpenOrder && (
                  <button type="button" onClick={() => { onOpenOrder(request); setIsActionMenuOpen(false); }}>
                    訂單詳情
                  </button>
                )}
                {canOpenChat && (
                  <button type="button" onClick={() => { onOpenChat(request); setIsActionMenuOpen(false); }}>
                    開啟聊天室
                  </button>
                )}
                {canManageOwnQuote && (
                  <button type="button" onClick={() => { onEditOwnQuote(request); setIsActionMenuOpen(false); }}>
                    修改報價
                  </button>
                )}
                {canEditRequest && (
                  <button type="button" onClick={() => { onEditRequest(request); setIsActionMenuOpen(false); }}>
                    編輯委託
                  </button>
                )}
                {canManageOwnQuote && (
                  <button type="button" className="danger" onClick={() => { onWithdrawOwnQuote(request); setIsActionMenuOpen(false); }} disabled={isBusy}>
                    撤回報價
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
                {canExtendRequest && (
                  <button
                    type="button"
                    onClick={() => {
                      onExtend(request);
                      setIsActionMenuOpen(false);
                    }}
                    disabled={isBusy}
                  >
                    延長期限
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
            <span className={`compact-market-type purchase-request-compact-status ${cardStatus.toLowerCase()}`}>
              {getStatusLabel(cardStatus)}
            </span>
          </div>
          <div className="compact-market-meta">
            <span>酬金：{getRewardLabel(request)}</span>
            <span>交貨：{deliveryLabel}</span>
          </div>
          <div className="compact-market-bottom">
            <span className="compact-market-host purchase-request-compact-requester">
              <span className="compact-host-avatar">
                {requesterProfileImageUrl ? (
                  <img src={requesterProfileImageUrl} alt="" className="avatar-image" />
                ) : (
                  <AvatarIcon />
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
        <div className="purchase-request-menu-wrap" ref={actionMenuRef}>
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
              <button
                type="button"
                onClick={() => {
                  void onShare?.(request);
                  setIsActionMenuOpen(false);
                }}
              >
                分享到 LINE
              </button>
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
              {canOpenOrder && (
                <button type="button" onClick={() => { onOpenOrder(request); setIsActionMenuOpen(false); }}>
                  訂單詳情
                </button>
              )}
              {canOpenChat && (
                <button type="button" onClick={() => { onOpenChat(request); setIsActionMenuOpen(false); }}>
                  開啟聊天室
                </button>
              )}
              {canManageOwnQuote && (
                <button type="button" onClick={() => { onEditOwnQuote(request); setIsActionMenuOpen(false); }}>
                  修改報價
                </button>
              )}
              {canEditRequest && (
                <button type="button" onClick={() => { onEditRequest(request); setIsActionMenuOpen(false); }}>
                  編輯委託
                </button>
              )}
              {canManageOwnQuote && (
                <button type="button" className="danger" onClick={() => { onWithdrawOwnQuote(request); setIsActionMenuOpen(false); }} disabled={isBusy}>
                  撤回報價
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
              {canExtendRequest && (
                <button
                  type="button"
                  onClick={() => {
                    onExtend(request);
                    setIsActionMenuOpen(false);
                  }}
                  disabled={isBusy}
                >
                  延長期限
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
          <span className={`purchase-request-status ${cardStatus.toLowerCase()}`}>
            {getStatusLabel(cardStatus)}
          </span>
        </div>

        <div className="purchase-request-meta-grid">
          <span>酬金：{getRewardLabel(request)}</span>
          <span>交貨：{getDeliveryLabel(request.deliveryMethod)}</span>
          {request.deliveryDeadlineHours != null && <span>成立後：{request.deliveryDeadlineHours} 小時內交付</span>}
        </div>

        {viewMode !== 'compact' && request.deliveryPublicSummary && (
          <p className="purchase-request-description">交付：{request.deliveryPublicSummary}</p>
        )}
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
              {requesterProfileImageUrl ? (
                <img src={requesterProfileImageUrl} alt="" />
              ) : (
                <AvatarIcon />
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

          {canDeliverOrder && (
            <button type="button" className="create-button active" onClick={() => onDeliver(request)} disabled={isBusy}>
              {isBusy ? '處理中...' : '標記已交付'}
            </button>
          )}

          {canCompleteOrder && (
            <button type="button" className="create-button active" onClick={() => onComplete(request)} disabled={isBusy}>
              {isBusy ? '處理中...' : '確認完成'}
            </button>
          )}

          {canReviewOrder && (
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
                  disabled={quote.status !== 'ACTIVE' || isBusy}
                >
                  {quote.status === 'ACTIVE' ? '委託' : getStatusLabel(quote.status)}
                </button>
              </div>
            ))}
          </div>
        )}
    </article>
  );
}
