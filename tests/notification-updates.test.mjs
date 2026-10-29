import assert from 'node:assert/strict';
import test from 'node:test';
import { prependNotification } from '../src/notificationUpdates.js';

test('an answer push appears immediately even if the unread API still has no record', () => {
  const answer = { id: 12, type: 'INQUIRY_NEW_ANSWER', referenceId: 7 };
  const previous = [];
  assert.deepEqual(prependNotification(previous, answer), [answer]);
  assert.deepEqual(previous, []);
});

test('redelivery does not inflate the bell count and separate answers remain visible', () => {
  const first = { id: 12, type: 'INQUIRY_NEW_ANSWER', referenceId: 7 };
  const second = { id: 13, type: 'INQUIRY_NEW_ANSWER', referenceId: 7 };
  const current = prependNotification([first], second);
  assert.deepEqual(prependNotification(current, { ...second, id: '13' }), [
    { ...second, id: '13' }, first,
  ]);
});

test('purchase chat pushes continue to count each room once', () => {
  const old = { id: 1, type: 'PURCHASE_CHAT_MESSAGE', referenceId: 7 };
  const latest = { id: 2, type: 'PURCHASE_CHAT_MESSAGE', referenceId: '7' };
  const other = { id: 3, type: 'INQUIRY_NEW_ANSWER', referenceId: 7 };
  assert.deepEqual(prependNotification([old, other], latest), [latest, other]);
});
