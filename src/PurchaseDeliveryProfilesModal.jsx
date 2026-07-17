import { useCallback, useEffect, useState } from 'react';
import {
  createUserDeliveryProfile,
  deleteUserDeliveryProfile,
  fetchUserDeliveryProfiles,
  updateUserDeliveryProfile,
} from './api';

const EMPTY_FORM = {
  profileType: 'FACE_TO_FACE',
  locationType: 'CUSTOM',
  label: '',
  city: '',
  district: '',
  locationName: '',
  rangeStart: '',
  rangeEnd: '',
  displayText: '',
  isDefault: false,
};

const PROFILE_TYPE_LABELS = {
  FACE_TO_FACE: '面交',
  HOME_DELIVERY: '宅配',
  STORE_TO_STORE: '店到店',
};

const LOCATION_TYPES = ['CUSTOM', 'LANDMARK', 'TRANSIT_RANGE', 'ROAD', 'DISTRICT', 'ADDRESS', 'STORE'];

function toForm(profile) {
  if (!profile) return EMPTY_FORM;
  return {
    profileType: profile.profileType ?? 'FACE_TO_FACE',
    locationType: profile.locationType ?? 'CUSTOM',
    label: profile.label ?? '',
    city: profile.city ?? '',
    district: profile.district ?? '',
    locationName: profile.locationName ?? '',
    rangeStart: profile.rangeStart ?? '',
    rangeEnd: profile.rangeEnd ?? '',
    displayText: profile.displayText ?? '',
    isDefault: Boolean(profile.isDefault),
  };
}

function PurchaseDeliveryProfilesModal({ isOpen, token, onChanged, onClose }) {
  const [profiles, setProfiles] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const loadProfiles = useCallback(async () => {
    if (!isOpen || !token) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchUserDeliveryProfiles(undefined, token);
      setProfiles(Array.isArray(data) ? data : []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '常用交付資料載入失敗');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, token]);

  useEffect(() => {
    if (isOpen) {
      setEditingId(null);
      setForm(EMPTY_FORM);
      void loadProfiles();
    }
  }, [isOpen, loadProfiles]);

  if (!isOpen) return null;
  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.displayText.trim()) {
      setError('顯示文字必填');
      return;
    }
    setIsSaving(true);
    setError('');
    const payload = {
      ...form,
      label: form.label.trim() || undefined,
      city: form.city.trim() || undefined,
      district: form.district.trim() || undefined,
      locationName: form.locationName.trim() || undefined,
      rangeStart: form.rangeStart.trim() || undefined,
      rangeEnd: form.rangeEnd.trim() || undefined,
      displayText: form.displayText.trim(),
      detail: {},
    };
    try {
      if (editingId == null) {
        await createUserDeliveryProfile(payload, token);
      } else {
        await updateUserDeliveryProfile(editingId, payload, token);
      }
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadProfiles();
      onChanged?.();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '常用交付資料儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (profile) => {
    if (!window.confirm(`確定刪除「${profile.label || profile.displayText}」？`)) return;
    setIsSaving(true);
    setError('');
    try {
      await deleteUserDeliveryProfile(profile.id, token);
      await loadProfiles();
      onChanged?.();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '常用交付資料刪除失敗');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop nested-modal-backdrop" onClick={(event) => { event.stopPropagation(); onClose(); }}>
      <div className="login-modal delivery-profile-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-top-row">
          <div>
            <p className="eyebrow">常用交付資料</p>
            <h2 className="modal-title">管理交付範本</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>關閉</button>
        </div>

        <div className="delivery-profile-list">
          {isLoading && <p className="muted-copy">載入中...</p>}
          {!isLoading && profiles.length === 0 && <p className="muted-copy">尚未建立常用交付資料。</p>}
          {profiles.map((profile) => (
            <article key={profile.id} className="delivery-profile-row">
              <div>
                <strong>{profile.label || profile.displayText}</strong>
                <span>{PROFILE_TYPE_LABELS[profile.profileType] ?? profile.profileType} · {profile.displayText}</span>
              </div>
              <div className="delivery-profile-row-actions">
                <button type="button" className="text-button" onClick={() => { setEditingId(profile.id); setForm(toForm(profile)); }}>編輯</button>
                <button type="button" className="ghost-button danger" onClick={() => void handleDelete(profile)} disabled={isSaving}>刪除</button>
              </div>
            </article>
          ))}
        </div>

        <form className="purchase-request-form delivery-profile-form" onSubmit={handleSubmit}>
          <h3>{editingId == null ? '新增範本' : '編輯範本'}</h3>
          <div className="purchase-request-form-grid">
            <label className="form-field">
              <span>交付類型</span>
              <select value={form.profileType} onChange={(event) => updateField('profileType', event.target.value)}>
                {Object.entries(PROFILE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>地點類型</span>
              <select value={form.locationType} onChange={(event) => updateField('locationType', event.target.value)}>
                {LOCATION_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="form-field"><span>範本名稱</span><input value={form.label} onChange={(event) => updateField('label', event.target.value)} /></label>
            <label className="form-field"><span>縣市</span><input value={form.city} onChange={(event) => updateField('city', event.target.value)} /></label>
            <label className="form-field"><span>區域</span><input value={form.district} onChange={(event) => updateField('district', event.target.value)} /></label>
            <label className="form-field"><span>地點名稱</span><input value={form.locationName} onChange={(event) => updateField('locationName', event.target.value)} /></label>
            <label className="form-field"><span>範圍起點</span><input value={form.rangeStart} onChange={(event) => updateField('rangeStart', event.target.value)} /></label>
            <label className="form-field"><span>範圍終點</span><input value={form.rangeEnd} onChange={(event) => updateField('rangeEnd', event.target.value)} /></label>
          </div>
          <label className="form-field"><span>顯示文字 *</span><input value={form.displayText} onChange={(event) => updateField('displayText', event.target.value)} required /></label>
          <label className="market-checkbox-filter"><input type="checkbox" checked={form.isDefault} onChange={(event) => updateField('isDefault', event.target.checked)} /><span>設為預設</span></label>
          {error && <p className="inline-error">{error}</p>}
          <div className="purchase-request-submit-row">
            {editingId != null && <button type="button" className="text-button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>取消編輯</button>}
            <button type="submit" className="create-button active" disabled={isSaving}>{isSaving ? '儲存中...' : '儲存範本'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PurchaseDeliveryProfilesModal;
