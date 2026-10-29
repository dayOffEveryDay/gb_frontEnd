import { useEffect } from 'react';

// A cursor is acknowledged only after the loaded messages have rendered in a
// visible document. Never substitute the server's latest message for this ID.
export default function useRenderedChatRead({ isOpen, roomId, loadedRoomRef, messages, token, bodyRef, acknowledge, onError }) {
  useEffect(() => {
    if (!isOpen || !token || loadedRoomRef.current !== roomId) return undefined;
    const lastId = (messages ?? []).reduce((latest, message) => {
      const id = Number(message.messageId ?? message.id);
      return Number.isSafeInteger(id) && id > latest ? id : latest;
    }, 0);
    if (!lastId) return undefined;
    let frame;
    let disposed = false;
    let inFlight = false;
    let completed = false;
    const scheduleRead = () => {
      if (document.visibilityState !== 'visible' || inFlight || completed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(async () => {
        if (disposed || document.visibilityState !== 'visible' || !bodyRef.current) return;
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
        inFlight = true;
        try {
          await acknowledge(roomId, lastId, () => !disposed);
          completed = true;
        } catch {
          if (!disposed) onError('已讀進度更新失敗，請重新開啟聊天室再試。');
        } finally {
          inFlight = false;
        }
      });
    };
    scheduleRead();
    document.addEventListener('visibilitychange', scheduleRead);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', scheduleRead);
    };
  }, [isOpen, roomId, loadedRoomRef, messages, token, bodyRef, acknowledge, onError]);
}
