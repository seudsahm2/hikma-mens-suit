/**
 * Owner: verify the Fayda ID of a delivery person or an admin (guarantee for people who work for the shop).
 *  • Scan the card's QR with the camera, or pick a photo of it.
 *  • The QR text goes to the server, which checks NIDP's signature — only genuine cards are saved.
 *  • Shows the verified name / FAN / birth date / photo, and whether it matches the registered name.
 * QR decoding: zxing (WebAssembly, served from this site). The raw bytes are decoded as UTF-8 here, so
 * Ethiopic names come through exactly (some decoders garble them).
 */
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Flashlight, IdCard, ImageUp, ShieldCheck } from 'lucide-react';
import { Button, Sheet } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { apiBlob, ApiError } from '../../lib/api';
import { cn, formatDate } from '../../lib/format';
import { useStaff } from '../../store/auth';
import { adminApi, Card } from '../ui';

type Subject = { type: 'driver' | 'staff'; id: string; name: string };
interface Check { id: string; fullName: string; gender: string | null; dateOfBirth: string | null; fan: string; cardVersion: string; hasPhoto: boolean; verifiedAt: string }

// ─── QR reading ──────────────────────────────────────────

async function zxing() {
  const [{ readBarcodes, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([import('zxing-wasm/reader'), import('zxing-wasm/reader/zxing_reader.wasm?url')]);
  prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } });
  return readBarcodes;
}
const utf8 = new TextDecoder('utf-8');

/** First Fayda-looking QR in the image, as text (from the raw bytes). */
async function readFaydaQr(input: ImageData | Blob): Promise<string | null> {
  const readBarcodes = await zxing();
  const results = await readBarcodes(input, { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 3 });
  for (const r of results) {
    const text = r.bytes?.length ? utf8.decode(r.bytes) : r.text;
    if (text.includes(':DLT:') && text.includes(':SIGN:')) return text;
  }
  return null;
}

type Track = MediaStreamTrack & { getCapabilities?: () => Record<string, unknown> };
type ImageCaptureLike = { takePhoto: () => Promise<Blob> };

/**
 * Live scanner, hardened for real phones:
 *  • the camera starts ONCE (the result goes through a ref, so re-renders never restart it);
 *  • asks for high resolution, continuous autofocus and 2× zoom where supported — Fayda QR codes are
 *    small and dense; zoom lets you hold the phone further away, where it can focus;
 *  • reads the framed area of each video frame, and every ~2 s also takes a full-resolution,
 *    autofocused still (ImageCapture) — the same quality as a photo;
 *  • flashlight toggle; "Take a photo" (phone camera app) and "Choose a photo" always work.
 */
function Scanner({ onText, onClose }: { onText: (t: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState<null | boolean>(null); // null = not supported
  const [hint, setHint] = useState('Hold the QR code inside the frame');
  const done = useRef(false);
  const trackRef = useRef<Track | null>(null);

  const finish = (text: string) => {
    if (done.current) return;
    done.current = true;
    navigator.vibrate?.(60);
    onTextRef.current(text);
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stillTimer: ReturnType<typeof setInterval> | null = null;
    let frames = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const tick = async () => {
      const v = video.current;
      if (done.current) return;
      if (!v || v.readyState < 2 || !v.videoWidth) return void (timer = setTimeout(tick, 250));
      // The framed middle of the picture (where the card is): less noise, faster
      const w = v.videoWidth;
      const h = v.videoHeight;
      const side = Math.round(Math.min(w, h) * 0.9);
      canvas.width = side;
      canvas.height = side;
      ctx.drawImage(v, (w - side) / 2, (h - side) / 2, side, side, 0, 0, side, side);
      const text = await readFaydaQr(ctx.getImageData(0, 0, side, side)).catch(() => null);
      if (text) return finish(text);
      // Every other try: the whole frame (the card may be off-centre)
      if (++frames % 2 === 0) {
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(v, 0, 0);
        const whole = await readFaydaQr(ctx.getImageData(0, 0, w, h)).catch(() => null);
        if (whole) return finish(whole);
      }
      if (frames === 20) setHint(Math.min(w, h) < 720 ? 'Low camera quality here — tap “Take a photo” below' : 'Hold steady about a hand-width away, no glare');
      timer = setTimeout(tick, 150);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } },
          audio: false,
        });
        const track = stream.getVideoTracks()[0] as Track;
        trackRef.current = track;
        const caps = (track.getCapabilities?.() ?? {}) as Record<string, unknown>; // focusMode / zoom / torch are Chrome extras
        const advanced: Record<string, unknown>[] = [];
        if (Array.isArray(caps.focusMode) && (caps.focusMode as string[]).includes('continuous')) advanced.push({ focusMode: 'continuous' });
        const zoom = caps.zoom as { min: number; max: number } | undefined;
        if (zoom && zoom.max >= 2) advanced.push({ zoom: Math.min(2, zoom.max) });
        if (advanced.length) await track.applyConstraints({ advanced } as MediaTrackConstraints).catch(() => undefined);
        if (caps.torch) setTorch(false);
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
        void tick();
        // Full-resolution, autofocused stills (Chrome on Android): photo quality while scanning
        const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => ImageCaptureLike }).ImageCapture;
        if (IC) {
          const capture = new IC(track);
          let shooting = false;
          stillTimer = setInterval(async () => {
            if (done.current || shooting) return;
            shooting = true;
            try {
              const text = await readFaydaQr(await capture.takePhoto());
              if (text) finish(text);
            } catch {
              /* some phones refuse stills while streaming — the frame reading keeps going */
            }
            shooting = false;
          }, 2000);
        }
      } catch {
        setError('The camera isn’t available here — use “Take a photo” or “Choose a photo”.');
      }
    })();
    return () => {
      done.current = true;
      if (timer) clearTimeout(timer);
      if (stillTimer) clearInterval(stillTimer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTorch = async () => {
    const t = trackRef.current;
    if (!t || torch === null) return;
    await t.applyConstraints({ advanced: [{ torch: !torch }] } as unknown as MediaTrackConstraints).catch(() => undefined);
    setTorch(!torch);
  };

  const fromPhoto = async (file: File) => {
    setBusy(true);
    setError('');
    const text = await readFaydaQr(file).catch(() => null);
    setBusy(false);
    if (text) finish(text);
    else setError('No Fayda QR found in that photo — take it closer, flat, sharp and without glare.');
  };

  const corners = [
    'left-0 top-0 rounded-tl-2xl border-l-[3px] border-t-[3px]',
    'right-0 top-0 rounded-tr-2xl border-r-[3px] border-t-[3px]',
    'bottom-0 left-0 rounded-bl-2xl border-b-[3px] border-l-[3px]',
    'bottom-0 right-0 rounded-br-2xl border-b-[3px] border-r-[3px]',
  ];

  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl bg-black">
        <video ref={video} playsInline muted className="aspect-square w-full object-cover" />
        <div className="pointer-events-none absolute inset-[9%]">
          <div className="absolute inset-0 rounded-2xl shadow-[0_0_0_999px_rgba(0,0,0,0.45)]" />
          {corners.map((c) => (
            <span key={c} className={cn('absolute size-9 border-camel', c)} />
          ))}
          <span className="absolute inset-x-6 top-1/2 h-px animate-pulse bg-camel/70" />
        </div>
        {torch !== null && (
          <button
            type="button"
            onClick={toggleTorch}
            className={cn('absolute right-3 top-3 grid size-10 place-items-center rounded-full', torch ? 'bg-camel text-ink' : 'bg-black/60 text-white')}
            aria-label="Flashlight"
          >
            <Flashlight className="size-4" />
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-sm text-steel">{hint}</p>
      {error && <p className="mt-2 text-center text-sm text-camel">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-camel text-sm font-semibold text-ink">
          <Camera className="size-4" /> {busy ? 'Reading…' : 'Take a photo'}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && fromPhoto(e.target.files[0])} />
        </label>
        <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-seam text-sm hover:border-steel">
          <ImageUp className="size-4" /> Choose a photo
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && fromPhoto(e.target.files[0])} />
        </label>
      </div>
      <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-center text-sm text-steel">
        Cancel
      </button>
    </div>
  );
}

// ─── Identity card ───────────────────────────────────────

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}]+/gu, ' ').trim();
const fanShow = (f: string) => f.replace(/(\d{4})(?=\d)/g, '$1 ');

function FacePhoto({ checkId }: { checkId: string }) {
  const token = useStaff((s) => s.token);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    void (async () => {
      const blob = await apiBlob(`/admin/identity/photo/${checkId}`).catch(() => null);
      if (blob) setUrl((u = URL.createObjectURL(blob)));
    })();
    return () => (u ? URL.revokeObjectURL(u) : undefined);
  }, [checkId, token]);
  return url ? <img src={url} alt="" className="aspect-[3/4] w-20 shrink-0 rounded-xl object-cover" /> : <span className="grid aspect-[3/4] w-20 shrink-0 place-items-center rounded-xl bg-wool-2 text-steel"><IdCard className="size-6" /></span>;
}

export function FaydaIdentity({ subject }: { subject: Subject }) {
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const key = ['admin', 'identity', subject.type, subject.id];
  const q = useQuery({ queryKey: key, queryFn: () => adminApi<{ check: Check | null }>(`/identity/${subject.type}/${subject.id}`).then((r) => r.check) });
  const save = useMutation({
    mutationFn: (qr: string) => adminApi<{ check: Check; alsoUsedFor: { name: string | null; type: string } | null }>('/identity', { body: { type: subject.type, id: subject.id, qr } }),
    onSuccess: (r) => {
      setScanning(false);
      qc.setQueryData(key, r.check);
      toast.ok('✓ Genuine Fayda card — saved');
      if (r.alsoUsedFor) toast.error(`Careful: this card was also used for ${r.alsoUsedFor.name ?? 'someone else'} (${r.alsoUsedFor.type === 'driver' ? 'delivery' : 'admin'})`);
    },
    onError: (e) => {
      setScanning(false);
      toast.error(e instanceof ApiError ? e.message : 'Could not verify the card');
    },
  });
  const c = q.data;
  const nameMatches = c ? norm(c.fullName).split(' ').filter(Boolean).some((part) => norm(subject.name).includes(part)) : false;

  return (
    <Card title="Identity (Fayda)">
      {c ? (
        <div className="flex gap-4">
          {c.hasPhoto ? <FacePhoto checkId={c.id} /> : null}
          <div className="min-w-0 flex-1 text-sm">
            <p className="flex items-center gap-1.5 text-ok">
              <ShieldCheck className="size-4" /> Genuine card · verified {formatDate(c.verifiedAt)}
            </p>
            <p className="mt-2 font-medium">{c.fullName}</p>
            <p className="font-mono text-xs text-steel">FAN {fanShow(c.fan)}</p>
            <p className="text-xs text-steel">
              {[c.gender === 'male' ? 'Male' : c.gender === 'female' ? 'Female' : null, c.dateOfBirth && `Born ${c.dateOfBirth}`].filter(Boolean).join(' · ')}
            </p>
            {!nameMatches && <p className="mt-2 text-xs text-camel">⚠ Name on the card doesn’t match “{subject.name}” — check it’s the same person.</p>}
            <button type="button" onClick={() => setScanning(true)} className="mt-3 text-xs text-steel underline underline-offset-2">
              Scan again
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-steel">Scan {subject.name.split(' ')[0]}’s Fayda ID card. The shop checks NIDP’s signature, so only a genuine card is accepted.</p>
          <Button variant="accent" className="mt-3" onClick={() => setScanning(true)}>
            <Camera className="size-4" /> Scan Fayda ID
          </Button>
        </div>
      )}
      <Sheet open={scanning} onClose={() => setScanning(false)} title="Scan Fayda ID">
        {save.isPending ? <p className="py-10 text-center text-sm text-steel">Checking the NIDP signature…</p> : scanning && <Scanner onText={(t) => save.mutate(t)} onClose={() => setScanning(false)} />}
      </Sheet>
      <p className={cn('mt-3 text-[0.7rem] text-steel')}>Kept privately for the owner (in the database and its encrypted backups) — never shown to anyone else.</p>
    </Card>
  );
}
