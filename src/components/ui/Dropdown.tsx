/**
 * Our own dropdown (instead of the browser's <select>): same look on every phone and desktop,
 * keyboard friendly (↑ ↓ Enter Esc, type to jump), closes on outside tap.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/format';

export interface DropdownOption {
  value: string;
  label: string;
  hint?: ReactNode;
}

export function Dropdown({
  value,
  onChange,
  options,
  label,
  ariaLabel,
  size = 'md',
  className,
  align = 'left',
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  label?: string;
  ariaLabel?: string;
  /** md = form field (h-12) · sm = compact (h-8) · pill = rounded chip (h-9) */
  size?: 'md' | 'sm' | 'pill';
  className?: string;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open, options, value]);

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      return setOpen(true);
    }
    if (!open) return;
    if (e.key === 'Escape') return setOpen(false);
    if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(options.length - 1, a + 1)));
    else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(0, a - 1)));
    else if (e.key === 'Enter') (e.preventDefault(), pick(options[active]!.value));
    else if (e.key.length === 1) {
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
    }
  };

  const trigger = {
    md: 'h-12 w-full rounded-xl border bg-wool px-3 text-chalk',
    sm: 'h-8 w-full rounded-md border bg-ink px-2 text-xs',
    pill: 'h-9 rounded-full border bg-ink px-3 text-sm text-chalk/90',
  }[size];

  return (
    <div ref={root} className={cn('relative', size !== 'pill' && 'w-full', className)}>
      {label && (
        <span id={`${id}-l`} className="mb-1.5 block text-[0.8rem] text-steel">
          {label}
        </span>
      )}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? `${id}-l` : undefined}
        aria-label={label ? undefined : ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={cn('flex items-center justify-between gap-2 text-left transition-colors focus:outline-none', trigger, open ? 'border-camel' : 'border-seam hover:border-steel')}
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-steel transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul
          ref={list}
          role="listbox"
          aria-labelledby={label ? `${id}-l` : undefined}
          className={cn(
            'absolute z-50 mt-1.5 max-h-72 min-w-full overflow-y-auto overscroll-contain rounded-xl border border-seam bg-wool-2 p-1 shadow-2xl shadow-black/50',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={selected}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm',
                  i === active ? 'bg-ink/60 text-chalk' : 'text-chalk/85',
                )}
              >
                <span className="flex-1">{o.label}</span>
                {o.hint && <span className="text-xs text-steel">{o.hint}</span>}
                {selected && <Check className="size-4 text-camel" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
