import type { PaidLeaveMap, Person } from './types';

const DAY = 24 * 60 * 60 * 1000;

export const japanDate = (timestamp: string = new Date().toISOString()): string => {
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) throw new Error('更新日時が正しくありません。');
  return new Date(time + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

export const isValidDate = (date: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;

export const addDays = (date: string, days: number): string => {
  if (!isValidDate(date)) throw new Error('日付が正しくありません。');
  return new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);
};

export const nextAllocationDate = (updatedAt: string): string => addDays(japanDate(updatedAt), 1);
export const paidLeaveKey = (personId: string, date: string): string => `${personId}_${date}`;

export const parsePaidLeaves = (value: unknown): PaidLeaveMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: PaidLeaveMap = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry && typeof entry === 'object' && typeof entry.personId === 'string' &&
        typeof entry.date === 'string' && isValidDate(entry.date) &&
        key === paidLeaveKey(entry.personId, entry.date)) result[key] = entry;
  }
  return result;
};

export const peopleOnLeave = (people: Person[], leaves: PaidLeaveMap, date: string): Person[] =>
  people.filter(person => Boolean(leaves[paidLeaveKey(person.id, date)]));

export const allocationConflicts = (people: Person[], leaves: PaidLeaveMap, date: string): Person[] =>
  peopleOnLeave(people, leaves, date).filter(person => person.siteId && person.siteId !== 'yasumi');

export const formatLeaveDate = (date: string): string =>
  new Intl.DateTimeFormat('ja-JP', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(date));

export const monthDays = (month: string): (string | null)[] => {
  const first = `${month}-01`;
  if (!isValidDate(first)) throw new Error('月が正しくありません。');
  const start = new Date(first);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const days: (string | null)[] = Array(start.getUTCDay()).fill(null);
  for (let day = 1; day <= end.getUTCDate(); day++) days.push(`${month}-${String(day).padStart(2, '0')}`);
  while (days.length % 7) days.push(null);
  return days;
};

export const shiftMonth = (month: string, offset: number): string => {
  const date = new Date(`${month}-01`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1)).toISOString().slice(0, 7);
};
