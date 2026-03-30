function CreateCampaignSuccessModal({
  labels,
  isOpen,
  summary,
  formatDateTime,
  getScenarioLabel,
  onClose,
}) {
  if (!isOpen || !summary) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal create-summary-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          {labels.close}
        </button>
        <p className="eyebrow">{labels.createDeal}</p>
        <h2 className="modal-title">{labels.createCampaignSuccess}</h2>
        <div className="summary-list">
          <div className="summary-item">
            <span className="footer-label">商品</span>
            <strong>{summary.itemName}</strong>
          </div>
          <div className="summary-item">
            <span className="footer-label">類型</span>
            <strong>{getScenarioLabel(summary.scenarioType)}</strong>
          </div>
          <div className="summary-item">
            <span className="footer-label">店面</span>
            <strong>{summary.storeName}</strong>
          </div>
          <div className="summary-item">
            <span className="footer-label">類別</span>
            <strong>{summary.categoryName}</strong>
          </div>
          <div className="summary-item">
            <span className="footer-label">總數量</span>
            <strong>{summary.productTotalQuantity}</strong>
          </div>
          <div className="summary-item">
            <span className="footer-label">待認購數量</span>
            <strong>{summary.openQuantity}</strong>
          </div>
          <div className="summary-item">
            <span className="footer-label">單價</span>
            <strong>NT$ {summary.pricePerUnit}</strong>
          </div>
          <div className="summary-item">
            <span className="footer-label">截止時間</span>
            <strong>{formatDateTime(summary.expireTime)}</strong>
          </div>
          <div className="summary-item">
            <span className="footer-label">面交時間</span>
            <strong>{formatDateTime(summary.meetupTime)}</strong>
          </div>
          <div className="summary-item full">
            <span className="footer-label">面交地點</span>
            <strong>{summary.meetupLocation || labels.noValue}</strong>
          </div>
          <div className="summary-item full">
            <span className="footer-label">圖片數量</span>
            <strong>{summary.imageCount} 張</strong>
          </div>
        </div>
        <p className="panel-note">10 秒後會自動關閉，也可以直接點背景關閉。</p>
      </div>
    </div>
  );
}

export default CreateCampaignSuccessModal;
