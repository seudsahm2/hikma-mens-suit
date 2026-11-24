import { useId } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/format';

/**
 * Vector redraw of the shop's round sign: a shirt and trousers placed together, white line-art in a
 * dark circle. The trousers sit in front — the shirt's lines are masked where they pass behind them,
 * so the mark also works on a transparent background.
 * `draw` animates the line-art as if stitched on, once.
 */
const SHIRT = [
  'M24 28 L35 24 L40 30 L45 24 L56 28 L65 47 L58 50 L53 40 L53 76 L27 76 L27 40 L22 50 L15 47 Z',
  'M35 24 L37 34 L40 30 L43 34 L45 24',
  'M40 30 V76',
];
const BUTTONS = [41, 50, 59, 68];
const TROUSERS_OUTLINE = 'M53 31 L75 31 L77 84 L68 84 L64 50 L60 84 L51 84 Z';
const TROUSERS = [TROUSERS_OUTLINE, 'M53.3 37 L75.2 37', 'M64 37 V46', 'M56 37 Q58.5 41 57.5 44.5', 'M72.5 37 Q70 41 71 44.5'];

export function Mark({
  className,
  draw = false,
  stroke = '#ECE9E3',
  fill = '#0D1015',
  ring,
}: {
  className?: string;
  draw?: boolean;
  stroke?: string;
  fill?: string;
  ring?: string;
}) {
  const mask = `hk-${useId().replace(/:/g, '')}`;
  let n = 0;
  const line = (d: string) =>
    draw ? (
      <motion.path
        key={d}
        d={d}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.1, delay: 0.15 + n++ * 0.12, ease: [0.22, 1, 0.36, 1] }}
      />
    ) : (
      <path key={d} d={d} />
    );

  return (
    <svg viewBox="0 0 100 100" fill="none" className={cn('shrink-0', className)} aria-hidden>
      <defs>
        <mask id={mask}>
          <rect width="100" height="100" fill="#fff" />
          <g transform="translate(3 -1) rotate(12 64 56)">
            <path d={TROUSERS_OUTLINE} fill="#000" stroke="#000" strokeWidth={7} strokeLinejoin="round" />
          </g>
        </mask>
      </defs>
      <circle cx="50" cy="50" r="48.5" fill={fill} stroke={ring ?? 'none'} strokeWidth={ring ? 1 : 0} />
      <g stroke={stroke} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <g mask={`url(#${mask})`}>
          <g transform="translate(3 -3) rotate(-16 40 52)">
            {SHIRT.map(line)}
            <g fill={stroke} stroke="none">
              {BUTTONS.map((cy, i) =>
                draw ? (
                  <motion.circle key={cy} cx="42.6" cy={cy} r="1.35" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.1 + i * 0.1 }} />
                ) : (
                  <circle key={cy} cx="42.6" cy={cy} r="1.35" />
                ),
              )}
            </g>
          </g>
        </g>
        <g transform="translate(3 -1) rotate(12 64 56)">{TROUSERS.map(line)}</g>
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Mark className="size-8" ring="#262C35" />
      <span className="leading-none">
        <span className="display block text-[0.95rem] tracking-[0.02em]">Hikma</span>
        <span className="label block !text-[0.55rem] !tracking-[0.3em]">Men’s fashion</span>
      </span>
    </span>
  );
}
