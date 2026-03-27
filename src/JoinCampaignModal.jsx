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

  const unitPrice = Number(selectedDeal.pricePerUnit) || 0;
  const quantity = Math.max(0, Number(purchaseQuantity) || 0);
  const totalAmount = unitPrice * quantity;
  const totalAmountLabel = new Intl.NumberFormat('zh-TW').format(totalAmount);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal join-campaign-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          {labels.close}
        </button>
        <div className="join-campaign-content">
          <p className="eyebrow">{labels.joinCampaign}</p>
          <div className="join-campaign-summary">
            <div className="join-campaign-image-wrap">
              <img src={selectedDeal.image} alt={selectedDeal.itemName} className="join-campaign-image" />
            </div>
            <div className="join-campaign-meta">
              <h2 className="modal-title">{selectedDeal.itemName}</h2>
              <p className="modal-copy join-campaign-remaining">
                {labels.remaining}: {selectedDeal.availableQuantity} {labels.itemUnit}
              </p>
            </div>
          </div>

          <label className="profile-field join-campaign-field">
            <span>{labels.purchaseQuantity}</span>
            <input
              type="number"
              min="1"
              step="1"
              value={purchaseQuantity}
              onChange={(event) => onChangeQuantity(event.target.value)}
            />
          </label>

          <p className="join-campaign-total">總共: {totalAmountLabel}元</p>

          {purchaseError && <p className="inline-error">{purchaseError}</p>}

          <button type="button" className="save-button join-campaign-submit" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? labels.submittingJoinCampaign : labels.confirmJoinCampaign}
          </button>
        </div>
      </div>
    </div>
  );
}

export default JoinCampaignModal;
