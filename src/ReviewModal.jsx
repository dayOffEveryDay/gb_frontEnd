import { useEffect, useMemo, useState } from 'react';
import { checkReviewStatus, createReview } from './api';

function normalizeReviewState(data) {
  if (!data || typeof data !== 'object') {
    return {
      isReviewed: false,
      rating: 5,
      comment: '',
    };
  }

  const rating = Number(data.rating);

  return {
    isReviewed: Boolean(
      data.reviewed ??
        data.isReviewed ??
        data.alreadyReviewed ??
        data.exists ??
        data.checked
    ),
    rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : 5,
    comment: typeof data.comment === 'string' ? data.comment : '',
  };
}

function ReviewModal({ isOpen, token, reviewTarget, onClose, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewed, setIsReviewed] = useState(false);

  const title = useMemo(() => {
    if (!reviewTarget) {
      return '評價';
    }

    return `評價 ${reviewTarget.revieweeName ?? '對方'}`;
  }, [reviewTarget]);

  useEffect(() => {
    if (!isOpen || !reviewTarget || !token) {
      return;
    }

    let cancelled = false;

    setRating(5);
    setComment('');
    setError('');
    setIsReviewed(false);
    setIsChecking(true);

    checkReviewStatus(reviewTarget.campaignId, reviewTarget.revieweeId, token)
      .then((data) => {
        if (cancelled) {
          return;
        }

        const nextState = normalizeReviewState(data);
        setIsReviewed(nextState.isReviewed);
        setRating(nextState.rating);
        setComment(nextState.comment);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(nextError.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsChecking(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, reviewTarget, token]);

  if (!isOpen || !reviewTarget) {
    return null;
  }

  const isLocked = isChecking || isSubmitting || isReviewed;

  const handleSubmit = async () => {
    if (!token || isLocked) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await createReview(
        {
          campaignId: reviewTarget.campaignId,
          revieweeId: reviewTarget.revieweeId,
          rating,
          comment: comment.trim(),
        },
        token
      );
      setIsReviewed(true);
      onSubmitted?.(reviewTarget);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '送出評價失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card review-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <p className="eyebrow">評價</p>
          <button type="button" className="modal-close" onClick={onClose} disabled={isSubmitting}>
            關閉
          </button>
        </div>

        <h2 className="modal-title">{title}</h2>

        <div className={isReviewed ? 'review-panel is-readonly' : 'review-panel'}>
          <p className="review-copy">
            {reviewTarget.source === 'host' ? '請評價這位團員的面交與配合狀況。' : '請評價主揪的面交與配合狀況。'}
          </p>

          <div className="review-rating-row" role="radiogroup" aria-label="評分">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={rating === value ? 'review-rating-button active' : 'review-rating-button'}
                onClick={() => setRating(value)}
                disabled={isLocked}
                aria-pressed={rating === value}
              >
                {value} 分
              </button>
            ))}
          </div>

          <label className="profile-field">
            <span>評語</span>
            <textarea
              className="review-textarea"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="例如：很準時、溝通順利"
              rows={4}
              disabled={isLocked}
            />
          </label>

          {isChecking && <p className="panel-note">檢查評價狀態中...</p>}
          {!isChecking && isReviewed && <p className="panel-note">你已經評價過，以下為先前留下的內容。</p>}
          {error && <p className="inline-error">{error}</p>}
        </div>

        <div className="participation-actions">
          <button
            type="button"
            className="save-button"
            onClick={handleSubmit}
            disabled={isLocked}
          >
            {isSubmitting ? '送出中...' : isReviewed ? '已評價' : '送出評價'}
          </button>
          <button type="button" className="text-button" onClick={onClose} disabled={isSubmitting}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReviewModal;
