import { useCallback, useEffect } from 'react';
import { fetchMyHostedCampaigns, fetchMyJoinedCampaigns } from '../../api';
import { LABELS, PAGE_SIZE } from '../../homeConfig';
import { attachCampaignChatAccess, buildMineCampaigns } from '../../homeHelpers';
import useCampaignFeed from '../../components/campaign/useCampaignFeed';

export default function useMineCampaigns({
  enabled,
  token,
  activeMyCampaignScope,
  activeMyCampaignFilter,
  refreshKey,
  focusedCampaignId,
  setFocusedCampaignId,
}) {
  const fetchPage = useCallback(async () => {
    if (!token) throw new Error(LABELS.loginRequiredForMine);
    const query = { page: 0, size: PAGE_SIZE };
    const [hosted, joined] = await Promise.all([
      fetchMyHostedCampaigns(query, token), fetchMyJoinedCampaigns(query, token),
    ]);
    const items = await attachCampaignChatAccess(buildMineCampaigns(hosted, joined, activeMyCampaignScope, activeMyCampaignFilter), token);
    return { items, hasMore: false };
  }, [activeMyCampaignFilter, activeMyCampaignScope, token]);
  const feed = useCampaignFeed({ enabled, fetchPage, refreshKey, resetKey: token });

  const { refreshCampaign } = feed;
  const refreshMineCampaignsBeforeOpen = useCallback(deal => {
    if (!token) return Promise.resolve(deal);
    return refreshCampaign(deal);
  }, [refreshCampaign, token]);

  const { campaigns, isInitialLoading } = feed;
  useEffect(() => {
    if (!enabled || !focusedCampaignId || isInitialLoading) return;
    const node = document.getElementById(`deal-card-${focusedCampaignId}`);
    if (!node) return;
    const scrollTimer = window.setTimeout(() => node.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    const clearTimer = window.setTimeout(() => setFocusedCampaignId(''), 2200);
    return () => { window.clearTimeout(scrollTimer); window.clearTimeout(clearTimer); };
  }, [campaigns, enabled, focusedCampaignId, isInitialLoading, setFocusedCampaignId]);
  return { ...feed, refreshMineCampaignsBeforeOpen };
}
