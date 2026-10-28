import { useEffect, useRef, useState } from 'react';
import type { FirebaseConfig, PaidLeaveMap } from './types';
import { isValidDate, paidLeaveKey, parsePaidLeaves } from './paidLeave';

// A separate document also protects leave data from older roster clients' full writes.
export const usePaidLeave = (config: FirebaseConfig | null) => {
  const [leaves, setLeaves] = useState<PaidLeaveMap>({});
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const writer = useRef<((personId: string, date: string, remove: boolean) => Promise<void>) | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const cacheKey = `wb_paid_leaves_${config?.projectId || 'local'}`;
    setReady(false);
    setError('');
    writer.current = null;
    try { setLeaves(parsePaidLeaves(JSON.parse(localStorage.getItem(cacheKey) || '{}'))); }
    catch { setLeaves({}); }

    const connect = async () => {
      if (!config) return;
      try {
        const { initializeApp, getApps } = await import('firebase/app');
        const { getFirestore, doc, onSnapshot, setDoc, updateDoc, deleteField, FieldPath } = await import('firebase/firestore');
        if (!active) return;
        const app = getApps().find(app => app.name === 'whiteboard-app') || initializeApp(config, 'whiteboard-app');
        const board = doc(getFirestore(app), 'app_data', 'shared_paid_leaves');
        writer.current = async (personId, date, remove) => {
          const key = paidLeaveKey(personId, date);
          if (remove) await updateDoc(board, new FieldPath('entries', key), deleteField());
          else await setDoc(board, { entries: { [key]: { personId, date } } }, { merge: true });
        };
        unsubscribe = onSnapshot(board, { includeMetadataChanges: true }, snapshot => {
          if (!active) return;
          const data = parsePaidLeaves(snapshot.data()?.entries);
          setLeaves(data);
          setReady(!snapshot.metadata.fromCache);
          setError('');
          localStorage.setItem(cacheKey, JSON.stringify(data));
        }, () => {
          if (!active) return;
          setReady(false);
          setError('有給休暇を取得できませんでした。接続と共有設定を確認してください。');
        });
      } catch {
        if (active) {
          setReady(false);
          setError('有給休暇の共有データに接続できませんでした。');
        }
      }
    };
    void connect();
    return () => { active = false; unsubscribe?.(); writer.current = null; };
  }, [config]);

  const save = async (personId: string, date: string, remove = false): Promise<boolean> => {
    if (savingRef.current) return false;
    if (!ready || !writer.current) {
      setError('共有データに接続してから登録・取消してください。');
      return false;
    }
    if (!personId || !isValidDate(date)) return false;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await writer.current(personId, date, remove);
      return true;
    } catch {
      setError('有給休暇を保存できませんでした。接続と書き込み権限を確認し、もう一度お試しください。');
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return { leaves, ready, saving, error, save };
};
