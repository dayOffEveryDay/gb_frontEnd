import { useEffect, useRef } from 'react';

function ImageGalleryModal({ isOpen, title, images, activeIndex, onClose, onPrev, onNext, onSelect }) {
  const touchStartXRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft') {
        onPrev();
      } else if (event.key === 'ArrowRight') {
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [isOpen, onClose, onNext, onPrev]);

  if (!isOpen || !images.length) {
    return null;
  }

  const safeIndex = Math.min(Math.max(activeIndex, 0), images.length - 1);
  const activeImage = images[safeIndex];

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;

    if (startX == null || endX == null) {
      return;
    }

    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 48) {
      return;
    }

    if (deltaX < 0) {
      onNext();
    } else {
      onPrev();
    }
  };

  return (
    <div className="modal-backdrop image-gallery-backdrop" onClick={onClose}>
      <div
        className="image-gallery-modal"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button type="button" className="modal-close image-gallery-close" onClick={onClose}>
          關閉
        </button>
        <div className="image-gallery-stage">
          {images.length > 1 && (
            <button type="button" className="image-gallery-nav prev" onClick={onPrev} aria-label="上一張">
              ‹
            </button>
          )}
          <img src={activeImage} alt={title} className="image-gallery-image" />
          {images.length > 1 && (
            <button type="button" className="image-gallery-nav next" onClick={onNext} aria-label="下一張">
              ›
            </button>
          )}
        </div>
        <div className="image-gallery-footer">
          <strong>{title}</strong>
          <span>
            {safeIndex + 1} / {images.length}
          </span>
        </div>
        {images.length > 1 && (
          <div className="image-gallery-thumbs">
            {images.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                className={index === safeIndex ? 'image-gallery-thumb active' : 'image-gallery-thumb'}
                onClick={() => onSelect(index)}
              >
                <img src={image} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ImageGalleryModal;
