function ActionDialog({
  isOpen,
  eyebrow = '',
  title,
  description = '',
  confirmLabel = '確認',
  cancelLabel = '取消',
  confirmClassName = 'save-button',
  isSubmitting = false,
  onClose,
  onConfirm,
  children,
}) {
  if (!isOpen) return null;

  return (
    <div className="action-dialog-backdrop" onClick={() => !isSubmitting && onClose?.()}>
      <section className="action-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="action-dialog-heading">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h3>{title}</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={isSubmitting}>關閉</button>
        </div>
        {description && <p className="action-dialog-description">{description}</p>}
        {children}
        <div className="action-dialog-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={isSubmitting}>{cancelLabel}</button>
          {onConfirm && <button type="button" className={confirmClassName} onClick={onConfirm} disabled={isSubmitting}>{isSubmitting ? '處理中...' : confirmLabel}</button>}
        </div>
      </section>
    </div>
  );
}

export default ActionDialog;
