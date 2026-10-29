// Keep the pushed notification even before the server's transaction is visible to GET.
export function prependNotification(current, incoming) {
  return [incoming, ...current.filter((item) => {
    if (incoming.id != null && String(item.id) === String(incoming.id)) return false;
    return !(incoming.type === 'PURCHASE_CHAT_MESSAGE' && item.type === incoming.type &&
      incoming.referenceId != null && String(item.referenceId) === String(incoming.referenceId));
  })];
}
