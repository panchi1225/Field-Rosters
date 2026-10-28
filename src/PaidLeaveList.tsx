import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays, Check, Plus, X } from 'lucide-react';
import type { PaidLeaveMap, Person } from './types';
import { addDays, formatLeaveDate, japanDate, paidLeaveKey, peopleOnLeave } from './paidLeave';

interface Props {
  people: Person[];
  leaves: PaidLeaveMap;
  ready: boolean;
  saving: boolean;
  error: string;
  onSave: (personId: string, date: string, remove?: boolean) => Promise<boolean>;
  onClose: () => void;
}

export default function PaidLeaveList({ people, leaves, ready, saving, error, onSave, onClose }: Props) {
  const today = japanDate();
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const initialScrollRef = useRef(true);
  const prependRef = useRef<{ height: number; top: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const [range, setRange] = useState(() => ({ start: addDays(today, -35), end: addDays(today, 90) }));
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [personId, setPersonId] = useState('');
  const [message, setMessage] = useState('');
  const sortedPeople = [...people].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  const dates: string[] = [];
  for (let date = range.start; date <= range.end; date = addDays(date, 1)) dates.push(date);

  const scrollToDate = (date: string) => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-leave-date="${date}"]`);
    if (list && row) { list.scrollTop = row.offsetTop; setVisibleMonth(date.slice(0, 7)); }
  };

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (initialScrollRef.current) {
      scrollToDate(today);
      initialScrollRef.current = false;
    } else if (prependRef.current) {
      list.scrollTop = prependRef.current.top + list.scrollHeight - prependRef.current.height;
      prependRef.current = null;
    }
  }, [range, today]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); previous?.focus(); };
  }, []);

  useEffect(() => {
    if (selectedDate) pickerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [selectedDate]);

  const closePicker = () => {
    if (saving) return;
    setSelectedDate(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        event.preventDefault();
        if (selectedDate) closePicker(); else onClose();
      }
      if (event.key !== 'Tab') return;
      const root = selectedDate ? pickerRef.current : dialogRef.current;
      const controls = [...(root?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') || [])];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [onClose, saving, selectedDate]);

  const extendDates = (direction: 'before' | 'after') => {
    const list = listRef.current;
    if (direction === 'before') {
      if (!list || prependRef.current) return;
      prependRef.current = { height: list.scrollHeight, top: list.scrollTop };
      setRange(current => ({ ...current, start: addDays(current.start, -35) }));
    } else setRange(current => ({ ...current, end: addDays(current.end, 60) }));
  };

  const handleScroll = () => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const list = listRef.current;
      if (!list) return;
      const firstVisible = [...list.querySelectorAll<HTMLElement>('[data-leave-date]')].find(row => row.offsetTop + row.offsetHeight > list.scrollTop + 1);
      if (firstVisible?.dataset.leaveDate) setVisibleMonth(firstVisible.dataset.leaveDate.slice(0, 7));
      if (list.scrollTop < 160) extendDates('before');
      else if (list.scrollHeight - list.scrollTop - list.clientHeight < 240) extendDates('after');
    });
  };

  return <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="paid-leave-title" className="fixed inset-0 z-[150] bg-gray-50 flex flex-col overflow-hidden h-[100dvh]">
    <header className="bg-white border-b px-3 py-3 md:px-6 md:py-4 shrink-0">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        <h2 id="paid-leave-title" className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2"><CalendarDays className="text-blue-600" />有給休暇</h2>
        <button type="button" aria-label="有給休暇を閉じる" title="閉じる" onClick={onClose} disabled={saving} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-40"><X /></button>
      </div>
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 mt-2">
        <h3 className="text-lg font-bold text-gray-800 tabular-nums" aria-live="polite">{Number(visibleMonth.slice(0, 4))}年{Number(visibleMonth.slice(5))}月</h3>
        <button type="button" onClick={() => scrollToDate(today)} className="text-sm border border-blue-200 rounded-lg px-3 py-2 text-blue-700 hover:bg-blue-50">今日</button>
      </div>
      <p className="max-w-4xl mx-auto text-xs text-gray-500 mt-2">日付をタップして登録 ／ 名前をタップして取消</p>
    </header>
    {!ready && <p role="status" className="shrink-0 px-3 py-2 bg-amber-50 border-b border-amber-300 text-xs text-amber-950">有給休暇の最新情報を確認中です。接続後に登録・取消できます。表示中の内容は保存済みの情報です。</p>}
    {error && !selectedDate && <p role="alert" className="shrink-0 px-3 py-2 bg-red-50 text-sm text-red-700">{error}</p>}
    <div ref={listRef} onScroll={handleScroll} role="region" aria-label="有給休暇の日付一覧" tabIndex={0} className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain bg-white" style={{ overflowAnchor: 'none' }}>
      <div className="max-w-4xl mx-auto border-x border-gray-200">
        <button type="button" onClick={() => extendDates('before')} className="w-full py-3 text-xs text-gray-500 bg-gray-50 border-b">前の日付を表示</button>
        {dates.map(date => {
          const weekday = new Date(date).getUTCDay();
          const members = peopleOnLeave(sortedPeople, leaves, date);
          return <div key={date} data-leave-date={date} className={`grid grid-cols-[84px_minmax(0,1fr)] md:grid-cols-[112px_minmax(0,1fr)] min-h-[88px] border-b border-gray-300 ${date === today ? 'bg-blue-50/60' : 'bg-white'}`}>
            <button type="button" disabled={!ready || saving} aria-label={`${formatLeaveDate(date)}に有給休暇を登録`} onClick={event => { returnFocusRef.current = event.currentTarget; setPersonId(''); setMessage(''); setSelectedDate(date); }} className="px-2 py-2 border-r border-gray-300 flex items-center justify-center gap-2 hover:bg-blue-100 focus-visible:outline-blue-600 disabled:opacity-50">
              <span className="flex flex-col items-center"><span className="text-[10px] md:text-xs text-gray-500">{Number(date.slice(5, 7))}月</span><span className={`text-3xl md:text-4xl font-extrabold leading-tight tabular-nums ${date === today ? 'text-blue-700' : 'text-gray-900'}`}>{Number(date.slice(8))}</span></span>
              <span className={`text-lg md:text-xl font-bold ${weekday === 0 ? 'text-red-600' : weekday === 6 ? 'text-blue-600' : 'text-gray-700'}`}>{['日', '月', '火', '水', '木', '金', '土'][weekday]}</span>
            </button>
            <div className="min-w-0 p-2 md:p-3 flex flex-wrap content-center items-center gap-2" aria-label={`${formatLeaveDate(date)}の有給休暇者 ${members.length}名`}>
              {members.map(person => <button key={person.id} type="button" aria-label={`${formatLeaveDate(date)}の${person.name}の有給を取り消す`} title="タップして有給を取り消す" disabled={!ready || saving} onClick={async () => {
                if (!window.confirm(`${formatLeaveDate(date)}の${person.name}さんの有給休暇を取り消しますか？`)) return;
                setMessage('');
                if (await onSave(person.id, date, true)) setMessage('有給休暇を取り消しました。');
              }} className="max-w-full bg-yellow-200 hover:bg-yellow-300 border border-yellow-400 rounded px-3 py-2 text-base md:text-lg font-bold text-gray-900 shadow-sm break-words text-left disabled:opacity-50">{person.name}</button>)}
            </div>
          </div>;
        })}
        <button type="button" onClick={() => extendDates('after')} className="w-full py-3 text-xs text-gray-500 bg-gray-50">先の日付を表示</button>
      </div>
    </div>
    {message && <p role="status" className="shrink-0 px-4 py-3 border-t border-green-200 bg-green-50 text-sm text-green-800 font-bold">{message}</p>}
    {selectedDate && <div className="absolute inset-0 bg-black/50 z-10 flex items-end md:items-center justify-center md:p-4">
      <div ref={pickerRef} role="dialog" aria-modal="true" aria-labelledby="paid-leave-picker-title" className="bg-white w-full max-w-lg rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col max-h-[85dvh]">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-3 shrink-0">
          <div><h3 id="paid-leave-picker-title" className="text-lg font-bold text-gray-800">{formatLeaveDate(selectedDate)}</h3><p className="text-sm text-gray-500 mt-1">登録する人員を選択</p></div>
          <button type="button" aria-label="人員選択を閉じる" disabled={saving} onClick={closePicker} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"><X /></button>
        </div>
        {error && <p role="alert" className="px-4 py-2 text-sm text-red-700 bg-red-50">{error}</p>}
        <div role="radiogroup" aria-label="有給休暇を取る人員" className="overflow-y-auto p-3 grid grid-cols-2 gap-2">
          {sortedPeople.map(person => {
            const registered = Boolean(leaves[paidLeaveKey(person.id, selectedDate)]);
            return <button key={person.id} type="button" role="radio" aria-checked={personId === person.id} aria-label={registered ? `${person.name}（登録済み）` : person.name} disabled={!ready || saving || registered} onClick={() => setPersonId(person.id)} className={`min-h-[48px] p-3 rounded-lg border text-base font-bold text-left flex items-center justify-between gap-2 break-words disabled:opacity-40 ${personId === person.id ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600' : 'border-gray-200 text-gray-800 hover:bg-gray-50'}`}><span>{person.name}</span>{(registered || personId === person.id) && <Check size={18} className="shrink-0" aria-hidden="true" />}</button>;
          })}
          {people.length === 0 && <p className="col-span-2 py-5 text-sm text-gray-500">登録できる人員がいません。</p>}
        </div>
        <div className="p-3 border-t shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" disabled={!ready || saving || !personId || Boolean(leaves[paidLeaveKey(personId, selectedDate)])} onClick={async () => {
            if (!people.some(person => person.id === personId)) return;
            setMessage('');
            if (await onSave(personId, selectedDate)) { setSelectedDate(null); setPersonId(''); setMessage('有給休暇を登録しました。'); requestAnimationFrame(() => returnFocusRef.current?.focus()); }
          }} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-blue-700 disabled:opacity-40"><Plus size={18} />{saving ? '保存中...' : '有給休暇を登録'}</button>
        </div>
      </div>
    </div>}
  </div>;
}
