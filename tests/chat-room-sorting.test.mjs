import assert from 'node:assert/strict';
import test from 'node:test';
import { compareChatRooms, getChatRoomUnreadCount, isChatRoomEnded, isChatRoomReadOnly } from '../src/chatRoomSorting.js';

test('writable rooms precede read-only rooms across room types, newest first within each group', () => {
  const rooms = [
    { id: 'purchase-read', roomType: 'PURCHASE', readOnly: true, time: 100 },
    { id: 'campaign-write', roomType: 'CAMPAIGN', chatAccess: 'READ_WRITE', time: 10 },
    { id: 'campaign-read', roomType: 'CAMPAIGN', chatAccess: 'READ_ONLY', time: 200 },
    { id: 'purchase-write', roomType: 'PURCHASE', readOnly: false, time: 20 },
  ];
  const sorted = [...rooms].sort((a, b) => compareChatRooms(a, b, (room) => room.time));
  assert.deepEqual(sorted.map((room) => room.id), [
    'purchase-write', 'campaign-write', 'campaign-read', 'purchase-read',
  ]);
});

test('read-only detection supports API field aliases and missing flags', () => {
  assert.equal(isChatRoomReadOnly({ roomType: 'PURCHASE', read_only: true }), true);
  assert.equal(isChatRoomReadOnly({ chat_access: ' read_only ' }), true);
  assert.equal(isChatRoomReadOnly({ roomType: 'PURCHASE' }), false);
  assert.equal(isChatRoomReadOnly({}), false);
});

test('equal access and time retain the existing room order', () => {
  const rooms = [{ id: 1 }, { id: 2 }];
  assert.deepEqual([...rooms].sort((a, b) => compareChatRooms(a, b, () => 0)), rooms);
});

test('completed writable rooms belong to ended while pending deliveries and disputes remain active', () => {
  assert.equal(isChatRoomEnded({ roomType: 'PURCHASE', orderStatus: 'COMPLETED', readOnly: false }), true);
  assert.equal(isChatRoomReadOnly({ roomType: 'PURCHASE', orderStatus: 'COMPLETED', readOnly: false }), false);
  for (const status of ['CANCELLED', 'UNAVAILABLE_CANCELLED', 'PENALIZED_CANCELLED', 'DISPUTE_CLOSED_NO_PENALTY']) {
    assert.equal(isChatRoomEnded({ roomType: 'PURCHASE', orderStatus: status }), true);
  }
  for (const status of ['IN_PROGRESS', 'DELIVERED_PENDING_CONFIRM', 'ABNORMAL_PENDING_RESPONSE']) {
    assert.equal(isChatRoomEnded({ roomType: 'PURCHASE', orderStatus: status }), false);
  }
  assert.equal(isChatRoomEnded({ status: 'COMPLETED' }), true);
  assert.equal(isChatRoomEnded({ status: 'FULL', chatAccess: 'READ_ONLY' }), true);
  assert.equal(isChatRoomEnded({ status: 'DELIVERED', chatAccess: 'READ_WRITE' }), false);
});

test('each tab counts unread messages including ended rooms', () => {
  const rooms = [
    { status: 'FULL', unreadMessageCount: 2 },
    { roomType: 'PURCHASE', orderStatus: 'COMPLETED', unreadCount: 3 },
    { chat_access: 'READ_ONLY', unreadMessageCount: 4 },
  ];
  assert.equal(rooms.filter(isChatRoomEnded).reduce((sum, room) => sum + getChatRoomUnreadCount(room), 0), 7);
  assert.equal(rooms.filter((room) => !isChatRoomEnded(room)).reduce((sum, room) => sum + getChatRoomUnreadCount(room), 0), 2);
  assert.equal(getChatRoomUnreadCount({ unreadCount: 'bad' }), 0);
});
