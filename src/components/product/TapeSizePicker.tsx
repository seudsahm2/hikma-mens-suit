import { useEffect, useRef } from 'react';
import { cn } from '../../lib/format';
import { haptic } from '../../lib/telegram';

interface Props {
  sizes: string[];
  value: string | null;
  isAvailable: (size: string) => boolean;
  onChange: (size: string) => void;
  label: string;
}

/**
 * Signature element: sizes sit on a tailor's tape.
 * Camel tape, ink graduations; the chosen size is marked in ink.
 */
export function TapeSizePicker({ sizes, value, isAvailable, onChange, label }: Props) {
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the chosen mark in view
  useEffect(() => {
    if (!value || !scroller.current) return;
    const el = scroller.current.querySelector<HTMLElement>(`[data-size="${CSS.escape(value)}"]`);
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [value]);

  return (
    <div
      ref={scroller}
      role="radiogroup"
      aria-label={label}
      className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      <div
        className="relative inline-flex min-w-full rounded-[3px] bg-camel text-ink shadow-[inset_0_-1px_0_rgba(0,0,0,0.25),0_10px_30px_-12px_rgba(185,139,87,0.45)]"
        style={{
          // minor graduations along the top edge
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(13,16,21,0.55) 0 1px, transparent 1px 7px), repeating-linear-gradient(90deg, rgba(13,16,21,0.55) 0 1px, transparent 1px 35px)',
          backgroundSize: '100% 7px, 100% 12px',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: '0 0, 0 0',
        }}
      >
        {sizes.map((size) => {
          const available = isAvailable(size);
          const selected = value === size;
          return (
            <button
              key={size}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={!available}
              data-size={size}
              onClick={() => {
                if (!available) return;
                haptic.select();
                onChange(size);
              }}
              className={cn(
                'relative flex h-[4.25rem] min-w-[3.75rem] flex-1 flex-col items-center justify-end pb-2.5 font-mono text-[1.05rem] font-medium tabular-nums transition-colors duration-200',
                selected && 'bg-ink text-chalk',
                !available && 'cursor-not-allowed text-ink/35',
              )}
            >
              {/* major graduation */}
              <span className={cn('absolute left-1/2 top-0 h-[18px] w-[1.5px] -translate-x-1/2', selected ? 'bg-camel' : 'bg-ink/80')} aria-hidden />
              <span className={cn(!available && 'line-through decoration-1')}>{size}</span>
              {selected && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-camel" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
