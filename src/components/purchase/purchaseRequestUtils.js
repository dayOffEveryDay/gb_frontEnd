export const DELIVERY_LABELS = {
  FACE_TO_FACE: '面交',
  STORE_TO_STORE: '店到店',
  HOME_DELIVERY: '宅配',
  IBOX: 'i郵箱',
};

export const STATUS_LABELS = {
  OPEN: '開放中',
  QUOTING: '報價中',
  ORDERED: '已成立',
  AWAITING_REOPEN: '待重新開放',
  ASSIGNED: '已指派',
  DELIVERED: '已交付',
  CANCELLED: '已取消',
  EXPIRED: '已過期',
  FAILED: '失敗',
  WAITING_CONFIRMATION: '等待確認',
  CONFIRMED: '已確認',
  IN_PROGRESS: '處理中',
  SHIPPED: '已寄出',
  DELIVERED_PENDING_CONFIRM: '待委託人確認',
  COMPLETED: '已完成',
  UNAVAILABLE_CANCELLED: '缺貨取消',
  ABNORMAL_PENDING_RESPONSE: '異常待回應',
  PENALIZED_CANCELLED: '有責取消',
  DISPUTE_CLOSED_NO_PENALTY: '異常已結案',
  PENDING: '待處理',
  ACTIVE: '有效報價',
  WITHDRAWN: '已撤回',
  SELECTED: '已選定',
  NOT_SELECTED: '未選定',
};

export function getStatusLabel(status) {
  const key = (status ?? '').toString().toUpperCase();
  return STATUS_LABELS[key] ?? status ?? '--';
}

export function getDeliveryLabel(deliveryMethod) {
  const key = (deliveryMethod ?? '').toString().toUpperCase();
  return DELIVERY_LABELS[key] ?? deliveryMethod ?? '--';
}

export function getHomeDeliveryFullAddress(profile) {
  const city = profile.city ?? '';
  const district = profile.district ?? '';
  const region = `${city}${district}`.trim();
  const savedAddress = (profile.address ?? '').trim();
  return savedAddress.startsWith(region) ? savedAddress : `${region}${savedAddress}`;
}

export function getDeliveryProfileChoiceLabel(profile, deliveryMethod) {
  const label = profile.label || profile.locationName || profile.address || getDeliveryLabel(profile.profileType);
  if (!['STORE_TO_STORE', 'IBOX'].includes(deliveryMethod) || !profile.provider || profile.provider === label) return label;
  return `${profile.provider} · ${label}`;
}

export function getDeliveryProfileChoiceDetail(profile, deliveryMethod) {
  if (deliveryMethod === 'HOME_DELIVERY') return getHomeDeliveryFullAddress(profile);
  const location = [profile.city, profile.district, profile.locationName].filter(Boolean).join('');
  const code = profile.locationCode ? `代碼 ${profile.locationCode}` : '';
  return [location, code].filter(Boolean).join(' · ');
}

export function isSameUser(a, b) {
  return a != null && b != null && String(a) === String(b);
}

export function getRewardLabel(request) {
  if (request.rewardType === 'QUOTE') {
    return `${request.quoteCount} 人報價`;
  }

  return `NT$ ${request.fixedRewardAmount ?? 0}`;
}

export function getBlockedLabel(reason) {
  if (reason === 'LOGIN_REQUIRED') {
    return '登入後可操作';
  }
  if (reason === 'IS_REQUESTER') {
    return '自己的委託';
  }
  if (reason === 'CREDIT_SCORE_TOO_LOW') {
    return '信用分不足';
  }
  return '';
}
