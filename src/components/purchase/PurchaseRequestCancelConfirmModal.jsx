export default function PurchaseRequestCancelConfirmModal({ request, isSubmitting, onClose, onConfirm }) {
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
