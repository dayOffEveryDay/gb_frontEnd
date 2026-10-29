import useSessionTask from '../useSessionTask';
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { CHAT_ROOM_PAGE_SIZE, buildOpenChatRooms, mapWithConcurrency, getNormalizedCampaignId, getCampaignChatAccess, canListCampaignChatRoom, normalizePurchaseChatRoom, getCombinedChatRoomSortTime, CHAT_ROOMS_LOAD_ERROR_MESSAGE } from '../../homeHelpers';
import { fetchMyHostedCampaigns, fetchMyJoinedCampaigns, fetchPurchaseChatRooms, fetchPurchaseChatUnreadCount, AUTH_EXPIRED_MESSAGE, fetchMyParticipation, markCampaignChatRead } from '../../api';
import { compareChatRooms } from '../../chatRoomSorting';

export default function useChatRooms({
  user,
  token,
  setAuthError,
  setIsLoginModalOpen,
  refreshKey,
  setParticipationCampaign,
  setSuccessToast,
  successToastTimerRef,
  setRefreshKey
}) {
  const beginSessionTask = useSessionTask(token);
  const loadRevision = useRef(0);
  const accountKey = token ? String(user?.id ?? '') : '';

  const [isChatRoomsOpen, setIsChatRoomsOpen] = useState(false);

  const [chatRooms, setChatRooms] = useState([]);

  const [purchaseChatUnreadTotal, setPurchaseChatUnreadTotal] = useState(0);

  const [chatRoomsError, setChatRoomsError] = useState('');

  const [isChatRoomsLoading, setIsChatRoomsLoading] = useState(false);

  const [chatCampaign, setChatCampaign] = useState(null);

  const [purchaseChatRoom, setPurchaseChatRoom] = useState(null);

  const [purchaseOrderFromChat, setPurchaseOrderFromChat] = useState(null);

  const chatReturnContextRef = useRef(null);

  const [chatStatusEvent, setChatStatusEvent] = useState(null);

  const chatCampaignRef = useRef(null);

  const purchaseChatRoomRef = useRef(null);


  const isChatFocusMode = isChatRoomsOpen || Boolean(chatCampaign) || Boolean(purchaseChatRoom);

  const chatUnreadRoomCount = useMemo(
    () =>
      purchaseChatUnreadTotal +
      chatRooms.reduce(
        (count, room) =>
          count + (room?.roomType !== 'PURCHASE' && Number(room?.unreadMessageCount ?? 0) > 0 ? 1 : 0),
        0
      ),
    [chatRooms, purchaseChatUnreadTotal]
  );


  useEffect(() => {
    chatCampaignRef.current = chatCampaign;
  }, [chatCampaign]);

  useEffect(() => {
    purchaseChatRoomRef.current = purchaseChatRoom;
  }, [purchaseChatRoom]);

  const readRevisions = useRef(new Map());
  const readResults = useRef(new Map());
  const markChatRoomAsRead = useCallback(async (campaignId, lastReadMessageId) => {
    if (!token || campaignId == null || lastReadMessageId == null) return;
    const isCurrent = beginSessionTask();
    const key = String(campaignId);
    const revision = (readRevisions.current.get(key) ?? 0) + 1;
    readRevisions.current.set(key, revision);
    const result = await markCampaignChatRead(campaignId, lastReadMessageId, token);
    if (!isCurrent() || readRevisions.current.get(key) !== revision) return;
    readResults.current.set(key, { unreadCount: result.unreadCount });
    setChatRooms(current => current.map(room =>
      room?.roomType !== 'PURCHASE' && String(room?.id ?? room?.campaignId) === key
        ? { ...room, unreadCount: result.unreadCount, unreadMessageCount: result.unreadCount }
        : room
    ));
  }, [token, beginSessionTask]);

  const loadOpenChatRooms = useCallback(async ({ silent = false } = {}) => {
    if (!token) {
      setChatRooms([]);
      setPurchaseChatUnreadTotal(0);
      setChatRoomsError('');
      setIsChatRoomsLoading(false);
      return;
    }

    const isSessionCurrent = beginSessionTask();
    const revision = ++loadRevision.current;
    const readsAtStart = new Map(readResults.current);
    const isCurrent = () => isSessionCurrent() && revision === loadRevision.current;
    if (!silent) {
      setIsChatRoomsLoading(true);
    }
    setChatRoomsError('');

    try {
      const query = { page: 0, size: CHAT_ROOM_PAGE_SIZE };
      const [hostedResult, joinedResult, purchaseResult, purchaseUnreadResult] = await Promise.allSettled([
        fetchMyHostedCampaigns(query, token),
        fetchMyJoinedCampaigns(query, token),
        fetchPurchaseChatRooms(token),
        fetchPurchaseChatUnreadCount(token),
      ]);
      if (!isCurrent()) return;
      const hostedData = hostedResult.status === 'fulfilled' ? hostedResult.value : [];
      const joinedData = joinedResult.status === 'fulfilled' ? joinedResult.value : [];
      const purchaseData = purchaseResult.status === 'fulfilled' ? purchaseResult.value : [];
      const purchaseUnreadData = purchaseUnreadResult.status === 'fulfilled' ? purchaseUnreadResult.value : null;
      const hasAuthExpired = [hostedResult, joinedResult, purchaseResult, purchaseUnreadResult].some(
        (result) => result.status === 'rejected' && result.reason?.message === AUTH_EXPIRED_MESSAGE
      );
      const hasSourceError =
        hostedResult.status === 'rejected' ||
        joinedResult.status === 'rejected' ||
        purchaseResult.status === 'rejected' ||
        purchaseUnreadResult.status === 'rejected';

      if (hasAuthExpired) {
        setChatRooms([]);
        setChatRoomsError(AUTH_EXPIRED_MESSAGE);
        setAuthError(AUTH_EXPIRED_MESSAGE);
        setIsLoginModalOpen(true);
        return;
      }

      const roomCandidates = buildOpenChatRooms(hostedData, joinedData);
      const accessResults = await mapWithConcurrency(roomCandidates, 4, async (room) => {
        const roomId = getNormalizedCampaignId(room);

        if (roomId == null) {
          return null;
        }

        try {
          const participation = await fetchMyParticipation(roomId, token);
          return {
            ...room,
            chatAccess: getCampaignChatAccess(participation),
          };
        } catch (error) {
          if (error?.message === AUTH_EXPIRED_MESSAGE) {
            throw error;
          }
          return null;
        }
      });
      if (!isCurrent()) return;
      const openRooms = accessResults.filter(Boolean).filter(canListCampaignChatRoom);
      const campaignRooms = openRooms.map(room => {
        const key = String(getNormalizedCampaignId(room));
        const completedRead = readResults.current.get(key);
        const unreadCount = completedRead && completedRead !== readsAtStart.get(key)
          ? completedRead.unreadCount : Number(room.unreadCount ?? 0);
        return { ...room, roomType: 'CAMPAIGN', unreadCount, unreadMessageCount: unreadCount };
      });
      const purchaseRooms = (Array.isArray(purchaseData) ? purchaseData : []).map(normalizePurchaseChatRoom);
      setPurchaseChatUnreadTotal(
        Number(
          purchaseUnreadData?.unreadCount ??
            purchaseRooms.reduce((count, room) => count + Number(room.unreadCount ?? 0), 0)
        ) || 0
      );
      setChatRooms(
        [...purchaseRooms, ...campaignRooms].sort(
          (first, second) => compareChatRooms(first, second, getCombinedChatRoomSortTime)
        )
      );
      if (!silent && hasSourceError) {
        setChatRoomsError(CHAT_ROOMS_LOAD_ERROR_MESSAGE);
      }
    } catch (error) {
      if (!isCurrent()) return;
      if (error?.message === AUTH_EXPIRED_MESSAGE) {
        setChatRooms([]);
        setChatRoomsError(AUTH_EXPIRED_MESSAGE);
        setAuthError(AUTH_EXPIRED_MESSAGE);
        setIsLoginModalOpen(true);
      } else if (!silent) {
        setChatRoomsError(CHAT_ROOMS_LOAD_ERROR_MESSAGE);
      }
    } finally {
      if (isCurrent()) {
        setIsChatRoomsLoading(false);
      }
    }
  }, [token, setAuthError, setIsLoginModalOpen, beginSessionTask]);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadOpenChatRooms({ silent: true });
  }, [loadOpenChatRooms, refreshKey, token]);

  // The purchase read endpoint returns 204, not a remaining count. Reconcile
  // with the server instead of clearing messages newer than the submitted ID.
  const markPurchaseRoomAsRead = useCallback(() => loadOpenChatRooms({ silent: true }), [loadOpenChatRooms]);

  useEffect(() => {
    if (!token) return undefined;
    let syncing = false;
    const sync = async () => {
      if (document.hidden || syncing) return;
      syncing = true;
      try { await loadOpenChatRooms({ silent: true }); }
      finally { syncing = false; }
    };
    const timer = window.setInterval(sync, 30000);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [token, loadOpenChatRooms]);

  const handleOpenChatRooms = () => {
    if (!token) {
      setIsLoginModalOpen(true);
      return;
    }

    setIsChatRoomsOpen(true);
    void loadOpenChatRooms();
  };

  useEffect(() => {
    readResults.current.clear();
    readRevisions.current.clear();
    setIsChatRoomsOpen(false);
    setChatCampaign(null);
    setPurchaseChatRoom(null);
    setPurchaseOrderFromChat(null);
    setChatRooms([]);
    setPurchaseChatUnreadTotal(0);
    setChatRoomsError('');
    setIsChatRoomsLoading(false);
    chatReturnContextRef.current = null;
  }, [accountKey]);

  const handleChatAccessRevoked = useCallback((payload) => {
    const revokedCampaignId = String(payload.campaignId);
    setChatRooms((current) =>
      current.filter(
        (room) =>
          room?.roomType === 'PURCHASE' || String(getNormalizedCampaignId(room)) !== revokedCampaignId
      )
    );
    setParticipationCampaign((current) =>
      current && String(getNormalizedCampaignId(current)) === revokedCampaignId
        ? { ...current, chatAccess: 'NONE' }
        : current
    );

    if (String(getNormalizedCampaignId(chatCampaignRef.current)) === revokedCampaignId) {
      chatReturnContextRef.current = null;
      setChatCampaign(null);
      setSuccessToast({
        title: '聊天室權限已移除',
        message: '你已退出或被移出這個團購，聊天室已關閉。',
      });
      if (successToastTimerRef.current) {
        window.clearTimeout(successToastTimerRef.current);
      }
      successToastTimerRef.current = window.setTimeout(() => {
        setSuccessToast(null);
        successToastTimerRef.current = null;
      }, 3600);
    }

    setRefreshKey((current) => current + 1);
  }, [setParticipationCampaign, setRefreshKey, setSuccessToast, successToastTimerRef]);

  return {
    isChatRoomsOpen,
    setIsChatRoomsOpen,
    chatRooms,
    chatRoomsError,
    setChatRoomsError,
    isChatRoomsLoading,
    chatCampaign,
    setChatCampaign,
    purchaseChatRoom,
    setPurchaseChatRoom,
    purchaseOrderFromChat,
    setPurchaseOrderFromChat,
    chatReturnContextRef,
    chatStatusEvent,
    setChatStatusEvent,
    purchaseChatRoomRef,
    isChatFocusMode,
    chatUnreadRoomCount,
    markChatRoomAsRead,
    markPurchaseRoomAsRead,
    loadOpenChatRooms,
    handleOpenChatRooms,
    handleChatAccessRevoked
  };
}
