import { create } from 'zustand';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '../../lib/format';

/**
 * Hero video sound. Browsers only autoplay MUTED video, so it always starts muted; the customer
 * turns sound on with one tap. `hasAudio` is set when the playing video turns out to have a sound
 * track — without one the button stays hidden (nothing to unmute).
 */
interface HeroSound {
  muted: boolean;
  hasAudio: boolean;
  toggle: () => void;
  setHasAudio: (v: boolean) => void;
}
export const useHeroSound = create<HeroSound>((set) => ({
  muted: true,
  hasAudio: false,
  toggle: () => set((s) => ({ muted: !s.muted })),
  setHasAudio: (hasAudio) => set({ hasAudio }),
}));

/** Does this playing video carry sound? (Different browsers expose it differently.) */
export function videoHasAudio(v: HTMLVideoElement): boolean | null {
  const x = v as HTMLVideoElement & { mozHasAudio?: boolean; webkitAudioDecodedByteCount?: number; audioTracks?: { length: number } };
  if (typeof x.mozHasAudio === 'boolean') return x.mozHasAudio;
  if (x.audioTracks && typeof x.audioTracks.length === 'number') return x.audioTracks.length > 0;
  if (typeof x.webkitAudioDecodedByteCount === 'number') return x.webkitAudioDecodedByteCount > 0;
  return null; // unknown
}

export function SoundToggle({ className }: { className?: string }) {
  const { muted, hasAudio, toggle } = useHeroSound();
  if (!hasAudio) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? 'Turn sound on' : 'Mute'}
      className={cn(
        'grid size-11 place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition-transform hover:scale-105 active:scale-95',
        muted && 'animate-[pulse_2.4s_ease-in-out_3]',
        className,
      )}
    >
      {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
    </button>
  );
}
