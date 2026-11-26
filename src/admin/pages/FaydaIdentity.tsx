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
import { Camera, IdCard, ImageUp, ShieldCheck } from 'lucide-react';
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

function Scanner({ onText, onClose }: { onText: (t: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const tick = async () => {
      const v = video.current;
      if (done.current || !v || v.readyState < 2) return void (timer = setTimeout(tick, 300));
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      ctx.drawImage(v, 0, 0);
      const text = await readFaydaQr(ctx.getImageData(0, 0, canvas.width, canvas.height)).catch(() => null);
      if (text && !done.current) {
        done.current = true;
        navigator.vibrate?.(60);
        onText(text);
        return;
      }
      timer = setTimeout(tick, 250);
    };
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
        void tick();
      } catch {
        setError('The camera isn’t available — allow it, or pick a photo of the card instead.');
      }
    })();
    return () => {
      done.current = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onText]);

  const fromPhoto = async (file: File) => {
    setBusy(true);
    setError('');
    const text = await readFaydaQr(file).catch(() => null);
    setBusy(false);
    if (text) {
      done.current = true;
      onText(text);
    } else setError('No Fayda QR found in that photo — take it closer, flat and sharp.');
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video ref={video} playsInline muted className="aspect-[4/3] w-full object-cover" />
        <div className="pointer-events-none absolute inset-[12%] rounded-2xl border-2 border-camel/80 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
      </div>
      <p className="mt-3 text-center text-sm text-steel">Hold the card’s QR code inside the frame — it reads by itself.</p>
      {error && <p className="mt-2 text-center text-sm text-camel">{error}</p>}
      <label className="mt-4 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-seam text-sm hover:border-steel">
        <ImageUp className="size-4" /> {busy ? 'Reading…' : 'Pick a photo of the card'}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && fromPhoto(e.target.files[0])} />
      </label>
      <button type="button" onClick={onClose} className="mt-3 w-full text-center text-sm text-steel">
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
