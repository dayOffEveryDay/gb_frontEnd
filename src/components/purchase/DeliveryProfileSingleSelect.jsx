import { useState, useRef, useEffect } from 'react';
import {
  getDeliveryProfileChoiceLabel,
  getDeliveryProfileChoiceDetail,
  getDeliveryLabel,
} from './purchaseRequestUtils';

export default function DeliveryProfileSingleSelect({ profiles, deliveryMethod, selectedProfileIds, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedProfile = profiles.find((profile) =>
    selectedProfileIds.some((id) => String(id) === String(profile.id))
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedLabel = selectedProfile ? getDeliveryProfileChoiceLabel(selectedProfile, deliveryMethod) : '';
  const selectedDetail = selectedProfile ? getDeliveryProfileChoiceDetail(selectedProfile, deliveryMethod) : '';

  return (
    <div className="delivery-profile-combobox" ref={rootRef}>
      <button
        type="button"
        className={`delivery-profile-combobox-trigger${isOpen ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="delivery-profile-combobox-copy">
          <strong>{selectedLabel || `請選擇${getDeliveryLabel(deliveryMethod)}資料`}</strong>
          {selectedDetail && <small>{selectedDetail}</small>}
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
      </button>

      {isOpen && (
        <div className="delivery-profile-combobox-menu" role="listbox" aria-label={`選擇${getDeliveryLabel(deliveryMethod)}資料`}>
          {profiles.map((profile) => {
            const selected = selectedProfile && String(selectedProfile.id) === String(profile.id);
            const detail = getDeliveryProfileChoiceDetail(profile, deliveryMethod);
            return (
              <button
                key={profile.id}
                type="button"
                className={`delivery-profile-combobox-option${selected ? ' selected' : ''}`}
                role="option"
                aria-selected={Boolean(selected)}
                onClick={() => { onChange(profile.id); setIsOpen(false); }}
              >
                <span className="delivery-profile-combobox-copy">
                  <strong>{getDeliveryProfileChoiceLabel(profile, deliveryMethod)}</strong>
                  {detail && <small>{detail}</small>}
                </span>
                <span className="delivery-profile-combobox-check" aria-hidden="true">✓</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
