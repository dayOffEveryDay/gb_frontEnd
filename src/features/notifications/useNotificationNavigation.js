import useSessionTask from '../useSessionTask';
import { isFullCampaignNotification, isReviewCampaignNotification, isPurchaseChatNotification, isPurchaseOrderNotification, isInquiryNotification, getCampaignDisplayName, buildHostParticipationCampaign, canOpenCampaignChat, getLiveNotificationKey } from '../../homeHelpers';
import { fetchHostDashboard } from '../../api';

export default function useNotificationNavigation({
  token,
  markNotificationAsRead,
  setIsNotificationsOpen,
  setInquiryTargetId,
  switchActiveType,
  handleOpenPurchaseChat,
  setPurchaseOrderFromChat,
  findCampaignForNotification,
  setNotificationsError,
  setParticipationCampaign,
  setParticipationQuantityDraft,
  handleOpenReview,
  handleOpenParticipation,
  markCampaignChatNotificationsAsRead,
  chatReturnContextRef,
  setChatCampaign,
  dismissLiveNotification
}) {
  const beginSessionTask = useSessionTask(token);
  const handleNotificationAction = async (notification, { returnToNotifications = false } = {}) => {
    const isCurrent = beginSessionTask();
    if (!token || !notification) {
      return;
    }

    const isCampaignOrderNotification = isFullCampaignNotification(notification);
    const isReviewNotification = isReviewCampaignNotification(notification);
    const isPurchaseChat = isPurchaseChatNotification(notification);
    const isPurchaseNotification = isPurchaseOrderNotification(notification);
    const isInquiry = isInquiryNotification(notification);

    if (!isCampaignOrderNotification && !isReviewNotification && !isPurchaseChat && !isPurchaseNotification && !isInquiry) {
      await markNotificationAsRead(notification.id, notification);
      if (!isCurrent()) return false;
      return;
    }

    await markNotificationAsRead(notification.id, notification);
    if (!isCurrent()) return false;

    if (isInquiry) {
      setIsNotificationsOpen(false);
      setInquiryTargetId(notification.referenceId);
      switchActiveType('INQUIRY');
      return;
    }

    if (isPurchaseChat) {
      const opened = await handleOpenPurchaseChat(
        { orderId: notification.referenceId },
        { returnContext: returnToNotifications ? { type: 'NOTIFICATIONS' } : null }
      );
      if (!isCurrent()) return false;
      if (opened && returnToNotifications) {
        setIsNotificationsOpen(false);
      }
      return;
    }

    if (isPurchaseNotification) {
      if (returnToNotifications) setIsNotificationsOpen(false);
      setPurchaseOrderFromChat({
        id: notification.referenceId,
        orderId: notification.referenceId,
        openedFromNotification: true,
        returnToNotifications,
      });
      return;
    }

    try {
      const targetCampaign = await findCampaignForNotification(notification.referenceId);
      if (!isCurrent()) return false;

      if (!targetCampaign) {
        setNotificationsError(`${getCampaignDisplayName(null, notification.referenceId)}已找不到，無法開啟詳情。`);
        return;
      }

      if (isReviewNotification) {
        setIsNotificationsOpen(false);

        if ((targetCampaign.mineSource ?? '').toString().toUpperCase() === 'HOSTED') {
          const dashboard = await fetchHostDashboard(targetCampaign.id, token);
          if (!isCurrent()) return false;
          const nextCampaign = buildHostParticipationCampaign(
            { ...targetCampaign, initialHostView: 'participants' },
            dashboard
          );
          setParticipationCampaign({ ...nextCampaign, initialHostView: 'participants' });
          setParticipationQuantityDraft(String(nextCampaign.hostReservedQuantity));
          return;
        }

        if (targetCampaign.host?.id != null) {
          handleOpenReview({
            campaignId: targetCampaign.id,
            revieweeId: targetCampaign.host.id,
            revieweeName: targetCampaign.host.displayName,
            source: 'participant',
          });
          return;
        }

        setNotificationsError('找不到可評價的對象');
        return;
      }

      if (isCampaignOrderNotification) {
        if (returnToNotifications) setIsNotificationsOpen(false);
        await handleOpenParticipation(targetCampaign);
        if (!isCurrent()) return false;
        return;
      }

      if (!canOpenCampaignChat(targetCampaign)) {
        setNotificationsError(`${getCampaignDisplayName(targetCampaign, notification.referenceId)}目前無法開啟聊天室。`);
        return;
      }

      await markCampaignChatNotificationsAsRead(targetCampaign.id);
      if (!isCurrent()) return false;
      chatReturnContextRef.current = returnToNotifications ? { type: 'NOTIFICATIONS' } : null;
      if (returnToNotifications) {
        setIsNotificationsOpen(false);
      }
      setChatCampaign(targetCampaign);
    } catch (error) {
      if (!isCurrent()) return false;
      setNotificationsError(error.message);
    }
  };

  const handleLiveNotificationAction = async (notification) => {
    const isCurrent = beginSessionTask();
    if (!notification) {
      return;
    }

    dismissLiveNotification(notification.toastKey ?? getLiveNotificationKey(notification));

    if (
      isFullCampaignNotification(notification) ||
      isReviewCampaignNotification(notification) ||
      isPurchaseChatNotification(notification) ||
      isPurchaseOrderNotification(notification) ||
      isInquiryNotification(notification)
    ) {
      await handleNotificationAction(notification);
      if (!isCurrent()) return false;
      return;
    }

    setIsNotificationsOpen(true);
  };

  return {
    handleNotificationAction,
    handleLiveNotificationAction
  };
}
