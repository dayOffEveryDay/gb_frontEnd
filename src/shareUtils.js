import { getBackendBaseUrl } from './api';

function buildShareUrl(path) {
  return new URL(path, getBackendBaseUrl()).toString();
}

export function getCampaignShareUrl(campaignId) {
  return buildShareUrl(`/share/campaigns/${encodeURIComponent(campaignId)}`);
}

export function getPurchaseRequestShareUrl(purchaseRequestId) {
  return buildShareUrl(`/share/purchase-requests/${encodeURIComponent(purchaseRequestId)}`);
}

function openLineShare(url) {
  const lineShareUrl = new URL('https://social-plugins.line.me/lineit/share');
  lineShareUrl.searchParams.set('url', url);
  window.open(lineShareUrl.toString(), '_blank', 'noopener,noreferrer');
}

export async function shareToLine({ title, text, url }) {
  if (typeof navigator.share !== 'function') {
    openLineShare(url);
    return;
  }

  try {
    await navigator.share({ title, text, url });
  } catch (error) {
    if (error?.name !== 'AbortError') {
      openLineShare(url);
    }
  }
}

export function shareCampaign(campaign) {
  const campaignId = campaign?.id ?? campaign?.campaignId ?? campaign?.campaign_id;
  if (campaignId == null) {
    return Promise.resolve();
  }

  const itemName = campaign?.itemName ?? campaign?.item_name ?? '團購商品';
  return shareToLine({
    title: `${itemName}｜團購分享`,
    text: `一起看看這個團購：${itemName}`,
    url: getCampaignShareUrl(campaignId),
  });
}

export function sharePurchaseRequest(request) {
  const requestId = request?.id ?? request?.purchaseRequestId ?? request?.purchase_request_id;
  if (requestId == null) {
    return Promise.resolve();
  }

  const itemName = request?.productName ?? request?.itemName ?? request?.item_name ?? '託購商品';
  return shareToLine({
    title: `${itemName}｜託購分享`,
    text: `一起看看這個託購需求：${itemName}`,
    url: getPurchaseRequestShareUrl(requestId),
  });
}
