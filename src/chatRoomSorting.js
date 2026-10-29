export function isChatRoomReadOnly(room) {
  if (room?.roomType === 'PURCHASE') {
    return Boolean(room.readOnly ?? room.read_only);
  }
  return (room?.chatAccess ?? room?.chat_access ?? '').toString().trim().toUpperCase() === 'READ_ONLY';
}

export function compareChatRooms(first, second, getSortTime) {
  return Number(isChatRoomReadOnly(first)) - Number(isChatRoomReadOnly(second)) ||
    getSortTime(second) - getSortTime(first);
}

export function isChatRoomEnded(room) {
  const status = (room?.roomType === 'PURCHASE'
    ? room.orderStatus ?? room.order_status ?? room.status
    : room?.status ?? room?.campaignStatus ?? room?.campaign_status ?? room?.state
  )?.toString().trim().toUpperCase();
  return isChatRoomReadOnly(room) || [
    'COMPLETED', 'CANCELLED', 'CANCELED', 'ARCHIVED', 'EXPIRED',
    'UNAVAILABLE_CANCELLED', 'PENALIZED_CANCELLED', 'DISPUTE_CLOSED_NO_PENALTY',
  ].includes(status);
}

export function getChatRoomUnreadCount(room) {
  const count = Number(room?.unreadCount ?? room?.unreadMessageCount ?? room?.unread_count ?? 0);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}
