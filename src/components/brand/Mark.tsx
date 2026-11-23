import { motion } from 'motion/react';
import { cn } from '../../lib/format';

/**
 * Vector redraw of the shop's round collar sign.
 * `draw` animates the line-art as if stitched on, once.
 */
const PATHS = [
  'M36 28 Q50 22 64 28',
  'M36 28 L44 46 L50 36 L56 46 L64 28',
  'M50 36 V84',
  'M30 33 L42 60 L37 86',
  'M70 33 L58 60 L63 86',
  'M30 33 Q21 40 19 58',
  'M70 33 Q79 40 81 58',
];

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
  return (
    <svg viewBox="0 0 100 100" fill="none" className={cn('shrink-0', className)} aria-hidden>
      <circle cx="50" cy="50" r="48.5" fill={fill} stroke={ring ?? 'none'} strokeWidth={ring ? 1 : 0} />
      <g stroke={stroke} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        {PATHS.map((d, i) =>
          draw ? (
            <motion.path
              key={d}
              d={d}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.1, delay: 0.15 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : (
            <path key={d} d={d} />
          ),
        )}
      </g>
      <g fill={stroke}>
        {[53, 64, 75].map((cy, i) =>
          draw ? (
            <motion.circle key={cy} cx="50" cy={cy} r="1.8" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2 + i * 0.1 }} />
          ) : (
            <circle key={cy} cx="50" cy={cy} r="1.8" />
          ),
        )}
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
