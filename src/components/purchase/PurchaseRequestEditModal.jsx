import { useState, useEffect } from 'react';
import { fetchUserDeliveryProfiles } from '../../api';
import { DELIVERY_LABELS, getDeliveryLabel } from './purchaseRequestUtils';
import DeliveryProfileSingleSelect from './DeliveryProfileSingleSelect';

export default function PurchaseRequestEditModal({ request, token, isSubmitting, error, onClose, onSubmit }) {
  const [form, setForm] = useState(() =>
    request
      ? {
      itemName: request.productName ?? '',
      itemDescription: request.description ?? '',
      fixedRewardAmount: request.fixedRewardAmount == null ? '' : String(request.fixedRewardAmount),
      deliveryMethod: request.deliveryMethod || 'FACE_TO_FACE',
      selectedProfileIds: (request.deliveryDetails ?? []).map((detail) => detail.sourceProfileId ?? detail.source_profile_id).filter(Boolean),
      requestExpireTime: request.deadlineAt ? String(request.deadlineAt).slice(0, 10) : '',
      deliveryDeadlineHours: request.deliveryDeadlineHours == null ? '' : String(request.deliveryDeadlineHours),
      minCreditScore: request.minCreditScore == null ? '' : String(request.minCreditScore),
        }
      : null
  );
  const [deliveryProfiles, setDeliveryProfiles] = useState([]);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (!request || !token || !form?.deliveryMethod || request.status === 'QUOTING') return undefined;
    let cancelled = false;
    fetchUserDeliveryProfiles(form.deliveryMethod, token)
      .then((data) => {
        if (!cancelled) {
          setDeliveryProfiles(Array.isArray(data) ? data : []);
          setProfileError('');
        }
      })
      .catch((nextError) => {
        if (!cancelled) setProfileError(nextError instanceof Error ? nextError.message : '常用交付資料載入失敗');
      });
    return () => { cancelled = true; };
  }, [form?.deliveryMethod, request, token]);

  if (!request || !form) return null;
  const deadlineOnly = request.status === 'QUOTING';
  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value, ...(key === 'deliveryMethod' ? { selectedProfileIds: [] } : {}) }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-modal purchase-request-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <p className="eyebrow">編輯委託</p>
          <button type="button" className="modal-close" onClick={onClose} disabled={isSubmitting}>關閉</button>
        </div>
        <h2 className="modal-title">{request.productName}</h2>
        {deadlineOnly && <p className="panel-note">已有有效報價，目前只能延後委託期限。</p>}
        <form className="purchase-request-form" onSubmit={(event) => { event.preventDefault(); onSubmit(request, form); }}>
          <label className="form-field">
            <span>商品名稱</span>
            <input value={form.itemName} onChange={(event) => updateField('itemName', event.target.value)} disabled={deadlineOnly} required />
          </label>
          <label className="form-field">
            <span>商品說明</span>
            <textarea rows="3" value={form.itemDescription} onChange={(event) => updateField('itemDescription', event.target.value)} disabled={deadlineOnly} />
          </label>
          {request.rewardType === 'FIXED' && (
            <label className="form-field">
              <span>固定酬金</span>
              <input type="number" min="1" value={form.fixedRewardAmount} onChange={(event) => updateField('fixedRewardAmount', event.target.value)} disabled={deadlineOnly} required />
            </label>
          )}
          {!deadlineOnly && (
            <>
              <label className="form-field">
                <span>交貨方式</span>
                <select value={form.deliveryMethod} onChange={(event) => updateField('deliveryMethod', event.target.value)}>
                  {Object.entries(DELIVERY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <section className="delivery-profile-picker">
                <strong>選擇{getDeliveryLabel(form.deliveryMethod)}資料 *</strong>
                {form.deliveryMethod === 'FACE_TO_FACE' && <p className="field-hint">面交地點可以複選。</p>}
                {deliveryProfiles.length === 0 ? <p className="field-hint">尚未建立此類型的常用交付資料。</p> : (
                  form.deliveryMethod === 'FACE_TO_FACE' ? (
                    <div className="delivery-profile-picker-options">
                      {deliveryProfiles.map((profile) => {
                        const checked = form.selectedProfileIds.some((id) => String(id) === String(profile.id));
                        return (
                          <label key={profile.id} className="market-checkbox-filter">
                            <input type="checkbox" name="edit-delivery-profile" checked={checked} onChange={(event) => updateField('selectedProfileIds', event.target.checked ? [...form.selectedProfileIds, profile.id] : form.selectedProfileIds.filter((id) => String(id) !== String(profile.id)))} />
                            <span>{profile.label || profile.locationName || getDeliveryLabel(profile.profileType)}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <DeliveryProfileSingleSelect
                      profiles={deliveryProfiles}
                      deliveryMethod={form.deliveryMethod}
                      selectedProfileIds={form.selectedProfileIds}
                      onChange={(profileId) => updateField('selectedProfileIds', [profileId])}
                    />
                  )
                )}
                {profileError && <p className="inline-error">{profileError}</p>}
              </section>
            </>
          )}
          <div className="purchase-request-form-grid">
            <label className="form-field">
              <span>委託到期日</span>
              <input type="date" className="local-date-input" max="9999-12-31" value={form.requestExpireTime} onChange={(event) => updateField('requestExpireTime', event.target.value)} required />
            </label>
            <label className="form-field">
              <span>成立後交付時數</span>
              <input type="number" min="1" value={form.deliveryDeadlineHours} onChange={(event) => updateField('deliveryDeadlineHours', event.target.value)} disabled={deadlineOnly} required />
            </label>
            <label className="form-field">
              <span>最低信用分</span>
              <input type="number" min="0" value={form.minCreditScore} onChange={(event) => updateField('minCreditScore', event.target.value)} disabled={deadlineOnly} />
            </label>
          </div>
          {error && <p className="inline-error">{error}</p>}
          <div className="purchase-request-submit-row">
            <button type="button" className="text-button" onClick={onClose} disabled={isSubmitting}>取消</button>
            <button type="submit" className="create-button active" disabled={isSubmitting}>{isSubmitting ? '儲存中...' : '儲存變更'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
