function JoinCampaignModal({
  isOpen,
  labels,
  selectedDeal,
  purchaseQuantity,
  purchaseError,
  isSubmitting,
  onClose,
  onChangeQuantity,
  onSubmit,
}) {
  if (!isOpen || !selectedDeal) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal join-campaign-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          {labels.close}
        </button>
        <p className="eyebrow">{labels.joinCampaign}</p>
        <h2 className="modal-title">{selectedDeal.itemName}</h2>
        <p className="modal-copy">
          {labels.remaining}: {selectedDeal.availableQuantity} {labels.itemUnit}
        </p>

        <label className="profile-field">
          <span>{labels.purchaseQuantity}</span>
          <input
            type="number"
            min="1"
            step="1"
            value={purchaseQuantity}
            onChange={(event) => onChangeQuantity(event.target.value)}
          />
        </label>

        {purchaseError && <p className="inline-error">{purchaseError}</p>}

        <button type="button" className="save-button" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? labels.submittingJoinCampaign : labels.confirmJoinCampaign}
        </button>
      </div>
    </div>
  );
}

export default JoinCampaignModal;
