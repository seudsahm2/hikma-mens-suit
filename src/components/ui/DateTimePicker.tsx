/**
 * Date + time picker (instead of the browser's datetime-local): a month calendar and quick time
 * choices, styled like the rest of the admin. Value is an ISO string (or null = not set).
 */
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '../../lib/format';
import { Dropdown } from './Dropdown';

const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const pad = (n: number) => String(n).padStart(2, '0');
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function DateTimePicker({
  value,
  onChange,
  label,
  placeholder = 'Not set',
  defaultTime = '09:00',
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  label?: string;
  placeholder?: string;
  /** used when a day is picked and no time was set yet */
  defaultTime?: string;
}) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const date = value ? new Date(value) : null;
  const [month, setMonth] = useState(() => {
    const d = date ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return;
    // Open toward the side with room (a picker in the right column would overflow the phone screen)
    const r = root.current?.getBoundingClientRect();
    setAlignRight(Boolean(r && r.left + 304 > window.innerWidth - 8));
    const d = value ? new Date(value) : new Date();
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', close);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open, value]);

  const [hh, mm] = (date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : defaultTime).split(':').map(Number) as [number, number];

  const setDay = (d: Date) => {
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm);
    onChange(next.toISOString());
  };
  const setTime = (h: number, m: number) => {
    const base = date ?? new Date();
    onChange(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m).toISOString());
  };

  // Calendar grid: weeks start on Monday
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const today = new Date();

  const text = date
    ? `${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })} · ${pad(date.getHours())}:${pad(date.getMinutes())}`
    : placeholder;

  return (
    <div ref={root} className="relative">
      {label && <span className="mb-1.5 block text-[0.8rem] text-steel">{label}</span>}
      <div className={cn('flex h-12 w-full items-center rounded-xl border bg-wool transition-colors', open ? 'border-camel' : 'border-seam hover:border-steel')}>
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-full min-w-0 flex-1 items-center gap-2 px-3 text-left" aria-haspopup="dialog" aria-expanded={open}>
          <CalendarDays className="size-4 shrink-0 text-steel" />
          <span className={cn('truncate text-sm', !date && 'text-steel')}>{text}</span>
        </button>
        {date && (
          <button type="button" onClick={() => onChange(null)} className="grid size-9 shrink-0 place-items-center text-steel hover:text-chalk" aria-label="Clear">
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && (
        <div role="dialog" className={cn('absolute z-50', alignRight ? 'right-0' : 'left-0', ' mt-1.5 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-seam bg-wool-2 p-3 shadow-2xl shadow-black/50')}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid size-8 place-items-center rounded-full hover:bg-ink/60" aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-medium">{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
            <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid size-8 place-items-center rounded-full hover:bg-ink/60" aria-label="Next month">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEK.map((w) => (
              <span key={w} className="py-1 font-mono text-[0.62rem] uppercase text-steel">
                {w}
              </span>
            ))}
            {cells.map((d, i) =>
              d ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDay(d)}
                  className={cn(
                    'grid h-9 place-items-center rounded-lg text-sm transition-colors',
                    date && sameDay(d, date) ? 'bg-camel font-semibold text-ink' : sameDay(d, today) ? 'text-camel ring-1 ring-inset ring-camel/40 hover:bg-ink/60' : 'hover:bg-ink/60',
                  )}
                >
                  {d.getDate()}
                </button>
              ) : (
                <span key={i} />
              ),
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-seam pt-3">
            <span className="text-xs text-steel">Time</span>
            <div className="w-20">
              <Dropdown size="sm" ariaLabel="Hour" value={pad(hh)} onChange={(v) => setTime(Number(v), mm)} options={Array.from({ length: 24 }, (_, h) => ({ value: pad(h), label: pad(h) }))} />
            </div>
            <span className="text-steel">:</span>
            <div className="w-20">
              <Dropdown size="sm" ariaLabel="Minute" value={pad(mm - (mm % 5))} onChange={(v) => setTime(hh, Number(v))} options={Array.from({ length: 12 }, (_, i) => ({ value: pad(i * 5), label: pad(i * 5) }))} />
            </div>
            <button type="button" onClick={() => setOpen(false)} className="ml-auto h-8 rounded-full bg-chalk px-4 text-xs font-semibold text-ink">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
