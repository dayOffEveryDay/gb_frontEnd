import useSessionTask from '../useSessionTask';
import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { getInitialNotificationSoundEnabled, getLiveNotificationKey, unlockNotificationAudio, normalizeNotificationList, normalizeNotification, playNotificationSound, NOTIFICATION_SOUND_ENABLED_KEY, isFullCampaignNotification } from '../../homeHelpers';
import { getBackendBaseUrl, fetchUnreadNotifications, fetchReadNotifications, markNotificationRead } from '../../api';
import { Client } from '@stomp/stompjs';
import { prependNotification } from '../../notificationUpdates';

export default function useNotifications({
  token,
  userId,
  purchaseChatRoomRef,
  handleChatAccessRevoked
}) {
  const beginSessionTask = useSessionTask(token);
  const accountKey = token ? String(userId ?? '') : '';
  const readRevisionRef = useRef(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);

  const [readNotifications, setReadNotifications] = useState([]);

  const [notificationsError, setNotificationsError] = useState('');

  const [readNotificationsError, setReadNotificationsError] = useState('');

  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);

  const [isReadNotificationsLoading, setIsReadNotificationsLoading] = useState(false);

  const [liveNotifications, setLiveNotifications] = useState([]);

  const [isNotificationSoundEnabled, setIsNotificationSoundEnabled] = useState(getInitialNotificationSoundEnabled);

  const notificationClientRef = useRef(null);

  const notificationRevisionRef = useRef(0);

  const lastNotificationPushAtRef = useRef(0);

  const liveNotificationTimersRef = useRef(new Map());

  const notificationAudioContextRef = useRef(null);

  const notificationSoundEnabledRef = useRef(isNotificationSoundEnabled);

  const wsUrl = useMemo(() => new URL('/ws', getBackendBaseUrl()).toString(), []);

  useEffect(() => {
    setIsNotificationsOpen(false);
    setNotifications([]);
    setReadNotifications([]);
    setLiveNotifications([]);
    notificationRevisionRef.current += 1;
    readRevisionRef.current += 1;
    lastNotificationPushAtRef.current = 0;
    const timers = liveNotificationTimersRef.current;
    timers.forEach(timer => window.clearTimeout(timer));
    timers.clear();
  }, [accountKey]);

  const dismissLiveNotification = useCallback((notificationKey) => {
    const timerId = liveNotificationTimersRef.current.get(notificationKey);
    if (timerId) {
      window.clearTimeout(timerId);
      liveNotificationTimersRef.current.delete(notificationKey);
    }

    setLiveNotifications((current) => current.filter((notification) => notification.toastKey !== notificationKey));
  }, []);

  const pushLiveNotification = useCallback(
    (notification) => {
      if (!notification) {
        return;
      }

      const toastKey = getLiveNotificationKey(notification);
      setLiveNotifications((current) => [
        {
          ...notification,
          toastKey,
        },
        ...current.filter((item) => item.toastKey !== toastKey),
      ]);

      const existingTimerId = liveNotificationTimersRef.current.get(toastKey);
      if (existingTimerId) {
        window.clearTimeout(existingTimerId);
      }

      const nextTimerId = window.setTimeout(() => {
        liveNotificationTimersRef.current.delete(toastKey);
        setLiveNotifications((current) => current.filter((item) => item.toastKey !== toastKey));
      }, 5000);

      liveNotificationTimersRef.current.set(toastKey, nextTimerId);
    },
    []
  );

  useEffect(() => {
    notificationSoundEnabledRef.current = isNotificationSoundEnabled;
  }, [isNotificationSoundEnabled]);

  useEffect(() => {
    const notificationTimers = liveNotificationTimersRef.current;
    return () => {
      notificationTimers.forEach((timerId) => window.clearTimeout(timerId));
      notificationTimers.clear();

      if (notificationAudioContextRef.current) {
        void notificationAudioContextRef.current.close();
        notificationAudioContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isNotificationSoundEnabled) {
      return undefined;
    }

    const unlockAudio = () => {
      void unlockNotificationAudio(notificationAudioContextRef);
    };
    const events = ['pointerdown', 'touchstart', 'keydown'];

    events.forEach((eventName) => window.addEventListener(eventName, unlockAudio, { passive: true }));

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, unlockAudio));
    };
  }, [isNotificationSoundEnabled]);

  useEffect(() => {
    if (!token) {
      setIsNotificationsOpen(false);
      setNotifications([]);
      setReadNotifications([]);

      setNotificationsError('');
      setReadNotificationsError('');
      setIsNotificationsLoading(false);
      setIsReadNotificationsLoading(false);
      return undefined;
    }

    let cancelled = false;

    setIsNotificationsLoading(true);
    setIsReadNotificationsLoading(true);
    setNotificationsError('');
    setReadNotificationsError('');

    const notificationRevision = notificationRevisionRef.current;
    fetchUnreadNotifications(token)
      .then((data) => {
        if (!cancelled && notificationRevision === notificationRevisionRef.current) {
          setNotifications(normalizeNotificationList(data));
        }
      })
      .catch((error) => {
        if (!cancelled && notificationRevision === notificationRevisionRef.current) {
          setNotificationsError(error.message);
          setNotifications([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsNotificationsLoading(false);
        }
      });

    const readRevision = readRevisionRef.current;
    fetchReadNotifications({ page: 0, size: 20 }, token)
      .then((data) => {
        if (!cancelled && readRevision === readRevisionRef.current) {
          setReadNotifications(normalizeNotificationList(data));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setReadNotificationsError(error.message);
          setReadNotifications([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsReadNotificationsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, purchaseChatRoomRef]);

  useEffect(() => {
    if (!token) return undefined;
    let disposed = false;
    let inFlight = false;
    const syncUnread = async () => {
      // Give an in-progress answer transaction time to commit before reconciling.
      if (document.hidden || inFlight || Date.now() - lastNotificationPushAtRef.current < 5000) return;
      const revision = notificationRevisionRef.current;
      inFlight = true;
      try {
        const data = await fetchUnreadNotifications(token);
        if (!disposed && revision === notificationRevisionRef.current) {
          const activeOrderId = purchaseChatRoomRef.current?.orderId;
          setNotifications(normalizeNotificationList(data).filter((notification) =>
            !(notification.type === 'PURCHASE_CHAT_MESSAGE' && activeOrderId != null &&
              String(notification.referenceId) === String(activeOrderId))
          ));
          setNotificationsError('');
        }
      } catch {
        // Keep the last known notifications during a temporary network failure.
      } finally {
        inFlight = false;
      }
    };
    const interval = window.setInterval(syncUnread, 30000);
    window.addEventListener('focus', syncUnread);
    document.addEventListener('visibilitychange', syncUnread);
    window.addEventListener('notifications-reconnected', syncUnread);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', syncUnread);
      document.removeEventListener('visibilitychange', syncUnread);
      window.removeEventListener('notifications-reconnected', syncUnread);
    };
  }, [token, purchaseChatRoomRef]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let disposed = false;

    const connect = async () => {
      try {
        const sockJsModule = await import('sockjs-client/dist/sockjs');
        const SockJS = sockJsModule.default;

        if (disposed) {
          return;
        }

        const client = new Client({
          webSocketFactory: () => new SockJS(wsUrl),
          connectHeaders: {
            Authorization: `Bearer ${token}`,
          },
          reconnectDelay: 5000,
          debug: () => {},
          onConnect: () => {
            if (disposed) return;
            window.dispatchEvent(new Event('notifications-reconnected'));
            client.subscribe('/user/queue/notifications', (frame) => {
              try {
                if (disposed) return;
                const incomingNotification = normalizeNotification(JSON.parse(frame.body));
                notificationRevisionRef.current += 1;
                lastNotificationPushAtRef.current = Date.now();
                const activePurchaseOrderId = purchaseChatRoomRef.current?.orderId;
                const isActivePurchaseChatMessage =
                  incomingNotification.type === 'PURCHASE_CHAT_MESSAGE' &&
                  activePurchaseOrderId != null &&
                  String(incomingNotification.referenceId) === String(activePurchaseOrderId);

                if (!disposed) {
                  if (!isActivePurchaseChatMessage && notificationSoundEnabledRef.current) {
                    void playNotificationSound(notificationAudioContextRef);
                  }

                  if (!isActivePurchaseChatMessage) {
                    setNotifications((current) => prependNotification(current, incomingNotification));
                    setNotificationsError('');
                    pushLiveNotification(incomingNotification);
                  }
                }

                if (isActivePurchaseChatMessage && incomingNotification.id != null) {
                  void markNotificationRead(incomingNotification.id, token).catch(() => {});
                }
              } catch {
                setNotificationsError('通知資料解析失敗');
              }
            });

            client.subscribe('/user/queue/chat-access', (frame) => {
              try {
                const payload = JSON.parse(frame.body);
                if (payload?.type !== 'CHAT_ACCESS_REVOKED' || payload?.campaignId == null || disposed) {
                  return;
                }

                handleChatAccessRevoked(payload);
              } catch {
                setNotificationsError('聊天室權限事件解析失敗');
              }
            });
          },
          onStompError: (frame) => {
            if (disposed) return;
            setNotificationsError(frame.headers.message || '通知連線發生錯誤');
          },
        });

        client.activate();
        notificationClientRef.current = client;
      } catch (error) {
        if (disposed) return;
        setNotificationsError(error instanceof Error ? error.message : '通知連線初始化失敗');
      }
    };

    connect();

    return () => {
      disposed = true;
      notificationClientRef.current?.deactivate();
      notificationClientRef.current = null;
    };
  }, [pushLiveNotification, handleChatAccessRevoked, purchaseChatRoomRef, token, wsUrl]);

  const handleToggleNotificationSound = () => {
    const nextEnabled = !isNotificationSoundEnabled;

    setIsNotificationSoundEnabled(nextEnabled);
    localStorage.setItem(NOTIFICATION_SOUND_ENABLED_KEY, String(nextEnabled));

    if (nextEnabled) {
      void unlockNotificationAudio(notificationAudioContextRef);
    }
  };

  const hidePurchaseChatNotifications = useCallback((orderId) => {
    if (orderId == null) return;
    notificationRevisionRef.current += 1;
    setNotifications((current) =>
      current.filter(
        (notification) =>
          notification.type !== 'PURCHASE_CHAT_MESSAGE' ||
          String(notification.referenceId) !== String(orderId)
      )
    );
  }, []);

  const markNotificationAsRead = async (notificationId, sourceNotification = null) => {
    if (!token) {
      return;
    }

    if (notificationId == null) {
      setNotificationsError('通知 ID 缺失，無法標記已讀');
      return;
    }

    const isCurrent = beginSessionTask();
    try {
      await markNotificationRead(notificationId, token);
      if (!isCurrent()) return;
      notificationRevisionRef.current += 1;
      readRevisionRef.current += 1;
      const notificationToMove =
        sourceNotification ?? notifications.find((notification) => notification.id === notificationId) ?? null;
      setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
      if (notificationToMove) {
        setReadNotifications((current) => {
          if (current.some((notification) => notification.id === notificationToMove.id)) {
            return current;
          }

          return [notificationToMove, ...current].slice(0, 20);
        });
      }
    } catch (error) {
      if (isCurrent()) setNotificationsError(error.message);
    }
  };

  const markCampaignChatNotificationsAsRead = async (campaignId) => {
    const matchedNotifications = notifications.filter(
      (notification) =>
        isFullCampaignNotification(notification) && Number(notification.referenceId) === Number(campaignId)
    );

    if (matchedNotifications.length === 0) {
      return;
    }

    await Promise.all(matchedNotifications.map((notification) => markNotificationAsRead(notification.id)));
  };

  return {
    isNotificationsOpen,
    setIsNotificationsOpen,
    notifications,
    readNotifications,
    notificationsError,
    setNotificationsError,
    readNotificationsError,
    isNotificationsLoading,
    isReadNotificationsLoading,
    liveNotifications,
    isNotificationSoundEnabled,
    dismissLiveNotification,
    handleToggleNotificationSound,
    hidePurchaseChatNotifications,
    markNotificationAsRead,
    markCampaignChatNotificationsAsRead
  };
}
