import { useEffect, useRef, useState } from 'react';
import { Img } from '../ui';
import { cn } from '../../lib/format';
import type { ProductImage } from '../../lib/types';

/** Swipe on phones (scroll-snap), two-column stack on desktop. */
export function Gallery({ images, alt, focusColor }: { images: ProductImage[]; alt: string; focusColor?: string | null }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // Jump to the first photo of the chosen colour
  useEffect(() => {
    if (!focusColor || !track.current) return;
    const i = images.findIndex((img) => img.color?.toLowerCase() === focusColor.toLowerCase());
    if (i >= 0) track.current.scrollTo({ left: i * track.current.clientWidth, behavior: 'smooth' });
  }, [focusColor, images]);

  if (!images.length) return <div className="aspect-[4/5] w-full bg-wool" />;

  return (
    <div className="relative">
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto md:grid md:grid-cols-2 md:gap-2 md:overflow-visible"
      >
        {images.map((img, i) => (
          <div key={img.id} className={cn('aspect-[4/5] w-full shrink-0 snap-center md:rounded-md md:overflow-hidden', i === 0 && 'md:col-span-2')}>
            <Img urls={img.urls} alt={img.alt ?? alt} priority={i === 0} sizes="(min-width: 768px) 40vw, 100vw" className="size-full" />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden" aria-hidden>
          {images.map((img, i) => (
            <span key={img.id} className={cn('h-[3px] rounded-full transition-all duration-300', i === index ? 'w-5 bg-chalk' : 'w-2 bg-chalk/40')} />
          ))}
        </div>
      )}
    </div>
  );
}
