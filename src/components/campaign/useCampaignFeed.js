import { useCallback, useEffect, useRef, useState } from 'react';
import { getCampaignListSignature } from '../../homeHelpers';

// Each caller owns its cache. A new query or inactive page invalidates pending responses.
export default function useCampaignFeed({ enabled, fetchPage, refreshKey, resetKey }) {
  const [campaigns, setCampaigns] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [campaignError, setCampaignError] = useState('');
  const sentinelRef = useRef(null);
  const generation = useRef(0);
  const nextPage = useRef(1);
  const loadingMore = useRef(false);

  const loadCampaignPage = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) return;
    const request = ++generation.current;
    loadingMore.current = false;
    setIsLoadingMore(false);
    if (!silent) setIsInitialLoading(true);
    setCampaignError('');
    try {
      const result = await fetchPage(0, 0);
      if (request !== generation.current) return;
      setCampaigns(current => getCampaignListSignature(current) === getCampaignListSignature(result.items) ? current : result.items);
      nextPage.current = 1;
      setHasMore(result.hasMore);
    } catch (error) {
      if (request !== generation.current) return;
      setCampaignError(error.message);
      if (!silent) {
        setCampaigns([]);
        setHasMore(false);
      }
    } finally {
      if (request === generation.current) setIsInitialLoading(false);
    }
  }, [enabled, fetchPage]);

  const refreshCampaign = useCallback(async deal => {
    if (!enabled || !deal?.id) return deal;
    const request = generation.current;
    const { items } = await fetchPage(0, 0);
    if (request === generation.current) {
      setCampaigns(current => getCampaignListSignature(current) === getCampaignListSignature(items) ? current : items);
    }
    return items.find(campaign => Number(campaign.id) === Number(deal.id)) ?? deal;
  }, [enabled, fetchPage]);

  useEffect(() => {
    setCampaigns([]);
    setCampaignError('');
    setHasMore(false);
  }, [resetKey]);

  useEffect(() => {
    void loadCampaignPage();
    return () => { generation.current += 1; };
  }, [loadCampaignPage, refreshKey]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!enabled || !node || !hasMore || isInitialLoading) return;
    const observer = new IntersectionObserver(async entries => {
      if (!entries[0]?.isIntersecting || loadingMore.current) return;
      const request = generation.current;
      loadingMore.current = true;
      setIsLoadingMore(true);
      try {
        const result = await fetchPage(nextPage.current, campaigns.length);
        if (request !== generation.current) return;
        setCampaigns(current => [...current, ...result.items]);
        nextPage.current += 1;
        setHasMore(result.hasMore);
      } catch (error) {
        if (request !== generation.current) return;
        setCampaignError(error.message);
        setHasMore(false);
      } finally {
        if (request === generation.current) {
          loadingMore.current = false;
          setIsLoadingMore(false);
        }
      }
    }, { rootMargin: '200px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [campaigns.length, enabled, fetchPage, hasMore, isInitialLoading]);

  return { campaigns, setCampaigns, campaignError, setCampaignError, hasMore,
    isInitialLoading: enabled && isInitialLoading, isLoadingMore: enabled && isLoadingMore,
    sentinelRef, loadCampaignPage, refreshCampaign };
}
