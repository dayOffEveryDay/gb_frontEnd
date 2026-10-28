import { useCallback, useEffect } from 'react';
import { fetchCampaigns } from '../../api';
import { PAGE_SIZE } from '../../homeConfig';
import { mapCampaign } from '../../homeUtils';
import { canDisplayMarketCampaign, MARKET_HIDE_FULL_KEY } from '../../homeHelpers';
import useCampaignFeed from '../../components/campaign/useCampaignFeed';

export default function useCampaignsFeed({
  enabled,
  activeStoreIds,
  activeCategory,
  activeCampaignType,
  hideFullCampaigns,
  deferredSearch,
  refreshKey,
}) {
  useEffect(() => {
    localStorage.setItem(MARKET_HIDE_FULL_KEY, String(hideFullCampaigns));
  }, [hideFullCampaigns]);

  const fetchPage = useCallback(async (page, offset) => {
    const query = { page, size: PAGE_SIZE, categoryId: activeCategory || undefined, keyword: deferredSearch.trim() || undefined };
    const storeIds = activeStoreIds.map(Number).filter(Boolean);
    let data;
    if (storeIds.length <= 1) {
      data = await fetchCampaigns({ ...query, storeId: storeIds[0] || undefined });
    } else {
      const pages = await Promise.all(storeIds.map(storeId => fetchCampaigns({ ...query, storeId })));
      const seen = new Set();
      data = {
        content: pages.flatMap(result => Array.isArray(result?.content) ? result.content : []).filter(item => {
          const id = String(item?.id ?? item?.campaignId ?? item?.campaign_id ?? '');
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        }),
        last: pages.every(result => Boolean(result?.last)),
      };
    }
    return {
      items: Array.isArray(data?.content) ? data.content.map((item, index) => mapCampaign(item, offset + index))
        .filter(item => canDisplayMarketCampaign(item, activeCampaignType, hideFullCampaigns)) : [],
      hasMore: Boolean(data) && !data.last,
    };
  }, [activeStoreIds, activeCategory, activeCampaignType, hideFullCampaigns, deferredSearch]);

  const feed = useCampaignFeed({ enabled, fetchPage, refreshKey });
  const { loadCampaignPage } = feed;
  useEffect(() => {
    if (!enabled) return;
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void loadCampaignPage({ silent: true });
    };
    const interval = window.setInterval(refreshIfVisible, activeCampaignType === 'SCHEDULED' ? 60000 : 15000);
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
    };
  }, [activeCampaignType, enabled, loadCampaignPage]);
  return feed;
}
