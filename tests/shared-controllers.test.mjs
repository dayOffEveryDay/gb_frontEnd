import assert from 'node:assert/strict';
import test from 'node:test';
import { deferred, mountController } from './helpers/mount-controller.mjs';

const noop = () => {};
const chatProps = () => ({
  token: 'a', user: { id: 1 }, refreshKey: 0, setAuthError: noop, setIsLoginModalOpen: noop,
  setParticipationCampaign: noop, setSuccessToast: noop, successToastTimerRef: { current: null }, setRefreshKey: noop,
});
const notifyProps = () => ({ token: 'a', userId: 1, purchaseChatRoomRef: { current: null }, handleChatAccessRevoked: noop });

test('logout while saving a profile cannot restore the old user or token', async () => {
  const pending = deferred();
  const hook = await mountController('src/features/account/useAccount.js', {
    navigate: noop, setIsCreateCampaignOpen: noop,
  }, { updateCurrentUserProfile: () => pending.promise });
  hook.value.setProfileDraft({ displayName: 'Edited' }); hook.update();
  const saving = hook.value.handleSaveProfile();
  hook.value.handleLogout(); hook.update();
  pending.resolve(); await saving; await hook.settle();
  assert.equal(hook.value.token, '');
  assert.equal(hook.value.user, null);
  assert.equal(hook.auth.user, null);
  assert.equal(hook.value.isSavingProfile, false);
  hook.unmount(); assert.equal(hook.window.listenerCount(), 0);
});

test('LINE login ignores other origins and accepts the existing same-origin callback', async () => {
  const hook = await mountController('src/features/account/useAccount.js', { navigate: noop, setIsCreateCampaignOpen: noop });
  const data = { type: 'line-login-success', token: 'new-token', user: { id: 7, displayName: 'New' } };
  hook.window.dispatchEvent({ type: 'message', origin: 'https://other.example', data }); hook.update();
  assert.notEqual(hook.value.token, 'new-token');
  hook.window.dispatchEvent({ type: 'message', origin: 'http://localhost:5173', data }); hook.update();
  assert.equal(hook.value.token, 'new-token');
  assert.equal(hook.value.user.id, 7);
  assert.equal(hook.value.isProfileOpen, true);
  hook.unmount();
});

test('late chat loads cannot repopulate rooms after logout', async () => {
  const pending = deferred();
  const hook = await mountController('src/features/chat/useChatRooms.js', chatProps(), {
    fetchPurchaseChatRooms: () => pending.promise,
  });
  hook.value.setChatCampaign({ id: 5 }); hook.update();
  hook.update({ token: '', user: null });
  pending.resolve([{ id: 3, orderId: 4, unreadCount: 8 }]); await hook.settle();
  assert.equal(hook.value.chatRooms.length, 0);
  assert.equal(hook.value.chatCampaign, null);
  assert.equal(hook.value.chatUnreadRoomCount, 0);
  hook.unmount();
});

test('latest chat refresh wins and duplicate read callbacks only decrement once', async () => {
  const pending = deferred(); let calls = 0;
  const hook = await mountController('src/features/chat/useChatRooms.js', chatProps(), {
    fetchPurchaseChatRooms: () => ++calls === 1 ? pending.promise : Promise.resolve([{ id: 3, orderId: 4, unreadCount: 2 }]),
    fetchPurchaseChatUnreadCount: async () => ({ unreadCount: 5 }),
  });
  await hook.value.loadOpenChatRooms(); await hook.settle();
  pending.resolve([{ id: 99 }]); await hook.settle();
  assert.equal(hook.value.chatRooms[0].id, 3);
  hook.value.markPurchaseRoomAsRead(3); hook.value.markPurchaseRoomAsRead(3); hook.update();
  assert.equal(hook.value.chatUnreadRoomCount, 3);
  hook.value.setChatCampaign({ id: 5 }); hook.update();
  hook.update({ token: 'refreshed-same-user' });
  assert.equal(hook.value.chatCampaign.id, 5, 'token refresh must not close the active room');
  hook.unmount();
});

test('live notifications survive stale queries; logout clears timers and disconnects the socket', async () => {
  const pending = deferred();
  const hook = await mountController('src/features/notifications/useNotifications.js', notifyProps(), {
    fetchUnreadNotifications: () => pending.promise,
  });
  await hook.settle();
  assert.equal(hook.clients.length, 1);
  hook.clients[0].push('/user/queue/notifications', { id: 9, type: 'INQUIRY_ANSWER', referenceId: 4 });
  hook.update();
  pending.resolve([]); await hook.settle();
  assert.equal(hook.value.notifications[0].id, 9);
  assert.equal(hook.value.liveNotifications.length, 1);
  hook.update({ token: '', userId: null }); await hook.settle();
  assert.equal(hook.value.notifications.length, 0);
  assert.equal(hook.value.liveNotifications.length, 0);
  assert.equal(hook.clients[0].deactivated, true);
  assert.equal(hook.timers.size, 0);
  hook.unmount();
  assert.equal(hook.window.listenerCount(), 0);
  assert.equal(hook.document.listenerCount(), 0);
});

test('active purchase chat notifications are read without toast and access events reach chat owner', async () => {
  const reads = [], revoked = [];
  const props = notifyProps(); props.purchaseChatRoomRef.current = { orderId: 4 };
  props.handleChatAccessRevoked = payload => revoked.push(payload.campaignId);
  const hook = await mountController('src/features/notifications/useNotifications.js', props, {
    markNotificationRead: async id => reads.push(id),
  });
  await hook.settle();
  hook.clients[0].push('/user/queue/notifications', { id: 9, type: 'PURCHASE_CHAT_MESSAGE', referenceId: 4 });
  hook.clients[0].push('/user/queue/chat-access', { type: 'CHAT_ACCESS_REVOKED', campaignId: 8 });
  await hook.settle();
  assert.deepEqual(reads, [9]); assert.deepEqual(revoked, [8]);
  assert.equal(hook.value.liveNotifications.length, 0);
  assert.equal(hook.value.notifications.length, 0);
  hook.unmount();
});

test('mark-read cannot update another account and pending read history cannot erase a newly read item', async () => {
  const history = deferred(), marking = deferred();
  const hook = await mountController('src/features/notifications/useNotifications.js', notifyProps(), {
    fetchReadNotifications: () => history.promise,
    markNotificationRead: id => id === 1 ? Promise.resolve() : marking.promise,
  });
  await hook.value.markNotificationAsRead(1, { id: 1 }); hook.update();
  history.resolve([]); await hook.settle();
  assert.equal(hook.value.readNotifications[0].id, 1);
  const pending = hook.value.markNotificationAsRead(2, { id: 2 });
  hook.update({ token: 'b', userId: 2 });
  marking.resolve(); await pending; await hook.settle();
  assert.equal(hook.value.readNotifications.length, 0);
  hook.unmount();
});

function navigationProps() {
  return {
    token: 'a', user: { id: 1 }, chatRooms: [], chatReturnContextRef: { current: null },
    setChatRoomsError: noop, markPurchaseRoomAsRead: noop, hidePurchaseChatNotifications: noop,
    setPurchaseChatRoom: noop, setIsChatRoomsOpen: noop, setIsLoginModalOpen: noop,
    showSuccessToast: noop, setCampaignError: noop, refreshMineCampaignsBeforeOpen: async room => room,
    markCampaignChatNotificationsAsRead: async () => {}, markChatRoomAsRead: noop,
    setChatCampaign: noop, handleOpenParticipation: async () => {}, participationCampaign: null,
    setParticipationCampaign: noop, setParticipationQuantityDraft: noop, setParticipationError: noop,
    setIsNotificationsOpen: noop, loadOpenChatRooms: noop, setPurchaseOrderFromChat: noop,
  };
}

test('purchase chat returns to notifications or the chat list, and an old open request cannot reopen after logout', async () => {
  const props = navigationProps(), events = [], pending = deferred();
  props.setIsNotificationsOpen = open => events.push(['notifications', open]);
  props.setIsChatRoomsOpen = open => events.push(['rooms', open]);
  props.setPurchaseChatRoom = room => events.push(['purchase', room?.id ?? null]);
  const hook = await mountController('src/features/chat/useChatNavigation.js', props, {
    fetchPurchaseChatRooms: async () => [{ id: 3, orderId: 4 }],
    markPurchaseChatRoomRead: id => id === 99 ? pending.promise : Promise.resolve(),
  });
  assert.equal(await hook.value.handleOpenPurchaseChat({ orderId: 4 }, { returnContext: { type: 'NOTIFICATIONS' } }), true);
  hook.value.handleClosePurchaseChat();
  assert.deepEqual(events.at(-1), ['notifications', true]);
  await hook.value.handleOpenChatRoom({ roomType: 'PURCHASE', id: 3, orderId: 4 });
  hook.value.handleClosePurchaseChat();
  assert.deepEqual(events.at(-1), ['rooms', true]);
  const opening = hook.value.handleOpenChatRoom({ roomType: 'PURCHASE', id: 99 });
  hook.update({ token: '' }); const count = events.length;
  pending.resolve(); await opening;
  assert.equal(events.length, count);
  hook.unmount();
});

test('notification actions retain inquiry, order, chat and participation destinations', async () => {
  const events = [];
  const hook = await mountController('src/features/notifications/useNotificationNavigation.js', {
    ...navigationProps(),
    markNotificationAsRead: async id => events.push(['read', id]),
    setInquiryTargetId: id => events.push(['inquiry', id]),
    switchActiveType: type => events.push(['tab', type]),
    handleOpenPurchaseChat: async (source, options) => { events.push(['chat', source.orderId, options.returnContext.type]); return true; },
    setPurchaseOrderFromChat: order => events.push(['order', order.id, order.returnToNotifications]),
    findCampaignForNotification: async id => ({ id }),
    handleOpenParticipation: async campaign => events.push(['participation', campaign.id]),
    handleOpenReview: noop, setNotificationsError: noop, dismissLiveNotification: noop,
  });
  await hook.value.handleNotificationAction({ id: 1, type: 'INQUIRY_NEW_ANSWER', referenceId: 10 });
  await hook.value.handleNotificationAction({ id: 2, type: 'PURCHASE_ORDER_STARTED', referenceId: 20 }, { returnToNotifications: true });
  await hook.value.handleNotificationAction({ id: 3, type: 'PURCHASE_CHAT_MESSAGE', referenceId: 30 }, { returnToNotifications: true });
  await hook.value.handleNotificationAction({ id: 4, type: 'CAMPAIGN_FULL', referenceId: 40 });
  assert.deepEqual(events, [
    ['read', 1], ['inquiry', 10], ['tab', 'INQUIRY'], ['read', 2], ['order', 20, true],
    ['read', 3], ['chat', 30, 'NOTIFICATIONS'], ['read', 4], ['participation', 40],
  ]);
  hook.unmount();
});

test('profile navigation restores the original route context but gives explicit notification targets priority', async () => {
  const events = [], navigations = [];
  const props = {
    ...navigationProps(), location: { pathname: '/mine', state: null }, navigate: (...args) => navigations.push(args),
    setActiveCampaignType: noop, setActiveCategory: noop, setHideFullCampaigns: noop,
    setActiveStoreIds: noop, setActiveMyCampaignFilter: noop, setActiveMyCampaignScope: noop,
    setSearch: search => events.push(['search', search]), setChatCampaign: room => events.push(['chat', room.id]),
    isInitialLoading: false, chatCampaign: { id: 8 }, campaigns: [], activeType: 'MINE', search: 'apples',
    setAuthError: noop, setIsProfileOpen: noop,
  };
  const context = { source: 'chat', path: '/mine', scrollY: 80, campaign: { id: 8 }, ui: { search: 'saved' } };
  const hook = await mountController('src/features/account/useProfileNavigation.js', props, {}, {
    profile_return_context: JSON.stringify(context),
  });
  assert.deepEqual(events, [['search', 'saved'], ['chat', 8]]);
  assert.equal(hook.storage.has('profile_return_context'), false);
  hook.value.handleOpenUserProfile({ id: 7 }, 'chat');
  assert.equal(navigations[0][0], '/users/7');
  assert.equal(JSON.parse(hook.storage.get('profile_return_context')).path, '/mine');
  hook.unmount(); assert.equal(hook.timers.size, 0);
  events.length = 0;
  const explicit = await mountController('src/features/account/useProfileNavigation.js', {
    ...props, location: { pathname: '/mine', state: { focusCampaignId: 99 } },
  }, {}, { profile_return_context: JSON.stringify(context) });
  assert.deepEqual(events, []);
  explicit.unmount();
});

test('revoked chat access closes the room and clears its return context', async () => {
  const props = chatProps(); let participation = { id: 7, chatAccess: 'READ_WRITE' };
  props.setParticipationCampaign = update => { participation = update(participation); };
  const hook = await mountController('src/features/chat/useChatRooms.js', props);
  await hook.settle();
  hook.value.setChatCampaign({ id: 7 }); hook.update();
  hook.value.chatReturnContextRef.current = { type: 'PARTICIPATION', campaign: participation };
  hook.value.handleChatAccessRevoked({ campaignId: 7 }); hook.update();
  assert.equal(hook.value.chatCampaign, null);
  assert.equal(hook.value.chatReturnContextRef.current, null);
  assert.equal(participation.chatAccess, 'NONE');
  hook.unmount();
});
