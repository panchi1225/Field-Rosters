import React, { useRef, useState } from 'react';
import { Lock, LockOpen, Megaphone, X } from 'lucide-react';

interface Props {
  isAdmin: boolean;
  onAdminChange: (enabled: boolean) => void;
  updatedBy: string;
}

// Restored from the production bundle that preceded the paid-leave release.
export default function LegacyHeaderControls({ isAdmin, onAdminChange, updatedBy }: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const sendingRef = useRef(false);

  const toggleAdmin = () => {
    if (isAdmin) {
      if (!window.confirm('管理者モードを解除しますか？')) return;
      onAdminChange(false);
      window.alert('管理者モードを解除しました');
      return;
    }
    const input = window.prompt('管理者パスワードを入力');
    if (input === '4043') {
      onAdminChange(true);
      window.alert('管理者モードを有効にしました');
    } else if (input !== null) window.alert('パスワードが違います');
  };

  const sendNotification = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sendingRef.current) return;
    if (password !== '4043') { setPasswordError(true); return; }
    sendingRef.current = true;
    setSending(true);
    setSendError('');
    const now = new Date();
    const parts = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || '';
    const time = `${part('month')}月${part('day')}日(${part('weekday')}) ${part('hour')}：${part('minute')}`;
    try {
      const response = await fetch('https://lineworks-proxy.paaaaanchi1225.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '現場配置表通知',
          text: `【現場配置 更新】\n更新日時：${time}\n更新者：${updatedBy}\n\n現場配置が更新されました❗️\n✅朝礼までに確認してください。`,
          button: { label: '▼ 配置確認はこちら', url: 'https://panchi1225.github.io/Field-Rosters/' },
        }),
      });
      if (!response.ok) throw new Error(`Notification failed: ${response.status}`);
      setSent(true);
      window.setTimeout(() => { setOpen(false); setPassword(''); setSent(false); }, 2000);
    } catch {
      setSendError('通知の送信に失敗しました。もう一度お試しください。');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return <>
    <button type="button" aria-label={isAdmin ? '管理者解除' : '管理者認証'} aria-pressed={isAdmin} title={isAdmin ? '管理者モードを解除' : '管理者認証'} onClick={toggleAdmin} className={`w-11 h-10 flex items-center justify-center rounded-lg text-white shadow-sm ${isAdmin ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-600 hover:bg-yellow-700'}`}>
      {isAdmin ? <LockOpen className="w-5 h-5" aria-hidden="true" /> : <Lock className="w-5 h-5" aria-hidden="true" />}
    </button>
    <button type="button" aria-label="LINE通知" title="通知配信" onClick={() => { setOpen(true); setPassword(''); setPasswordError(false); setSent(false); setSendError(''); }} className="w-11 h-10 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm">
      <Megaphone className="w-5 h-5" aria-hidden="true" />
    </button>
    {open && <div role="dialog" aria-modal="true" aria-labelledby="line-notification-title" className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 id="line-notification-title" className="text-lg font-bold text-gray-800">📣 LINE WORKS 通知</h2>
          <button type="button" aria-label="通知を閉じる" disabled={sending} onClick={() => setOpen(false)} className="p-1 text-gray-600"><X size={20} /></button>
        </div>
        {sent ? <p role="status" className="text-center py-8 text-lg font-bold text-green-700">通知を送信しました</p> : <form onSubmit={sendNotification}>
          <p className="text-sm text-gray-600 text-center mb-4">配置更新の通知を送信します。<br />パスワードを入力してください。</p>
          <label className="sr-only" htmlFor="line-notification-password">通知配信パスワード</label>
          <input id="line-notification-password" type="password" autoComplete="off" value={password} onChange={event => { setPassword(event.target.value); setPasswordError(false); }} disabled={sending} placeholder="パスワード" className={`w-full border ${passwordError ? 'border-red-500' : 'border-gray-300'} rounded-lg px-4 py-3 text-center text-lg`} />
          {passwordError && <p role="alert" className="text-red-600 text-sm text-center mt-2">パスワードが違います</p>}
          {sendError && <p role="alert" className="text-red-600 text-sm text-center mt-2">{sendError}</p>}
          <div className="flex gap-3 mt-4">
            <button type="button" disabled={sending} onClick={() => setOpen(false)} className="flex-1 py-3 rounded-lg border text-gray-700 font-bold">キャンセル</button>
            <button type="submit" disabled={sending} className="flex-1 py-3 rounded-lg bg-green-600 text-white font-bold disabled:opacity-50">{sending ? '送信中...' : '送信'}</button>
          </div>
        </form>}
      </div>
    </div>}
  </>;
}
