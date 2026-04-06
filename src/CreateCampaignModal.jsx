import { getSuggestedMeetupTime } from './homeUtils';

function CreateCampaignModal({
  labels,
  isOpen,
  stores,
  categories,
  typeOptions,
  expirePresetOptions,
  campaignForm,
  createCampaignError,
  isCreatingCampaign,
  onClose,
  setCampaignForm,
  onSubmit,
  setCreateCampaignError,
}) {
  if (!isOpen) {
    return null;
  }

  const isScheduledCampaign = campaignForm.scenarioType === 'SCHEDULED';
  const showExpirePresets = !isScheduledCampaign;
  const showExpireCustomInput = isScheduledCampaign || campaignForm.expirePreset === 'custom';

  const syncExpirePreset = (value) => {
    setCampaignForm((current) => {
      const nextForm = {
        ...current,
        expirePreset: value,
      };

      return {
        ...nextForm,
        meetupTime: getSuggestedMeetupTime(nextForm),
      };
    });
  };

  const syncExpireTime = (value) => {
    setCampaignForm((current) => {
      const nextForm = {
        ...current,
        expireTime: value,
      };

      return {
        ...nextForm,
        meetupTime: getSuggestedMeetupTime(nextForm),
      };
    });
  };

  const handleScenarioTypeChange = (value) => {
    setCampaignForm((current) => {
      const nextForm = {
        ...current,
        scenarioType: value,
        expirePreset: value === 'SCHEDULED' ? 'custom' : current.expirePreset || '10m',
      };

      return {
        ...nextForm,
        meetupTime: getSuggestedMeetupTime(nextForm),
      };
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal create-campaign-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <p className="eyebrow">{labels.createDeal}</p>
          <button type="button" className="modal-close" onClick={onClose}>
            {labels.close}
          </button>
        </div>
        <h2 className="modal-title">{labels.createCampaignTitle}</h2>
        <p className="create-campaign-disclaimer">本平台僅供媒合</p>

        <div className="campaign-form">
          <label className="profile-field">
            <span>{labels.store}</span>
            <select
              required
              value={campaignForm.storeId}
              onChange={(event) => setCampaignForm((current) => ({ ...current, storeId: event.target.value }))}
            >
              <option value="">{labels.selectStore}</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>

          <label className="profile-field">
            <span>{labels.category}</span>
            <select
              required
              value={campaignForm.categoryId}
              onChange={(event) => setCampaignForm((current) => ({ ...current, categoryId: event.target.value }))}
            >
              <option value="">{labels.selectCategory}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="profile-field">
            <span>{labels.scenarioType}</span>
            <select
              required
              value={campaignForm.scenarioType}
              onChange={(event) => handleScenarioTypeChange(event.target.value)}
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="profile-field">
            <span>{labels.itemName}</span>
            <input
              type="text"
              required
              value={campaignForm.itemName}
              onChange={(event) => setCampaignForm((current) => ({ ...current, itemName: event.target.value }))}
            />
          </label>

          <label className="profile-field">
            <span>{labels.itemImages}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              required
              onChange={(event) => {
                const nextImages = Array.from(event.target.files ?? []).slice(0, 3);
                setCampaignForm((current) => ({
                  ...current,
                  images: nextImages,
                }));

                if ((event.target.files?.length ?? 0) > 3) {
                  setCreateCampaignError('圖片最多只能選擇 3 張，系統會只保留前 3 張。');
                } else {
                  setCreateCampaignError('');
                }
              }}
            />
            <span className="field-hint">可複選，最多 3 張</span>
          </label>

          <label className="profile-field">
            <span>{labels.unitPrice}</span>
            <input
              type="number"
              min="1"
              required
              value={campaignForm.pricePerUnit}
              onChange={(event) => setCampaignForm((current) => ({ ...current, pricePerUnit: event.target.value }))}
            />
          </label>

          <label className="profile-field">
            <span>{labels.totalQuantityLabel ?? '總數量'}</span>
            <input
              type="number"
              min="1"
              required
              value={campaignForm.productTotalQuantity}
              onChange={(event) =>
                setCampaignForm((current) => ({ ...current, productTotalQuantity: event.target.value }))
              }
            />
          </label>

          <label className="profile-field">
            <span>{labels.pendingQuantity}</span>
            <input
              type="number"
              min="1"
              required
              value={campaignForm.openQuantity}
              onChange={(event) => setCampaignForm((current) => ({ ...current, openQuantity: event.target.value }))}
            />
          </label>

          <label className="profile-field">
            <span>{labels.expireTime}</span>
            {showExpirePresets && (
              <div className="preset-row">
                {expirePresetOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={campaignForm.expirePreset === option.value ? 'preset-button active' : 'preset-button'}
                    onClick={() => syncExpirePreset(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            {showExpireCustomInput && (
              <input
                type="datetime-local"
                required
                value={campaignForm.expireTime}
                onChange={(event) => syncExpireTime(event.target.value)}
              />
            )}
          </label>

          <label className="profile-field">
            <span>{labels.meetupDateTime}</span>
            <input
              type="datetime-local"
              required
              value={campaignForm.meetupTime}
              onChange={(event) => setCampaignForm((current) => ({ ...current, meetupTime: event.target.value }))}
            />
          </label>

          <label className="profile-field">
            <span>{labels.meetupLocationLabel}</span>
            <input
              type="text"
              required
              value={campaignForm.meetupLocation}
              onChange={(event) =>
                setCampaignForm((current) => ({ ...current, meetupLocation: event.target.value }))
              }
            />
          </label>
        </div>

        {createCampaignError && <p className="inline-error">{createCampaignError}</p>}

        <button type="button" className="save-button" onClick={onSubmit} disabled={isCreatingCampaign}>
          {isCreatingCampaign ? labels.savingCampaign : labels.saveCampaign}
        </button>
      </div>
    </div>
  );
}

export default CreateCampaignModal;
