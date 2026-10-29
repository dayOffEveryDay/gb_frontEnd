import useSessionTask from '../useSessionTask';
import { fetchPurchaseChatRooms, fetchMyParticipation } from '../../api';
import { CHAT_ROOM_UNAVAILABLE_MESSAGE, normalizePurchaseChatRoom, hasUsableCampaignId, getNormalizedCampaignId, getCampaignChatAccess, canOpenCampaignChat } from '../../homeHelpers';

export default function useChatNavigation({
  setChatRoomsError,
  token,
  hidePurchaseChatNotifications,
  chatReturnContextRef,
  setPurchaseChatRoom,
  setIsChatRoomsOpen,
  setIsLoginModalOpen,
  showSuccessToast,
  chatRooms,
  user,
  setCampaignError,
  refreshMineCampaignsBeforeOpen,
  markCampaignChatNotificationsAsRead,
  setChatCampaign,
  handleOpenParticipation,
  participationCampaign,
  setParticipationCampaign,
  setParticipationQuantityDraft,
  setParticipationError,
  setIsNotificationsOpen,
  loadOpenChatRooms,
  setPurchaseOrderFromChat,
  purchaseOrderFromChat
}) {
  const beginSessionTask = useSessionTask(token);
  const handleOpenChatRoom = async (room) => {
    const isCurrent = beginSessionTask();
    setChatRoomsError('');

    if (room?.roomType === 'PURCHASE') {
      try {
        hidePurchaseChatNotifications(room.orderId);
        chatReturnContextRef.current = { type: 'CHAT_ROOMS' };
        setPurchaseChatRoom(room);
        setIsChatRoomsOpen(false);
      } catch (error) {
        if (!isCurrent()) return false;
        setChatRoomsError(error instanceof Error ? error.message : '託購聊天室開啟失敗');
      }
      return;
    }

    const opened = await handleOpenChat(room, {
      showError: false,
      returnContext: { type: 'CHAT_ROOMS' },
    });
    if (!isCurrent()) return false;
    if (opened) {
      setIsChatRoomsOpen(false);
      return;
    }

    setChatRoomsError(CHAT_ROOM_UNAVAILABLE_MESSAGE);
  };

  const handleOpenPurchaseChat = async (source, { returnContext = null } = {}) => {
    const isCurrent = beginSessionTask();
    if (!token) {
      setIsLoginModalOpen(true);
      return false;
    }

    const sourceRoomId = source?.roomType === 'PURCHASE' ? source?.id : source?.chatRoomId;
    const sourceOrderId = source?.orderId;
    if (sourceRoomId == null && sourceOrderId == null) {
      showSuccessToast('聊天室尚未建立', '訂單成立後才會建立託購聊天室。');
      return false;
    }

    try {
      let matchedRoom = chatRooms.find(
        (room) =>
          room?.roomType === 'PURCHASE' &&
          ((sourceRoomId != null && String(room.id) === String(sourceRoomId)) ||
            (sourceOrderId != null && String(room.orderId) === String(sourceOrderId)))
      );

      if (!matchedRoom) {
        const rooms = await fetchPurchaseChatRooms(token);
        if (!isCurrent()) return false;
        const normalizedRooms = (Array.isArray(rooms) ? rooms : []).map(normalizePurchaseChatRoom);
        matchedRoom = normalizedRooms.find(
          (room) =>
            (sourceRoomId != null && String(room.id) === String(sourceRoomId)) ||
            (sourceOrderId != null && String(room.orderId) === String(sourceOrderId))
        );
      }

      const fallbackRoom = {
        ...source,
        roomType: 'PURCHASE',
        id: sourceRoomId,
        orderId: sourceOrderId,
        itemName: source?.itemName ?? source?.productName,
        counterpartName:
          source?.counterpartName ??
          (String(source?.requester?.id ?? source?.requesterId) === String(user?.id)
            ? source?.runner?.displayName ?? source?.runnerDisplayName
            : source?.requester?.displayName ?? source?.requesterDisplayName),
      };
      const nextRoom = matchedRoom ?? fallbackRoom;
      if (nextRoom.id == null) {
        showSuccessToast('聊天室開啟失敗', '找不到這筆託購聊天室資料。');
        return false;
      }

      hidePurchaseChatNotifications(nextRoom.orderId);
      chatReturnContextRef.current = returnContext;
      setPurchaseChatRoom(nextRoom);
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      showSuccessToast('聊天室開啟失敗', error instanceof Error ? error.message : '請稍後再試。');
      return false;
    }
  };

  const handleOpenChat = async (deal, { showError = true, returnContext = null } = {}) => {
    const isCurrent = beginSessionTask();
    if (!token) {
      setIsLoginModalOpen(true);
      return false;
    }

    if (!hasUsableCampaignId(deal)) {
      if (showError) {
        setCampaignError(CHAT_ROOM_UNAVAILABLE_MESSAGE);
      }
      return false;
    }

    let nextDeal = deal;
    try {
      nextDeal = await refreshMineCampaignsBeforeOpen(deal);
      if (!isCurrent()) return false;
      const participation = await fetchMyParticipation(getNormalizedCampaignId(nextDeal), token);
      if (!isCurrent()) return false;
      nextDeal = {
        ...nextDeal,
        chatAccess: getCampaignChatAccess(participation),
      };
    } catch (error) {
      if (!isCurrent()) return false;
      if (showError) {
        setCampaignError(error instanceof Error ? error.message : '無法確認聊天室權限');
      }
      return false;
    }

    if (!canOpenCampaignChat(nextDeal)) {
      if (showError) {
        setCampaignError(CHAT_ROOM_UNAVAILABLE_MESSAGE);
      }
      return false;
    }

    const campaignId = getNormalizedCampaignId(nextDeal);

    await markCampaignChatNotificationsAsRead(campaignId);
    if (!isCurrent()) return false;
    chatReturnContextRef.current = returnContext;
    setChatCampaign(nextDeal);
    return true;
  };

  const handleOpenParticipationFromChat = async (deal) => {
    const isCurrent = beginSessionTask();
    await handleOpenParticipation(deal);
    if (!isCurrent()) return false;
    chatReturnContextRef.current = null;
    setChatCampaign(null);
  };

  const handleOpenChatFromParticipation = async (deal) => {
    const isCurrent = beginSessionTask();
    const returnCampaign = participationCampaign ?? deal;
    const opened = await handleOpenChat(deal, {
      returnContext: { type: 'PARTICIPATION', campaign: returnCampaign },
    });
    if (!isCurrent()) return false;

    if (opened) {
      setParticipationCampaign(null);
      setParticipationQuantityDraft('1');
      setParticipationError('');
    }
  };

  const restoreChatReturnContext = () => {
    const returnContext = chatReturnContextRef.current;
    chatReturnContextRef.current = null;

    if (returnContext?.type === 'NOTIFICATIONS') {
      setIsNotificationsOpen(true);
      return;
    }

    if (returnContext?.type === 'CHAT_ROOMS') {
      setIsChatRoomsOpen(true);
      void loadOpenChatRooms();
      return;
    }

    if (returnContext?.type === 'PARTICIPATION' && returnContext.campaign) {
      setParticipationCampaign(returnContext.campaign);
      setParticipationQuantityDraft(
        String(returnContext.campaign.hostReservedQuantity ?? returnContext.campaign.quantity ?? 1)
      );
      setParticipationError('');
      return;
    }

    returnContext?.restore?.();
  };

  const handleCloseCampaignChat = () => {
    setChatCampaign(null);
    restoreChatReturnContext();
  };

  const handleClosePurchaseChat = () => {
    setPurchaseChatRoom(null);
    setPurchaseOrderFromChat(null);
    restoreChatReturnContext();
  };

  const handleOpenOrderFromChat = (order) => {
    setPurchaseOrderFromChat({ ...order, openedFromChat: true });
  };

  const handleOpenChatFromOrder = async (order) => {
    const isCurrent = beginSessionTask();
    if (purchaseOrderFromChat?.openedFromChat) {
      setPurchaseOrderFromChat(null);
      return;
    }
    const returnToNotifications = Boolean(purchaseOrderFromChat?.returnToNotifications);
    const opened = await handleOpenPurchaseChat(
      { ...order, orderId: order?.id ?? purchaseOrderFromChat?.orderId },
      { returnContext: returnToNotifications ? { type: 'NOTIFICATIONS' } : null }
    );
    if (isCurrent() && opened) setPurchaseOrderFromChat(null);
  };

  const handleClosePurchaseOrder = () => {
    const returnToNotifications = Boolean(purchaseOrderFromChat?.returnToNotifications);
    setPurchaseOrderFromChat(null);
    if (returnToNotifications) setIsNotificationsOpen(true);
  };

  return {
    handleOpenChatRoom,
    handleOpenPurchaseChat,
    handleOpenChat,
    handleOpenParticipationFromChat,
    handleOpenChatFromParticipation,
    handleCloseCampaignChat,
    handleClosePurchaseChat,
    handleOpenOrderFromChat,
    handleOpenChatFromOrder,
    handleClosePurchaseOrder
  };
}
