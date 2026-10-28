// Test-only, in-browser shared store. No Firebase network requests are made.
const listeners = new Set<{ path: string; next: (snapshot: any) => void }>();
const key = (path: string) => `fixture_doc_${path}`;
const read = (path: string) => JSON.parse(localStorage.getItem(key(path)) || 'null');
const snapshot = (path: string) => ({
  exists: () => read(path) !== null,
  data: () => read(path),
  metadata: { fromCache: localStorage.getItem('fixture_offline') === 'true' },
});
const notify = (path?: string) => listeners.forEach(listener => {
  if (!path || listener.path === path) listener.next(snapshot(listener.path));
});
window.addEventListener('storage', event => {
  if (event.key?.startsWith('fixture_doc_')) notify(event.key.slice('fixture_doc_'.length));
  else if (event.key === 'fixture_offline') notify();
});

export const getFirestore = (app: unknown) => ({ app });
export const doc = (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') });
export const getDoc = async (ref: { path: string }) => snapshot(ref.path);
export const onSnapshot = (ref: { path: string }, optionsOrNext: any, nextOrError: any, error?: any) => {
  const next = typeof optionsOrNext === 'function' ? optionsOrNext : nextOrError;
  const fail = typeof optionsOrNext === 'function' ? nextOrError : error;
  const listener = { path: ref.path, next };
  listeners.add(listener);
  queueMicrotask(() => {
    if (!listeners.has(listener)) return;
    if (localStorage.getItem('fixture_read_error') === 'true') fail?.(new Error('permission-denied'));
    else next(snapshot(ref.path));
  });
  return () => listeners.delete(listener);
};

const merge = (target: any, patch: any): any => {
  const result = { ...target };
  for (const [field, value] of Object.entries(patch)) {
    result[field] = value && typeof value === 'object' && !Array.isArray(value) ? merge(result[field], value) : value;
  }
  return result;
};
const write = async (ref: { path: string }, data: any, options?: { merge: boolean }) => {
  if (localStorage.getItem('fixture_reject_write') === 'true') throw new Error('permission-denied');
  const writes = JSON.parse(localStorage.getItem('fixture_writes') || '[]');
  writes.push({ path: ref.path, data, options });
  localStorage.setItem('fixture_writes', JSON.stringify(writes));
  localStorage.setItem(key(ref.path), JSON.stringify(data));
  notify(ref.path);
};
export const setDoc = async (ref: { path: string }, data: any, options?: { merge: boolean }) =>
  write(ref, options?.merge ? merge(read(ref.path), data) : data, options);
export class FieldPath { parts: string[]; constructor(...parts: string[]) { this.parts = parts; } }
export const deleteField = () => 'DELETE_FIELD';
export const updateDoc = async (ref: { path: string }, path: FieldPath, _value: unknown) => {
  const data = read(ref.path) || {};
  delete data[path.parts[0]]?.[path.parts[1]];
  await write(ref, data);
};
