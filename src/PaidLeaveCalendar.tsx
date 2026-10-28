import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import type { PaidLeaveMap, Person } from './types';
import { formatLeaveDate, japanDate, monthDays, paidLeaveKey, peopleOnLeave, shiftMonth } from './paidLeave';
import { ROLE_LABELS } from './constants';

interface Props {
  people: Person[];
  leaves: PaidLeaveMap;
  ready: boolean;
  saving: boolean;
  error: string;
  onSave: (personId: string, date: string, remove?: boolean) => Promise<boolean>;
  onClose: () => void;
}

export default function PaidLeaveCalendar({ people, leaves, ready, saving, error, onSave, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const today = japanDate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [personId, setPersonId] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const dayPeople = peopleOnLeave(people, leaves, selectedDate);
  const sortedPeople = [...people].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  const duplicate = Boolean(leaves[paidLeaveKey(personId, selectedDate)]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
      if (event.key !== 'Tab') return;
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') || [])];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose, saving]);

  const selectDate = (date: string) => { setSelectedDate(date); setMessage(''); };
  const navigateMonth = (offset: number) => {
    const next = shiftMonth(month, offset);
    setMonth(next);
    selectDate(`${next}-01`);
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="paid-leave-title" className="fixed inset-0 z-[150] bg-gray-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b p-3 md:p-5 flex items-center justify-between gap-3 shrink-0">
        <div>
          <h2 id="paid-leave-title" className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2"><CalendarDays className="text-blue-600" />有給休暇</h2>
          <p className="text-xs md:text-sm text-gray-500 mt-1">誰でも登録できます。日付を選んで有給休暇者を確認・登録してください。</p>
        </div>
        <button type="button" aria-label="有給休暇を閉じる" onClick={onClose} disabled={saving} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-40"><X /></button>
      </header>
      <div className="overflow-y-auto flex-1 p-3 md:p-6">
        <div className="max-w-7xl mx-auto">
          {!ready && <p role="status" className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900">有給休暇の最新情報を確認中です。接続後に登録・取消できます。表示中の内容は保存済みの情報です。</p>}
          {error && <p role="alert" className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-700">{error}</p>}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <section aria-label="有給休暇カレンダー" className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-3 md:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <button type="button" disabled={saving} aria-label="前の月" onClick={() => navigateMonth(-1)} className="p-2 rounded-lg border hover:bg-gray-50"><ChevronLeft size={20} /></button>
                  <h3 className="text-lg md:text-xl font-bold text-gray-800 tabular-nums">{Number(month.slice(0, 4))}年{Number(month.slice(5))}月</h3>
                  <button type="button" disabled={saving} aria-label="次の月" onClick={() => navigateMonth(1)} className="p-2 rounded-lg border hover:bg-gray-50"><ChevronRight size={20} /></button>
                </div>
                <button type="button" disabled={saving} onClick={() => { setMonth(today.slice(0, 7)); selectDate(today); }} className="text-sm border rounded-lg px-3 py-2 text-blue-700 hover:bg-blue-50">今日</button>
              </div>
              <div className="grid grid-cols-7 text-center text-xs md:text-sm font-bold mb-1" aria-hidden="true">
                {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => <span key={day} className={`py-2 ${i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-gray-500'}`}>{day}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthDays(month).map((date, index) => {
                  if (!date) return <div key={`blank-${index}`} aria-hidden="true" className="bg-gray-50 rounded-md" />;
                  const members = peopleOnLeave(sortedPeople, leaves, date);
                  return (
                    <button key={date} type="button" disabled={saving} aria-pressed={date === selectedDate}
                      aria-label={`${formatLeaveDate(date)}、有給${members.length}名${members.length ? '、' + members.map(p => p.name).join('、') : ''}`}
                      onClick={() => selectDate(date)}
                      className={`min-h-[64px] md:min-h-[116px] min-w-0 rounded-lg border p-1 md:p-2 text-left flex flex-col gap-1 hover:border-blue-500 focus-visible:outline-blue-600 ${date === selectedDate ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50' : 'border-gray-200'} ${date === today && date !== selectedDate ? 'bg-amber-50' : ''}`}>
                      <span className={`text-xs md:text-sm font-bold ${index % 7 === 0 ? 'text-red-600' : index % 7 === 6 ? 'text-blue-600' : 'text-gray-700'}`}>{Number(date.slice(8))}<span className="sr-only">日</span></span>
                      {members.length > 0 && <>
                        <span className="text-[10px] md:text-xs font-bold text-blue-700">{members.length}名</span>
                        <span className="hidden md:block text-xs text-gray-700 truncate w-full">{members.slice(0, 2).map(p => p.name).join('・')}</span>
                        {members.length > 2 && <span className="hidden md:block text-[10px] text-gray-500">ほか{members.length - 2}名</span>}
                      </>}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-3">青枠：選択中の日付 ／ 薄い黄色：今日</p>
            </section>
            <section aria-label="選択日の有給休暇者" className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 shadow-sm self-start">
              <h3 className="font-bold text-lg text-gray-800">{formatLeaveDate(selectedDate)}</h3>
              <p className="text-blue-700 font-bold text-sm mt-1 mb-4">有給休暇者 {dayPeople.length}名</p>
              {dayPeople.length === 0 ? <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 mb-5">{ready ? 'この日の有給休暇の登録はありません。' : '保存済みの登録はありません。最新情報を確認中です。'}</p> :
                <ul className="space-y-2 mb-5">
                  {dayPeople.map(person => <li key={person.id} className="flex items-center justify-between gap-2 p-3 bg-blue-50 rounded-lg">
                    <div className="min-w-0"><p className="font-bold text-gray-800 break-words">{person.name}</p><p className="text-xs text-gray-500">{ROLE_LABELS[person.role]}</p></div>
                    <button type="button" aria-label={`${person.name}の有給を取り消す`} disabled={!ready || saving} className="shrink-0 px-2 py-2 text-xs text-red-700 border border-red-200 rounded-lg bg-white hover:bg-red-50 disabled:opacity-40"
                      onClick={async () => {
                        if (!window.confirm(`${formatLeaveDate(selectedDate)}の${person.name}さんの有給休暇を取り消しますか？`)) return;
                        setMessage('');
                        if (await onSave(person.id, selectedDate, true)) setMessage('有給休暇を取り消しました。');
                      }}><Trash2 size={14} className="inline mr-1" />取消</button>
                  </li>)}
                </ul>}
              <form className="border-t pt-4 space-y-3" onSubmit={async event => {
                event.preventDefault();
                if (!people.some(person => person.id === personId) || duplicate) return;
                setMessage('');
                if (await onSave(personId, selectedDate)) { setMessage('有給休暇を登録しました。'); setPersonId(''); }
              }}>
                <h4 className="font-bold text-gray-800">この日に登録する</h4>
                <label className="block text-sm text-gray-600">人員を検索
                  <input type="search" disabled={saving} value={query} onChange={event => { setQuery(event.target.value); setPersonId(''); }} placeholder="名前で絞り込み" className="mt-1 w-full border border-gray-300 rounded-lg p-3" />
                </label>
                <label className="block text-sm text-gray-600">有給休暇を取る人員
                  <select required disabled={saving} value={personId} onChange={event => { setPersonId(event.target.value); setMessage(''); }} className="mt-1 w-full border border-gray-300 rounded-lg p-3 bg-white">
                    <option value="">人員を選択してください</option>
                    {sortedPeople.filter(p => p.name.includes(query.trim())).map(person => <option key={person.id} value={person.id} disabled={Boolean(leaves[paidLeaveKey(person.id, selectedDate)])}>{person.name}（{ROLE_LABELS[person.role]}）{leaves[paidLeaveKey(person.id, selectedDate)] ? '・登録済み' : ''}</option>)}
                  </select>
                </label>
                {people.length === 0 && <p className="text-sm text-gray-500">登録できる人員がいません。データ管理で人員を追加してください。</p>}
                <button type="submit" disabled={!ready || saving || !personId || duplicate} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-blue-700 disabled:opacity-40"><Plus size={18} />{saving ? '保存中...' : '有給休暇を登録'}</button>
                {saving && <p role="status" className="text-sm text-gray-500">共有データへの保存を待っています。</p>}
                {message && <p role="status" className="text-sm text-green-700 font-bold">{message}</p>}
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
