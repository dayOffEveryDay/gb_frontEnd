import { useState } from 'react';

export default function PurchaseRequestQuoteModal({
  request,
  initialQuote = null,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}) {
  const [quoteAmount, setQuoteAmount] = useState(() =>
    initialQuote?.quoteAmount == null ? '' : String(initialQuote.quoteAmount)
  );
  const [note, setNote] = useState(() => initialQuote?.quoteNote ?? initialQuote?.note ?? '');

  if (!request) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal purchase-quote-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <p className="eyebrow">{initialQuote ? '修改報價' : '委託報價'}</p>
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
              {isSubmitting ? '送出中...' : initialQuote ? '儲存報價' : '送出報價'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
