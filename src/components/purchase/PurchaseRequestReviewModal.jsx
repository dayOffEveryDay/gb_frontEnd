import { useState } from 'react';

export default function PurchaseRequestReviewModal({ request, isSubmitting, error, onClose, onSubmit }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

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
