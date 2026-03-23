import { EXPIRE_PRESET_OPTIONS, LABELS } from './homeConfig';
import { getBackendBaseUrl } from './api';

export function createFallbackImage(label, hue) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hue}, 82%, 82%)"/>
          <stop offset="100%" stop-color="hsl(${(hue + 42) % 360}, 72%, 58%)"/>
        </linearGradient>
      </defs>
      <rect width="400" height="280" rx="28" fill="url(#g)"/>
      <circle cx="316" cy="66" r="54" fill="rgba(255,255,255,0.18)"/>
      <circle cx="72" cy="220" r="72" fill="rgba(255,255,255,0.14)"/>
      <text x="32" y="146" fill="#ffffff" font-size="34" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function parseLocalDateTime(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const matched = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?(Z)?$/
  );

  if (matched) {
    const [, year, month, day, hour, minute, second = '00', millisecond = '0', zuluFlag] = matched;

    if (zuluFlag === 'Z') {
      return new Date(normalized);
    }

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(millisecond.padEnd(3, '0'))
    );
  }

  const fallbackDate = new Date(normalized);
  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

export function formatCountdown(value, now = Date.now()) {
  const targetDate = parseLocalDateTime(value);
  if (!targetDate) {
    return '--';
  }

  const diff = targetDate.getTime() - now;
  if (diff <= 0) {
    return '已截止';
  }

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}時${minutes}分${seconds}秒`;
  }

  return `${minutes}分${seconds}秒`;
}

export function resolveCampaignImageUrl(campaign) {
  const candidate =
    campaign.imageUrls?.[0] ??
    campaign.image_urls?.[0] ??
    campaign.itemImageUrl ??
    campaign.item_image_url ??
    '';

  if (!candidate) {
    return '';
  }

  if (candidate.startsWith('http://') || candidate.startsWith('https://') || candidate.startsWith('data:')) {
    return candidate;
  }

  const normalizedPath = candidate.startsWith('/') ? candidate : `/${candidate}`;
  return new URL(normalizedPath, `${getBackendBaseUrl()}/`).toString();
}

export function getScenarioLabel(type) {
  if (type === 'INSTANT') {
    return LABELS.instant;
  }

  if (type === 'SCHEDULED') {
    return LABELS.preorder;
  }

  return LABELS.preorder;
}

export function getTypeClass(type) {
  if (type === 'INSTANT') {
    return 'instant';
  }

  if (type === 'SCHEDULED') {
    return 'preorder';
  }

  return 'closed';
}

export function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id ?? null,
    displayName: user.displayName ?? '未命名使用者',
    profileImageUrl: user.profileImageUrl ?? user.profile_image_url ?? '',
    hasCostcoMembership: Boolean(user.hasCostcoMembership ?? user.has_costco_membership),
  };
}

export function normalizeHost(host) {
  if (!host) {
    return null;
  }

  return {
    ...host,
    displayName: host.displayName ?? host.display_name ?? LABELS.noValue,
    profileImageUrl: host.profileImageUrl ?? host.profile_image_url ?? '',
    creditScore: host.creditScore ?? host.credit_score ?? LABELS.noValue,
  };
}

export function mapCampaign(campaign, index) {
  return {
    ...campaign,
    scenarioType: campaign.scenarioType ?? campaign.scenario_type ?? 'SCHEDULED',
    itemName: campaign.itemName ?? campaign.item_name ?? '團購',
    availableQuantity:
      campaign.availableQuantity ?? campaign.available_quantity ?? campaign.totalQuantity ?? campaign.total_quantity ?? 0,
    pricePerUnit: campaign.pricePerUnit ?? campaign.price_per_unit ?? 0,
    storeName: campaign.storeName ?? campaign.store_name ?? LABELS.noValue,
    categoryName: campaign.categoryName ?? campaign.category_name ?? LABELS.noValue,
    meetupLocation: campaign.meetupLocation ?? campaign.meetup_location ?? '',
    meetupTime: campaign.meetupTime ?? campaign.meetup_time ?? '',
    expireTime: campaign.expireTime ?? campaign.expire_time ?? '',
    host: normalizeHost(campaign.host),
    image: resolveCampaignImageUrl(campaign) || createFallbackImage(campaign.itemName ?? '團購', 18 + index * 19),
  };
}

export function formatLocalInputValue(value) {
  const pad = (part) => String(part).padStart(2, '0');
  return [
    value.getFullYear(),
    '-',
    pad(value.getMonth() + 1),
    '-',
    pad(value.getDate()),
    'T',
    pad(value.getHours()),
    ':',
    pad(value.getMinutes()),
  ].join('');
}

export function getInitialCampaignForm() {
  const now = new Date();
  const meetup = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const expire = new Date(now.getTime() + 10 * 60 * 1000);

  return {
    storeId: '',
    categoryId: '',
    scenarioType: 'SCHEDULED',
    itemName: '',
    images: [],
    pricePerUnit: '',
    totalQuantity: '',
    meetupLocation: '',
    expirePreset: '10m',
    expireTime: formatLocalInputValue(expire),
    meetupTime: formatLocalInputValue(meetup),
  };
}

export function formatLocalDateTime(value) {
  const pad = (part) => String(part).padStart(2, '0');
  return [
    value.getFullYear(),
    '-',
    pad(value.getMonth() + 1),
    '-',
    pad(value.getDate()),
    'T',
    pad(value.getHours()),
    ':',
    pad(value.getMinutes()),
    ':',
    pad(value.getSeconds()),
  ].join('');
}

export function resolveExpireTime(form) {
  const preset = EXPIRE_PRESET_OPTIONS.find((option) => option.value === form.expirePreset);
  if (preset?.minutes) {
    return formatLocalDateTime(new Date(Date.now() + preset.minutes * 60 * 1000));
  }

  if (!form.expireTime) {
    return '';
  }

  const customDate = new Date(form.expireTime);
  return Number.isNaN(customDate.getTime()) ? '' : formatLocalDateTime(customDate);
}

export function formatDateTime(value) {
  const date = parseLocalDateTime(value);
  if (!date) {
    return '--';
  }

  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
