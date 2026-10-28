import {
  getReviewKey,
  isSameUserId,
  normalizeHostParticipant,
  isReviewAlreadyCompleted,
  canOpenReadonlyParticipationFromDeal,
  buildHostParticipationCampaign,
  getCampaignChatAccess,
  isViewableParticipantStatus,
  normalizeHostDashboard,
} from '../../homeHelpers';
import { useCallback, useEffect } from 'react';
import {
  fetchHostDashboard,
  checkReviewStatus,
  fetchMyParticipation,
  confirmCampaignReceipt,
  deliverCampaign,
  raiseCampaignDispute,
  unlockCampaignRevision,
  kickCampaignParticipant,
  markParticipantNoShow,
  hostReviseCampaign,
  joinCampaign,
  reviseCampaign,
  withdrawCampaign,
  cancelCampaign,
} from '../../api';
import { getMineCampaignBucket } from '../../components/campaign/campaignCardUtils';

export default function useParticipationActions({
  token,
  setIsLoginModalOpen,
  setReviewTarget,
  setReviewedReviewKeys,
  setChatReviewState,
  participationCampaign,
  reviewedReviewKeys,
  user,
  chatCampaign,
  setParticipationError,
  setParticipationCampaign,
  setParticipationQuantityDraft,
  refreshMineCampaignsBeforeOpen,
  isSubmittingParticipation,
  setCampaigns,
  setChatCampaign,
  setChatStatusEvent,
  campaigns,
  setCampaignError,
  findCampaignForNotification,
  liveNotifications,
  lastHandledChatNotificationRef,
  setIsSubmittingParticipation,
  setRefreshKey,
  participationQuantityDraft
}) {
  const handleOpenReview = (target) => {
    if (!token) {
      setIsLoginModalOpen(true);
      return;
    }

    setReviewTarget(target ?? null);
  };

  const handleCloseReview = () => {
    setReviewTarget(null);
  };

  const handleReviewSubmitted = (target) => {
    if (target?.campaignId != null && target?.revieweeId != null) {
      setReviewedReviewKeys((current) => ({
        ...current,
        [getReviewKey(target.campaignId, target.revieweeId)]: true,
      }));

      setChatReviewState((current) => {
        if (target.source === 'participant') {
          return {
            ...current,
            isParticipantReviewed: true,
          };
        }

        if (target.source === 'host') {
          const participants = Array.isArray(participationCampaign?.dashboard?.participants)
            ? participationCampaign.dashboard.participants
            : [];
          const nextReviewedKeys = {
            ...reviewedReviewKeys,
            [getReviewKey(target.campaignId, target.revieweeId)]: true,
          };
          const reviewableParticipants = participants.filter((participant) => participant.userId != null);

          return {
            ...current,
            isHostAllReviewed:
              reviewableParticipants.length > 0 &&
              reviewableParticipants.every((participant) =>
                Boolean(nextReviewedKeys[getReviewKey(target.campaignId, participant.userId)])
              ),
          };
        }

        return current;
      });
    }

    handleCloseReview();
  };

  const loadReviewStatusesForCampaign = useCallback(
    async (campaign) => {
      if (!token || !campaign?.id) {
        return;
      }

      const isHostCampaign = isSameUserId(campaign.host?.id, user?.id) || campaign.isHost;

      if (isHostCampaign) {
        const dashboard = campaign.dashboard?.participants ? campaign.dashboard : await fetchHostDashboard(campaign.id, token);
        const participants = Array.isArray(dashboard?.participants)
          ? dashboard.participants.map((participant, index) => normalizeHostParticipant(participant, index))
          : [];
        const reviewableParticipants = participants.filter((participant) => participant.userId != null);

        if (reviewableParticipants.length === 0) {
          setChatReviewState((current) => ({
            ...current,
            isHostAllReviewed: false,
          }));
          return;
        }

        const results = await Promise.all(
          reviewableParticipants.map(async (participant) => {
            try {
              const data = await checkReviewStatus(campaign.id, participant.userId, token);
              return {
                key: getReviewKey(campaign.id, participant.userId),
                reviewed: isReviewAlreadyCompleted(data),
              };
            } catch {
              return {
                key: getReviewKey(campaign.id, participant.userId),
                reviewed: false,
              };
            }
          })
        );

        setReviewedReviewKeys((current) => {
          const next = { ...current };
          results.forEach((result) => {
            next[result.key] = result.reviewed;
          });
          return next;
        });
        setChatReviewState((current) => ({
          ...current,
          isHostAllReviewed: results.length > 0 && results.every((result) => result.reviewed),
        }));
        return;
      }

      if (campaign.host?.id == null) {
        return;
      }

      try {
        const data = await checkReviewStatus(campaign.id, campaign.host.id, token);
        const reviewed = isReviewAlreadyCompleted(data);
        setReviewedReviewKeys((current) => ({
          ...current,
          [getReviewKey(campaign.id, campaign.host.id)]: reviewed,
        }));
        setChatReviewState((current) => ({
          ...current,
          isParticipantReviewed: reviewed,
        }));
      } catch {
        setChatReviewState((current) => ({
          ...current,
          isParticipantReviewed: false,
        }));
      }
    },
    [setChatReviewState, setReviewedReviewKeys, token, user?.id]
  );

  useEffect(() => {
    if (!chatCampaign) {
      setChatReviewState({
        isParticipantReviewed: false,
        isHostAllReviewed: false,
      });
      return;
    }

    void loadReviewStatusesForCampaign(chatCampaign);
  }, [chatCampaign, loadReviewStatusesForCampaign, setChatReviewState]);

  useEffect(() => {
    if (!participationCampaign || participationCampaign.managementMode !== 'HOST') {
      return;
    }

    void loadReviewStatusesForCampaign(participationCampaign);
  }, [loadReviewStatusesForCampaign, participationCampaign]);

  const handleOpenParticipation = async (deal) => {
    if (!token) {
      setIsLoginModalOpen(true);
      return;
    }

    setParticipationError('');

    const openParticipationFromDeal = (nextDeal) => {
      const readonlyQuantity = Number(
        nextDeal?.quantity ??
          nextDeal?.joinQuantity ??
          nextDeal?.join_quantity ??
          nextDeal?.joinedQuantity ??
          nextDeal?.joined_quantity ??
          0
      );

      setParticipationCampaign({
        ...nextDeal,
        managementMode: 'JOINED',
        isHost: false,
        joined: true,
        quantity: readonlyQuantity,
        isReadonlyParticipation: canOpenReadonlyParticipationFromDeal(nextDeal),
      });
      setParticipationQuantityDraft(String(readonlyQuantity));
    };

    try {
      const nextDeal = await refreshMineCampaignsBeforeOpen(deal);
      const isHostDeal = isSameUserId(nextDeal.host?.id, user?.id) || nextDeal.isHost;

      if (isHostDeal) {
        const [dashboard, participation] = await Promise.all([
          fetchHostDashboard(nextDeal.id, token),
          fetchMyParticipation(nextDeal.id, token),
        ]);
        const nextCampaign = {
          ...buildHostParticipationCampaign(nextDeal, dashboard),
          chatAccess: getCampaignChatAccess(participation),
        };

        setParticipationCampaign(nextCampaign);
        setParticipationQuantityDraft(String(nextCampaign.hostReservedQuantity));
        return;
      }

      openParticipationFromDeal(nextDeal);

      const participation = await fetchMyParticipation(nextDeal.id, token);
      const participantStatus = (
        participation?.myParticipantStatus ??
        participation?.my_participant_status ??
        nextDeal?.myParticipantStatus ??
        nextDeal?.my_participant_status ??
        participation?.participantStatus ??
        participation?.participant_status ??
        ''
      )
        .toString()
        .toUpperCase();
      const mergedDeal = {
        ...nextDeal,
        chatAccess: getCampaignChatAccess(participation),
        managementMode: 'JOINED',
        isHost: Boolean(participation?.host ?? nextDeal.isHost),
        myParticipantStatus: participantStatus || nextDeal?.myParticipantStatus || '',
        isReadonlyParticipation:
          getMineCampaignBucket({
            ...nextDeal,
            myParticipantStatus: participantStatus || nextDeal?.myParticipantStatus || '',
            participantStatus,
            quantity:
              participation?.quantity ??
              participation?.joinedQuantity ??
              participation?.joined_quantity ??
              nextDeal.quantity ??
              nextDeal.joinQuantity ??
              nextDeal.join_quantity ??
              0,
          }) === 'COMPLETED',
        joined: participantStatus
          ? isViewableParticipantStatus(participantStatus)
          : Boolean(participation?.joined ?? nextDeal.joined ?? Number(nextDeal.quantity) > 0),
        quantity: Number(
          participation?.quantity ??
            participation?.joinedQuantity ??
            participation?.joined_quantity ??
            nextDeal.quantity ??
            nextDeal.joinQuantity ??
            nextDeal.join_quantity ??
            0
        ),
      };

      if (mergedDeal.isHost || !mergedDeal.joined || mergedDeal.quantity <= 0) {
        setParticipationError('目前沒有可調整的認購紀錄');
        return;
      }

      setParticipationCampaign(mergedDeal);
      setParticipationQuantityDraft(String(mergedDeal.quantity));
    } catch (error) {
      setParticipationError(error.message);
    }
  };

  const handleCloseParticipation = () => {
    if (isSubmittingParticipation) {
      return;
    }

    setParticipationCampaign(null);
    setParticipationQuantityDraft('1');
    setParticipationError('');
  };

  const handleConfirmCampaignReceipt = async (campaignId) => {
    if (!token) {
      return { success: false, message: '請先登入後再確認收貨' };
    }

    try {
      const response = await confirmCampaignReceipt(campaignId, token);

      setCampaigns((current) =>
        current.map((campaign) =>
          Number(campaign.id) === Number(campaignId)
            ? {
                ...campaign,
                status: 'CONFIRMED',
              }
            : campaign
        )
      );

      setParticipationCampaign((current) =>
        current && Number(current.id) === Number(campaignId)
          ? {
              ...current,
              status: 'CONFIRMED',
            }
          : current
      );

      return {
        success: true,
        message: response?.message ?? '已確認收到商品',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '確認收到失敗',
      };
    }
  };

  const handleDeliverCampaign = async (campaignId) => {
    if (!token) {
      return { success: false, message: '請先登入後再標記已面交' };
    }

    try {
      const response = await deliverCampaign(campaignId, token);

      setCampaigns((current) =>
        current.map((campaign) =>
          Number(campaign.id) === Number(campaignId)
            ? {
                ...campaign,
                status: 'DELIVERED',
              }
            : campaign
        )
      );

      setChatCampaign((current) =>
        current && Number(current.id) === Number(campaignId)
          ? {
              ...current,
              status: 'DELIVERED',
            }
          : current
      );

      setParticipationCampaign((current) =>
        current && Number(current.id) === Number(campaignId)
          ? {
              ...current,
              status: 'DELIVERED',
              dashboard: current.dashboard
                ? {
                    ...current.dashboard,
                    status: 'DELIVERED',
                  }
                : current.dashboard,
            }
          : current
      );

      return {
        success: true,
        message: response?.message ?? '已標記面交完成',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '標記面交失敗',
      };
    }
  };

  const handleRaiseCampaignDispute = async (campaignId, reason) => {
    if (!token) {
      return { success: false, message: '請先登入後再提出仲裁' };
    }

    try {
      const response = await raiseCampaignDispute(campaignId, token, reason);

      setCampaigns((current) =>
        current.map((campaign) =>
          Number(campaign.id) === Number(campaignId)
            ? {
                ...campaign,
                myParticipantStatus: 'DISPUTED',
              }
            : campaign
        )
      );

      setChatCampaign((current) =>
        current && Number(current.id) === Number(campaignId)
          ? {
              ...current,
              myParticipantStatus: 'DISPUTED',
            }
          : current
      );

      setParticipationCampaign((current) =>
        current && Number(current.id) === Number(campaignId)
          ? {
              ...current,
              myParticipantStatus: 'DISPUTED',
            }
          : current
      );

      return {
        success: true,
        message: response?.message ?? '已提出仲裁',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '提出仲裁失敗',
      };
    }
  };

  const handleCampaignStatusChange = useCallback(
    async ({ campaignId, status, message, source = '' }) => {
      if (!campaignId || !status) {
        return;
      }

      const normalizedStatus = status.toString().toUpperCase();
      const applyStatus = (campaign) =>
        Number(campaign?.id) === Number(campaignId)
          ? {
              ...campaign,
              status: normalizedStatus,
              campaignStatus: normalizedStatus,
              dashboard: campaign.dashboard
                ? {
                    ...campaign.dashboard,
                    status: normalizedStatus,
                  }
                : campaign.dashboard,
            }
          : campaign;

      setCampaigns((current) => current.map(applyStatus));
      setChatCampaign((current) => (current ? applyStatus(current) : current));
      setParticipationCampaign((current) => (current ? applyStatus(current) : current));

      if (message && source !== 'topic') {
        setChatStatusEvent({
          id: `${campaignId}-${normalizedStatus}-${Date.now()}`,
          campaignId,
          status: normalizedStatus,
          message,
        });
      }

      if (!token) {
        return;
      }

      const currentCampaign =
        chatCampaign && Number(chatCampaign.id) === Number(campaignId)
          ? chatCampaign
          : participationCampaign && Number(participationCampaign.id) === Number(campaignId)
            ? participationCampaign
            : campaigns.find((campaign) => Number(campaign.id) === Number(campaignId));
      const isHostCampaign = isSameUserId(currentCampaign?.host?.id, user?.id) || currentCampaign?.isHost;

      try {
        if (isHostCampaign) {
          const [dashboard, participation] = await Promise.all([
            fetchHostDashboard(campaignId, token),
            fetchMyParticipation(campaignId, token),
          ]);
          const normalizedDashboard = normalizeHostDashboard(dashboard);
          const nextChatAccess = getCampaignChatAccess(participation);

          setChatCampaign((current) =>
            current && Number(current.id) === Number(campaignId)
              ? {
                  ...current,
                  status: normalizedDashboard.status || normalizedStatus,
                  dashboard: normalizedDashboard,
                  chatAccess: nextChatAccess,
                }
              : current
          );
          setParticipationCampaign((current) =>
            current && Number(current.id) === Number(campaignId)
              ? {
                  ...buildHostParticipationCampaign({
                    ...current,
                    status: normalizedDashboard.status || normalizedStatus,
                  }, dashboard),
                  chatAccess: nextChatAccess,
                }
              : current
          );
          setParticipationQuantityDraft(String(normalizedDashboard.hostReservedQuantity));
          return;
        }

        const participation = await fetchMyParticipation(campaignId, token);
        const participantStatus = (
          participation?.myParticipantStatus ??
          participation?.my_participant_status ??
          participation?.participantStatus ??
          participation?.participant_status ??
          ''
        )
          .toString()
          .toUpperCase();
        const joinedQuantity = Number(
          participation?.quantity ??
            participation?.joinedQuantity ??
            participation?.joined_quantity ??
            0
        );
        const participantPatch = {
          status: normalizedStatus,
          campaignStatus: normalizedStatus,
          myParticipantStatus: participantStatus,
          participantStatus,
          chatAccess: getCampaignChatAccess(participation),
          joined: participantStatus ? isViewableParticipantStatus(participantStatus) : Boolean(participation?.joined),
          quantity: joinedQuantity,
        };

        setChatCampaign((current) =>
          current && Number(current.id) === Number(campaignId)
            ? {
                ...current,
                ...participantPatch,
              }
            : current
        );
        setParticipationCampaign((current) =>
          current && Number(current.id) === Number(campaignId)
            ? {
                ...current,
                ...participantPatch,
                managementMode: current.managementMode ?? 'JOINED',
              }
            : current
        );
        setParticipationQuantityDraft((current) => (joinedQuantity > 0 ? String(joinedQuantity) : current));
      } catch (error) {
        setCampaignError(error instanceof Error ? error.message : '團購狀態刷新失敗');
      }
    },
    [campaigns, chatCampaign, participationCampaign, setCampaignError, setCampaigns, setChatCampaign, setChatStatusEvent, setParticipationCampaign, setParticipationQuantityDraft, token, user?.id]
  );

  const refreshOpenChatCampaign = useCallback(
    async (campaignId, message = '') => {
      if (!campaignId || !token) {
        return;
      }

      const latestCampaign = await findCampaignForNotification(campaignId, { forceRemote: true });
      if (!latestCampaign) {
        return;
      }

      setCampaigns((current) =>
        current.map((campaign) =>
          Number(campaign.id) === Number(campaignId)
            ? {
                ...campaign,
                ...latestCampaign,
              }
            : campaign
        )
      );
      setChatCampaign((current) =>
        current && Number(current.id) === Number(campaignId)
          ? {
              ...current,
              ...latestCampaign,
            }
          : current
      );
      setParticipationCampaign((current) =>
        current && Number(current.id) === Number(campaignId)
          ? {
              ...current,
              ...latestCampaign,
            }
          : current
      );

      if (message) {
        setChatStatusEvent({
          id: `${campaignId}-notification-${Date.now()}`,
          campaignId,
          status: latestCampaign.status ?? latestCampaign.campaignStatus ?? '',
          message,
        });
      }

      try {
        const participation = await fetchMyParticipation(campaignId, token);
        const nextChatAccess = getCampaignChatAccess(participation);

        if (isSameUserId(latestCampaign.host?.id, user?.id) || latestCampaign.isHost) {
          setChatCampaign((current) =>
            current && Number(current.id) === Number(campaignId)
              ? { ...current, chatAccess: nextChatAccess }
              : current
          );
        } else {
          const participantStatus = (
            participation?.myParticipantStatus ??
            participation?.my_participant_status ??
            participation?.participantStatus ??
            participation?.participant_status ??
            latestCampaign.myParticipantStatus ??
            ''
          )
            .toString()
            .toUpperCase();
          const joinedQuantity = Number(
            participation?.quantity ??
              participation?.joinedQuantity ??
              participation?.joined_quantity ??
              latestCampaign.quantity ??
              0
          );

          setChatCampaign((current) =>
            current && Number(current.id) === Number(campaignId)
              ? {
                  ...current,
                  myParticipantStatus: participantStatus,
                  participantStatus,
                  chatAccess: nextChatAccess,
                  joined: participantStatus ? isViewableParticipantStatus(participantStatus) : current.joined,
                  quantity: joinedQuantity || current.quantity,
                }
              : current
          );
        }
      } catch {
        // The latest campaign payload is still enough to update status-driven chat actions.
      }
    },
    [findCampaignForNotification, setCampaigns, setChatCampaign, setChatStatusEvent, setParticipationCampaign, token, user?.id]
  );

  const latestLiveNotification = liveNotifications[0] ?? null;

  useEffect(() => {
    if (!latestLiveNotification?.referenceId || !chatCampaign?.id) {
      return;
    }

    if (Number(latestLiveNotification.referenceId) !== Number(chatCampaign.id)) {
      return;
    }

    const notificationKey =
      latestLiveNotification.id ??
      `${latestLiveNotification.type}-${latestLiveNotification.referenceId}-${latestLiveNotification.createdAt}`;
    if (lastHandledChatNotificationRef.current === notificationKey) {
      return;
    }
    lastHandledChatNotificationRef.current = notificationKey;

    const statusByNotificationType = {
      CAMPAIGN_FULL: 'FULL',
      CAMPAIGN_DELIVERED: 'DELIVERED',
      CAMPAIGN_COMPLETED: 'COMPLETED',
      CAMPAIGN_CANCELLED: 'CANCELLED',
    };
    const nextStatus = statusByNotificationType[latestLiveNotification.type];

    if (!nextStatus) {
      void refreshOpenChatCampaign(latestLiveNotification.referenceId, latestLiveNotification.content);
      return;
    }

    void handleCampaignStatusChange({
      campaignId: latestLiveNotification.referenceId,
      status: nextStatus,
      message: latestLiveNotification.content,
      source: 'notification',
    });
    void refreshOpenChatCampaign(latestLiveNotification.referenceId);
  }, [chatCampaign?.id, handleCampaignStatusChange, lastHandledChatNotificationRef, latestLiveNotification, refreshOpenChatCampaign]);

  const refreshHostParticipationCampaign = async (campaignId) => {
    const dashboard = await fetchHostDashboard(campaignId, token);

    setParticipationCampaign((current) => {
      if (!current || current.id !== campaignId) {
        return current;
      }

      return buildHostParticipationCampaign(current, dashboard);
    });

    const normalizedDashboard = normalizeHostDashboard(dashboard);
    setParticipationQuantityDraft(String(normalizedDashboard.hostReservedQuantity));
    return normalizedDashboard;
  };

  const handleUnlockCampaign = async (campaignId) => {
    if (!token || !campaignId) {
      return {
        success: false,
        message: '缺少團購或登入資訊，無法開啟修改。',
      };
    }

    setIsSubmittingParticipation(true);
    setParticipationError('');

    try {
      const response = await unlockCampaignRevision(campaignId, token);
      await refreshHostParticipationCampaign(campaignId);
      setRefreshKey((current) => current + 1);

      return {
        success: true,
        message: response?.message ?? '已開啟滿單後修改',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '開啟滿單後修改失敗';
      setParticipationError(message);
      return {
        success: false,
        message,
      };
    } finally {
      setIsSubmittingParticipation(false);
    }
  };

  const _handleKickParticipant = async (participant) => {
    const campaignId = participationCampaign?.id;
    const participantId = participant?.participantId ?? participant?.userId ?? participant?.id ?? null;
    const campaignStatus = (participationCampaign?.dashboard?.status ?? participationCampaign?.status ?? '').toString().toUpperCase();
    const reason = campaignStatus === 'DELIVERED' ? '找不到人' : undefined;

    if (!token || !campaignId || !participantId) {
      setParticipationError('缺少團員資訊，無法剔除。');
      return;
    }

    setIsSubmittingParticipation(true);
    setParticipationError('');

    try {
      await kickCampaignParticipant(campaignId, participantId, token, reason);
      await refreshHostParticipationCampaign(campaignId);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setParticipationError(error instanceof Error ? error.message : '剔除團員失敗');
    } finally {
      setIsSubmittingParticipation(false);
    }
  };

  const handleParticipantStatusAction = async (payload) => {
    const participant = payload?.participant ?? payload;
    const inputReason = payload?.reason ?? '';
    const campaignId = participationCampaign?.id;
    const participantId =
      participant?.participantId ??
      participant?.participantsId ??
      participant?.participants_id ??
      participant?.id ??
      null;
    const userId = participant?.userId ?? participant?.user_id ?? participant?.memberId ?? null;
    const campaignStatus = (participationCampaign?.dashboard?.status ?? participationCampaign?.status ?? '')
      .toString()
      .toUpperCase();
    const reason = inputReason.trim();

    if (!token || !campaignId || (campaignStatus === 'DELIVERED' ? !userId : !participantId)) {
      setParticipationError('缺少成員資訊，無法處理。');
      return;
    }

    setIsSubmittingParticipation(true);
    setParticipationError('');

    try {
      if (campaignStatus === 'DELIVERED') {
        await markParticipantNoShow(campaignId, userId, token, reason || '找不到人');
      } else {
        await kickCampaignParticipant(campaignId, participantId, token, reason || undefined);
      }

      await refreshHostParticipationCampaign(campaignId);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setParticipationError(error instanceof Error ? error.message : '處理成員狀態失敗');
    } finally {
      setIsSubmittingParticipation(false);
    }
  };

  const handleSubmitParticipation = async () => {
    if (!participationCampaign) {
      return;
    }

    if (participationCampaign.managementMode === 'HOST') {
      const nextReservedQuantity = Number(participationQuantityDraft);
      const totalPhysicalQuantity = Number(participationCampaign.totalPhysicalQuantity ?? 0);
      const alreadySoldQuantity = Number(participationCampaign.alreadySoldQuantity ?? 0);

      if (!Number.isInteger(nextReservedQuantity) || nextReservedQuantity < 0) {
        setParticipationError('請輸入 0 以上的整數自留數量');
        return;
      }

      const nextOpenQuantity = totalPhysicalQuantity - nextReservedQuantity;
      if (nextOpenQuantity < alreadySoldQuantity) {
        setParticipationError('自留數量過高，會小於目前已售出數量');
        return;
      }

      setIsSubmittingParticipation(true);
      setParticipationError('');

      try {
        await hostReviseCampaign(
          participationCampaign.id,
          {
            newProductTotalQuantity: totalPhysicalQuantity,
            newOpenQuantity: nextOpenQuantity,
          },
          token
        );
        handleCloseParticipation();
        setRefreshKey((current) => current + 1);
      } catch (error) {
        setParticipationError(error.message);
      } finally {
        setIsSubmittingParticipation(false);
      }

      return;
    }

    const nextQuantity = Number(participationQuantityDraft);
    const currentQuantity = Number(participationCampaign.quantity) || 0;

    if (!Number.isInteger(nextQuantity) || nextQuantity <= 0) {
      setParticipationError('請輸入大於 0 的整數數量');
      return;
    }

    if (nextQuantity === currentQuantity) {
      handleCloseParticipation();
      return;
    }

    setIsSubmittingParticipation(true);
    setParticipationError('');

    try {
      if (nextQuantity > currentQuantity) {
        await joinCampaign(participationCampaign.id, { quantity: nextQuantity - currentQuantity }, token);
      } else {
        await reviseCampaign(participationCampaign.id, { quantity: currentQuantity - nextQuantity }, token);
      }

      handleCloseParticipation();
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setParticipationError(error.message);
    } finally {
      setIsSubmittingParticipation(false);
    }
  };

  const handleWithdrawParticipation = async () => {
    if (!participationCampaign) {
      return;
    }

    setIsSubmittingParticipation(true);
    setParticipationError('');

    try {
      await withdrawCampaign(participationCampaign.id, token);
      handleCloseParticipation();
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setParticipationError(error.message);
    } finally {
      setIsSubmittingParticipation(false);
    }
  };

  const handleCancelHostedCampaign = async () => {
    if (!participationCampaign) {
      return;
    }

    setIsSubmittingParticipation(true);
    setParticipationError('');

    try {
      await cancelCampaign(participationCampaign.id, token);
      handleCloseParticipation();
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setParticipationError(error.message);
    } finally {
      setIsSubmittingParticipation(false);
    }
  };

  return {
    handleOpenReview,
    handleCloseReview,
    handleReviewSubmitted,
    loadReviewStatusesForCampaign,
    handleOpenParticipation,
    handleCloseParticipation,
    handleConfirmCampaignReceipt,
    handleDeliverCampaign,
    handleRaiseCampaignDispute,
    handleCampaignStatusChange,
    refreshOpenChatCampaign,
    latestLiveNotification,
    refreshHostParticipationCampaign,
    handleUnlockCampaign,
    _handleKickParticipant,
    handleParticipantStatusAction,
    handleSubmitParticipation,
    handleWithdrawParticipation,
    handleCancelHostedCampaign
  };
}
