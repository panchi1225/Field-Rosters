const test = require('node:test');
const assert = require('node:assert/strict');
const { japanDate, nextAllocationDate, isValidDate, paidLeaveKey, parsePaidLeaves,
  peopleOnLeave, allocationConflicts, monthDays, shiftMonth } = require('../.test-build/paidLeave.js');

test('uses Japan date before and after midnight, independent of device timezone', () => {
  assert.equal(japanDate('2026-10-28T14:59:59Z'), '2026-10-28');
  assert.equal(japanDate('2026-10-28T15:00:00Z'), '2026-10-29');
  assert.equal(nextAllocationDate('2026-10-28T14:59:59Z'), '2026-10-29');
  assert.equal(nextAllocationDate('2026-10-28T15:00:00Z'), '2026-10-30');
});

test('next day handles month end, year end, and leap day', () => {
  assert.equal(nextAllocationDate('2026-12-31T12:00:00+09:00'), '2027-01-01');
  assert.equal(nextAllocationDate('2028-02-28T12:00:00+09:00'), '2028-02-29');
  assert.equal(nextAllocationDate('2028-02-29T12:00:00+09:00'), '2028-03-01');
  assert.equal(nextAllocationDate('2026-02-28T12:00:00+09:00'), '2026-03-01');
  assert.throws(() => nextAllocationDate('invalid'));
});

test('calendar dates are valid and align with Sunday through Saturday', () => {
  const days = monthDays('2026-10');
  assert.equal(days.length % 7, 0);
  assert.equal(days.indexOf('2026-10-01'), 4);
  assert.equal(days.filter(Boolean).length, 31);
  assert.equal(monthDays('2028-02').filter(Boolean).length, 29);
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2027-01', -1), '2026-12');
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('2026-1-01'), false);
});

test('legacy documents without leave data and malformed records are safe', () => {
  assert.deepEqual(parsePaidLeaves(undefined), {});
  assert.deepEqual(parsePaidLeaves('[]'), {});
  assert.deepEqual(parsePaidLeaves([]), {});
  assert.deepEqual(parsePaidLeaves({ 'a_2026-10-29': { personId: 'a', date: '2026-10-29' },
    wrongKey: { personId: 'b', date: '2026-10-29' }, badDate: { personId: 'a', date: '2026-02-30' }, bad: null }),
    { 'a_2026-10-29': { personId: 'a', date: '2026-10-29' } });
});

test('matches by stable person id and exact date; resting people are not placement conflicts', () => {
  const people = [
    { id: 'a', name: '同姓同名', siteId: 'site-a' },
    { id: 'b', name: '同姓同名', siteId: 'yasumi' },
    { id: 'c', name: '未配置', siteId: null },
    { id: 'd', name: '別日', siteId: 'site-a' },
  ];
  const leaves = {};
  for (const person of people) {
    const date = person.id === 'd' ? '2026-10-30' : '2026-10-29';
    leaves[paidLeaveKey(person.id, date)] = { personId: person.id, date };
  }
  leaves[paidLeaveKey('deleted', '2026-10-29')] = { personId: 'deleted', date: '2026-10-29' };
  assert.deepEqual(peopleOnLeave(people, leaves, '2026-10-29').map(p => p.id), ['a', 'b', 'c']);
  assert.deepEqual(allocationConflicts(people, leaves, '2026-10-29').map(p => p.id), ['a']);
  assert.deepEqual(allocationConflicts(people, leaves, '2026-10-31'), []);
});
