import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, X } from 'lucide-react';
import { cn } from '../../lib/format';
import type { ImageUrls } from '../../lib/types';
import { useDataSaver } from '../../store/dataSaver';

// ─── Button ──────────────────────────────────────────────

type Variant = 'primary' | 'accent' | 'ghost' | 'outline' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  block?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-chalk text-ink hover:bg-white',
  accent: 'bg-camel text-ink hover:bg-camel-soft',
  ghost: 'text-chalk hover:bg-wool-2',
  outline: 'border border-seam text-chalk hover:border-steel',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
};
const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-5 text-[0.95rem]', lg: 'h-14 px-6 text-base' };
const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-[background,transform,opacity] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40';

/** Button styling for links (<Link>/<a>) so we never nest a button inside a link. */
export function buttonClass(variant: Variant = 'primary', size: 'sm' | 'md' | 'lg' = 'md', extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

// ─── Inputs ──────────────────────────────────────────────

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(function Input(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-1.5 block text-[0.8rem] text-steel">{label}</span>}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'h-12 w-full rounded-xl border bg-wool px-4 text-chalk placeholder:text-steel/60 transition-colors focus:outline-none',
          error ? 'border-danger/60' : 'border-seam focus:border-camel',
          className,
        )}
        aria-invalid={Boolean(error)}
        {...rest}
      />
      {(error || hint) && <span className={cn('mt-1.5 block text-xs', error ? 'text-danger' : 'text-steel')}>{error || hint}</span>}
    </label>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(function Textarea(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-1.5 block text-[0.8rem] text-steel">{label}</span>}
      <textarea
        ref={ref}
        id={inputId}
        className={cn(
          'min-h-24 w-full rounded-xl border bg-wool px-4 py-3 text-chalk placeholder:text-steel/60 focus:outline-none',
          error ? 'border-danger/60' : 'border-seam focus:border-camel',
          className,
        )}
        {...rest}
      />
      {(error || hint) && <span className={cn('mt-1.5 block text-xs', error ? 'text-danger' : 'text-steel')}>{error || hint}</span>}
    </label>
  );
});

// ─── Image with responsive sources ───────────────────────

export function Img({
  urls,
  alt,
  sizes = '(min-width: 1024px) 25vw, 50vw',
  className,
  priority,
}: {
  urls?: ImageUrls | null;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  const saver = useDataSaver(); // slow connection: small photos only
  if (!urls) return <div className={cn('bg-wool-2', className)} aria-hidden />;
  return (
    <img
      src={saver ? urls.sm : urls.md}
      srcSet={saver ? undefined : `${urls.sm} 480w, ${urls.md} 960w, ${urls.lg} 1600w`}
      sizes={sizes}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      className={cn('bg-wool-2 object-cover', className)}
    />
  );
}

// ─── Sheet (bottom drawer on mobile, side panel on desktop) ─

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl border-t border-seam bg-wool md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <span className="mx-auto h-1 w-10 rounded-full bg-seam md:hidden" aria-hidden />
            </div>
            <div className="flex items-center justify-between px-5 pb-3">
              {title && <h2 className="display text-lg">{title}</h2>}
              <button onClick={onClose} className="-mr-2 rounded-full p-2 text-steel hover:text-chalk" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
            {footer && <div className="pb-safe border-t border-seam px-5 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Small pieces ────────────────────────────────────────

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-steel', className)} aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="grid min-h-[50dvh] place-items-center">
      <Spinner />
    </div>
  );
}

export function Empty({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[45dvh] flex-col items-center justify-center gap-6 px-6 text-center">
      <img src="/mark.svg" alt="" className="size-14 opacity-60" />
      <p className="text-steel">{title}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-steel">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel ?? 'Try again'}
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-wool-2', className)} aria-hidden />;
}

export function Price({ value, compareAt, className }: { value: number; compareAt?: number | null; className?: string }) {
  return (
    <span className={cn('font-mono tabular-nums', className)}>
      {value.toLocaleString('en-US')}
      <span className="ml-1 text-[0.7em] text-steel">ETB</span>
      {compareAt && compareAt > value && (
        <s className="ml-2 text-[0.8em] text-steel/70">{compareAt.toLocaleString('en-US')}</s>
      )}
    </span>
  );
}
