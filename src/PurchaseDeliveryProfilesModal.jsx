import { useCallback, useEffect, useState } from 'react';
import {
  createUserDeliveryProfile,
  deleteUserDeliveryProfile,
  fetchUserDeliveryProfiles,
  updateUserDeliveryProfile,
} from './api';
import ActionDialog from './ActionDialog';

const EMPTY_FORM = {
  profileType: 'FACE_TO_FACE',
  label: '',
  city: '',
  district: '',
  locationName: '',
  locationCode: '',
  provider: '',
  address: '',
  recipientName: '',
  recipientPhone: '',
  isDefault: false,
};

const PROFILE_TYPE_LABELS = {
  FACE_TO_FACE: '面交',
  HOME_DELIVERY: '宅配',
  STORE_TO_STORE: '店到店',
  IBOX: 'i郵箱',
};

const STORE_TO_STORE_PROVIDERS = ['7-ELEVEN', '全家便利商店', '萊爾富', 'OK超商'];

function getNextHomeDeliveryLabel(profiles) {
  const largestIndex = profiles
    .filter((profile) => profile.profileType === 'HOME_DELIVERY')
    .reduce((largest, profile) => {
      const match = /^地址(\d+)$/.exec((profile.label ?? '').trim());
      return match ? Math.max(largest, Number(match[1])) : largest;
    }, 0);
  return `地址${largestIndex + 1}`;
}

function getAddressPrefix(city, district) {
  return `${city ?? ''}${district ?? ''}`.trim();
}

function getProfileTypeLabel(profileType) {
  const key = (profileType ?? '').toString().toUpperCase();
  return PROFILE_TYPE_LABELS[key] ?? profileType ?? '--';
}

function toForm(profile) {
  if (!profile) return EMPTY_FORM;
  return {
    profileType: profile.profileType ?? 'FACE_TO_FACE',
    label: profile.label ?? '',
    city: profile.city ?? '',
    district: profile.district ?? '',
    locationName: profile.locationName ?? '',
    locationCode: profile.locationCode ?? '',
    provider: profile.provider ?? '',
    address: profile.address ?? '',
    recipientName: profile.recipientName ?? '',
    recipientPhone: profile.recipientPhone ?? '',
    isDefault: Boolean(profile.isDefault),
  };
}

function PurchaseDeliveryProfilesModal({ isOpen, token, initialProfileType = 'FACE_TO_FACE', onChanged, onClose }) {
  const [profiles, setProfiles] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

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
      setForm({
        ...EMPTY_FORM,
        profileType: initialProfileType,
        label: initialProfileType === 'HOME_DELIVERY' ? '地址1' : '',
      });
      void loadProfiles();
    }
  }, [initialProfileType, isOpen, loadProfiles]);

  useEffect(() => {
    if (editingId !== null || form.profileType !== 'HOME_DELIVERY' || !/^地址\d+$/.test(form.label)) return;
    const nextLabel = getNextHomeDeliveryLabel(profiles);
    if (nextLabel !== form.label) setForm((current) => ({ ...current, label: nextLabel }));
  }, [editingId, form.label, form.profileType, profiles]);

  if (!isOpen) return null;
  const updateField = (key, value) => setForm((current) => {
    if (key === 'profileType') {
      return {
        ...current,
        profileType: value,
        label: value === 'HOME_DELIVERY' ? getNextHomeDeliveryLabel(profiles) : '',
        city: '',
        district: '',
        locationName: '',
        locationCode: '',
        provider: '',
        address: '',
        recipientName: '',
        recipientPhone: '',
      };
    }

    if (['city', 'district'].includes(key) && current.profileType === 'HOME_DELIVERY') {
      const previousPrefix = getAddressPrefix(current.city, current.district);
      const nextCity = key === 'city' ? value : current.city;
      const nextDistrict = key === 'district' ? value : current.district;
      const nextPrefix = getAddressPrefix(nextCity, nextDistrict);
      const addressWithoutPreviousPrefix = previousPrefix && current.address.startsWith(previousPrefix)
        ? current.address.slice(previousPrefix.length)
        : current.address;
      return {
        ...current,
        [key]: value,
        address: `${nextPrefix}${addressWithoutPreviousPrefix}`,
      };
    }

    if (key === 'locationName' && ['FACE_TO_FACE', 'STORE_TO_STORE', 'IBOX'].includes(current.profileType)) {
      return { ...current, locationName: value, label: value };
    }

    return { ...current, [key]: value };
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.label.trim()) {
      setError('範本名稱必填');
      return;
    }
    setIsSaving(true);
    setError('');
    const payload = {
      profileType: form.profileType,
      label: form.label.trim(),
      city: form.city.trim() || undefined,
      district: form.district.trim() || undefined,
      locationName: form.locationName.trim() || undefined,
      locationCode: form.locationCode.trim() || undefined,
      provider: form.provider.trim() || undefined,
      address: form.address.trim() || undefined,
      recipientName: form.recipientName.trim() || undefined,
      recipientPhone: form.recipientPhone.trim() || undefined,
      isDefault: form.isDefault,
    };
    try {
      if (editingId == null) {
        await createUserDeliveryProfile(payload, token);
      } else {
        await updateUserDeliveryProfile(editingId, payload, token);
      }
      setEditingId(null);
      setForm({ ...EMPTY_FORM, profileType: initialProfileType });
      await loadProfiles();
      onChanged?.();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '常用交付資料儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    setError('');
    try {
      await deleteUserDeliveryProfile(deleteTarget.id, token);
      await loadProfiles();
      onChanged?.();
      setDeleteTarget(null);
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
            <h2 className="modal-title">我的地址</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>關閉</button>
        </div>

        <div className="delivery-profile-list">
          {isLoading && <p className="muted-copy">載入中...</p>}
          {!isLoading && profiles.length === 0 && <p className="muted-copy">尚未建立常用交付資料。</p>}
          {profiles.map((profile) => (
            <article key={profile.id} className="delivery-profile-row">
              <div>
                <strong>{profile.label || getProfileTypeLabel(profile.profileType)}</strong>
                <span>{getProfileTypeLabel(profile.profileType)} · {[profile.city, profile.district, profile.locationName || profile.address].filter(Boolean).join(' ') || profile.provider || '尚未填寫地點'}</span>
              </div>
              <div className="delivery-profile-row-actions">
                <button
                  type="button"
                  className="delivery-profile-icon-button"
                  title="編輯"
                  aria-label={`編輯${profile.label || getProfileTypeLabel(profile.profileType)}`}
                  onClick={() => { setEditingId(profile.id); setForm(toForm(profile)); }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.95 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.58 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.95a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.58 1.7 1.7 0 0 0 10 3h4a1.7 1.7 0 0 0 1.05 1.58 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.42 9 1.7 1.7 0 0 0 21 10v4a1.7 1.7 0 0 0-1.6 1Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="delivery-profile-icon-button danger"
                  title="刪除"
                  aria-label={`刪除${profile.label || getProfileTypeLabel(profile.profileType)}`}
                  onClick={() => setDeleteTarget(profile)}
                  disabled={isSaving}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m4 4v7m6-7v7" />
                  </svg>
                </button>
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
            {form.profileType === 'HOME_DELIVERY' && <label className="form-field"><span>範本名稱 *</span><input value={form.label} onChange={(event) => updateField('label', event.target.value)} placeholder="例如：地址1" required /></label>}
            <label className="form-field"><span>縣市</span><input value={form.city} onChange={(event) => updateField('city', event.target.value)} placeholder="例如：台北市" /></label>
            <label className="form-field"><span>區域</span><input value={form.district} onChange={(event) => updateField('district', event.target.value)} placeholder="例如：中山區" /></label>
            {form.profileType === 'FACE_TO_FACE' && <label className="form-field"><span>面交地點 *</span><input value={form.locationName} onChange={(event) => updateField('locationName', event.target.value)} placeholder="例如：台北車站東一門" required /></label>}
            {form.profileType === 'HOME_DELIVERY' && <label className="form-field"><span>宅配地址</span><input value={form.address} onChange={(event) => updateField('address', event.target.value)} placeholder="例如：台北市中山區南京東路三段 1 號" /></label>}
            {form.profileType === 'STORE_TO_STORE' && (
              <label className="form-field">
                <span>物流／據點業者</span>
                <select value={form.provider} onChange={(event) => updateField('provider', event.target.value)}>
                  <option value="">請選擇超商</option>
                  {STORE_TO_STORE_PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                </select>
              </label>
            )}
            {form.profileType === 'IBOX' && <label className="form-field"><span>物流／據點業者</span><input value={form.provider} onChange={(event) => updateField('provider', event.target.value)} placeholder="例如：中華郵政 i郵箱" /></label>}
            {['STORE_TO_STORE', 'IBOX'].includes(form.profileType) && <label className="form-field"><span>門市／據點代碼</span><input value={form.locationCode} onChange={(event) => updateField('locationCode', event.target.value)} placeholder="例如：123456" /></label>}
            {['STORE_TO_STORE', 'IBOX'].includes(form.profileType) && <label className="form-field"><span>門市／據點名稱 *</span><input value={form.locationName} onChange={(event) => updateField('locationName', event.target.value)} placeholder="例如：台北站前門市" required /></label>}
            {form.profileType !== 'FACE_TO_FACE' && <label className="form-field"><span>收件人</span><input value={form.recipientName} onChange={(event) => updateField('recipientName', event.target.value)} placeholder="例如：王小明" /></label>}
            {form.profileType !== 'FACE_TO_FACE' && <label className="form-field"><span>收件電話</span><input type="tel" value={form.recipientPhone} onChange={(event) => updateField('recipientPhone', event.target.value)} placeholder="例如：0912-345-678" /></label>}
          </div>
          <label className="market-checkbox-filter"><input type="checkbox" checked={form.isDefault} onChange={(event) => updateField('isDefault', event.target.checked)} /><span>設為預設</span></label>
          {error && <p className="inline-error">{error}</p>}
          <div className="purchase-request-submit-row">
            {editingId != null && <button type="button" className="text-button" onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM, profileType: initialProfileType }); }}>取消編輯</button>}
            <button type="submit" className="create-button active" disabled={isSaving}>{isSaving ? '儲存中...' : '儲存範本'}</button>
          </div>
        </form>
        <ActionDialog
          isOpen={Boolean(deleteTarget)}
          eyebrow="常用交付資料"
          title="刪除交付範本"
          description={`確定刪除「${deleteTarget?.label || getProfileTypeLabel(deleteTarget?.profileType)}」？`}
          confirmLabel="確認刪除"
          confirmClassName="ghost-button danger"
          isSubmitting={isSaving}
          onClose={() => !isSaving && setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      </div>
    </div>
  );
}

export default PurchaseDeliveryProfilesModal;
