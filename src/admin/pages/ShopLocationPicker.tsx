/**
 * Shop location, precisely:
 *  1. "Use my current location" — live GPS, shows the accuracy as it improves and only takes it by
 *     itself at ≤ 5 m (phones are often 5–20 m off indoors, so we never silently accept a rough fix);
 *  2. the map (satellite by default) — tap anywhere or drag the pin onto the shop's door. This is the
 *     exact step: 6 decimals ≈ 10 cm;
 *  3. paste a Google Maps link or "lat, lng" if that's easier.
 * Leaflet + free tiles (Esri satellite, OpenStreetMap streets); loaded only on this settings page.
 */
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Layers, LocateFixed, X } from 'lucide-react';
import { cn } from '../../lib/format';

const ADDIS: [number, number] = [9.0108, 38.7613];
const GOAL_M = 5; // taken automatically only this precise
const GPS_SECONDS = 45;

const satellite = () =>
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20,
    maxNativeZoom: 19,
    attribution: 'Imagery © Esri',
  });
const streets = () =>
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '© OpenStreetMap' });

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:30px;height:42px;transform:translate(-15px,-40px)"><svg viewBox="0 0 30 42" width="30" height="42"><path d="M15 41C15 41 28 25.5 28 15A13 13 0 0 0 2 15C2 25.5 15 41 15 41Z" fill="#B98B57" stroke="#0D1015" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#0D1015"/></svg></div>',
  iconSize: [0, 0],
});

/** Google Maps links (@lat,lng · q=lat,lng · !3dlat!4dlng) or plain "lat, lng". */
export function parseLatLng(text: string): [number, number] | null {
  const pats = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/];
  for (const p of pats) {
    const m = text.match(p);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return [lat, lng];
    }
  }
  return null;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

type Gps = { state: 'idle' } | { state: 'searching'; acc: number | null; left: number } | { state: 'done'; acc: number } | { state: 'error'; msg: string };

export function ShopLocationPicker({ lat, lng, onChange }: { lat: number | null; lng: number | null; onChange: (lat: number | null, lng: number | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const circle = useRef<L.Circle | null>(null);
  const layer = useRef<{ sat: L.TileLayer; street: L.TileLayer; on: 'sat' | 'street' } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [gps, setGps] = useState<Gps>({ state: 'idle' });
  const [paste, setPaste] = useState('');
  const [view, setView] = useState<'sat' | 'street'>('sat');
  const watch = useRef<{ id: number; timer: ReturnType<typeof setInterval> } | null>(null);
  const stopGpsRef = useRef<() => void>(() => undefined);

  const place = (la: number, ln: number, zoom?: number) => {
    const m = map.current;
    if (!m) return;
    const ll = L.latLng(round6(la), round6(ln));
    if (!marker.current) {
      marker.current = L.marker(ll, { icon: pinIcon, draggable: true, autoPan: true }).addTo(m);
      marker.current.on('dragend', () => {
        const p = marker.current!.getLatLng();
        stopGpsRef.current();
        onChangeRef.current(round6(p.lat), round6(p.lng));
      });
    } else marker.current.setLatLng(ll);
    if (zoom) m.setView(ll, zoom);
    onChangeRef.current(ll.lat, ll.lng);
  };

  // Map once
  useEffect(() => {
    if (!box.current || map.current) return;
    const start: [number, number] = lat !== null && lng !== null ? [lat, lng] : ADDIS;
    const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(start, lat !== null ? 19 : 13);
    const sat = satellite().addTo(m);
    layer.current = { sat, street: streets(), on: 'sat' };
    m.on('click', (e: L.LeafletMouseEvent) => manual(e.latlng.lat, e.latlng.lng));
    map.current = m;
    if (lat !== null && lng !== null) {
      marker.current = L.marker(start, { icon: pinIcon, draggable: true, autoPan: true }).addTo(m);
      marker.current.on('dragend', () => {
        const p = marker.current!.getLatLng();
        stopGpsRef.current();
        onChangeRef.current(round6(p.lat), round6(p.lng));
      });
    }
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pin where the form says (e.g. after Discard)
  useEffect(() => {
    if (!map.current || lat === null || lng === null) return;
    const cur = marker.current?.getLatLng();
    if (!cur || round6(cur.lat) !== lat || round6(cur.lng) !== lng) place(lat, lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  /** The user placed the pin themselves: stop any GPS search so it can't move the pin afterwards. */
  const manual = (la: number, ln: number, zoom?: number) => {
    stopGps();
    circle.current?.remove();
    circle.current = null;
    setGps({ state: 'idle' });
    place(la, ln, zoom);
  };

  const toggleView = () => {
    const l = layer.current;
    const m = map.current;
    if (!l || !m) return;
    if (l.on === 'sat') {
      m.removeLayer(l.sat);
      l.street.addTo(m);
      l.on = 'street';
    } else {
      m.removeLayer(l.street);
      l.sat.addTo(m);
      l.on = 'sat';
    }
    setView(l.on);
  };

  const stopGps = () => {
    if (watch.current) {
      navigator.geolocation.clearWatch(watch.current.id);
      clearInterval(watch.current.timer);
      watch.current = null;
    }
  };
  stopGpsRef.current = () => {
    stopGps();
    setGps((g) => (g.state === 'searching' ? { state: 'idle' } : g));
  };
  useEffect(() => stopGps, []);

  const showAccuracy = (la: number, ln: number, acc: number) => {
    const m = map.current;
    if (!m) return;
    if (!circle.current) circle.current = L.circle([la, ln], { radius: acc, color: '#2AABEE', weight: 1, fillOpacity: 0.12 }).addTo(m);
    else circle.current.setLatLng([la, ln]).setRadius(acc);
  };

  const useGps = () => {
    if (!navigator.geolocation) return setGps({ state: 'error', msg: 'This browser can’t read the location — use the map instead.' });
    stopGps();
    let best: GeolocationPosition | null = null;
    let left = GPS_SECONDS;
    setGps({ state: 'searching', acc: null, left });
    const finish = (pos: GeolocationPosition | null) => {
      stopGps();
      if (!pos) return setGps({ state: 'error', msg: 'No GPS signal — go near a window or outside, or pin it on the map.' });
      place(pos.coords.latitude, pos.coords.longitude, 19);
      setGps({ state: 'done', acc: Math.round(pos.coords.accuracy) });
    };
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        showAccuracy(best.coords.latitude, best.coords.longitude, best.coords.accuracy);
        map.current?.setView([best.coords.latitude, best.coords.longitude], Math.max(map.current.getZoom(), 17));
        setGps({ state: 'searching', acc: Math.round(best.coords.accuracy), left });
        if (pos.coords.accuracy <= GOAL_M) finish(pos);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          stopGps();
          setGps({ state: 'error', msg: 'Location is blocked for this site — allow it in the browser, or pin it on the map.' });
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: GPS_SECONDS * 1000 },
    );
    const timer = setInterval(() => {
      left -= 1;
      if (left <= 0) finish(best);
      else setGps((g) => (g.state === 'searching' ? { ...g, left } : g));
    }, 1000);
    watch.current = { id, timer };
  };

  const useBestNow = () => {
    // Accept the current best (rough) reading — then fine-tune by dragging the pin
    const c = circle.current?.getLatLng();
    const r = circle.current?.getRadius();
    stopGps();
    if (c && r) {
      place(c.lat, c.lng, 19);
      setGps({ state: 'done', acc: Math.round(r) });
    } else setGps({ state: 'idle' });
  };

  return (
    <div className="space-y-3">
      <div className="relative isolate z-0 overflow-hidden rounded-2xl border border-seam">
        <div ref={box} className="h-80 w-full bg-wool-2 md:h-96" />
        {/* crosshair hint when nothing is pinned yet */}
        {lat === null && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] mx-auto w-fit rounded-full bg-ink/85 px-3 py-1.5 text-xs text-chalk backdrop-blur">
            Tap the map on the shop’s door
          </div>
        )}
        <button
          type="button"
          onClick={toggleView}
          className="absolute right-3 top-3 z-[500] inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-xs text-chalk backdrop-blur hover:bg-ink"
        >
          <Layers className="size-3.5" /> {view === 'sat' ? 'Streets' : 'Satellite'}
        </button>
      </div>

      {/* GPS */}
      <div className="flex flex-wrap items-center gap-3">
        {gps.state === 'searching' ? (
          <>
            <span className="inline-flex items-center gap-2 text-sm">
              <span className="size-2 animate-pulse rounded-full bg-[#2AABEE]" />
              {gps.acc === null ? 'Finding you…' : `±${gps.acc} m`}
              <span className="text-steel">· waiting for ±{GOAL_M} m · {gps.left}s</span>
            </span>
            {gps.acc !== null && (
              <button type="button" onClick={useBestNow} className="text-sm text-camel hover:underline">
                Use this, I’ll adjust
              </button>
            )}
            <button type="button" onClick={() => (stopGps(), setGps({ state: 'idle' }))} className="text-steel hover:text-chalk" aria-label="Stop">
              <X className="size-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={useGps}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-camel/50 px-4 text-sm text-camel hover:bg-camel/10"
          >
            <LocateFixed className="size-4" /> Use my current location
          </button>
        )}
      </div>
      {gps.state === 'done' && (
        <p className={cn('text-sm', gps.acc <= GOAL_M ? 'text-ok' : 'text-camel')}>
          {gps.acc <= GOAL_M
            ? `✓ Pinned within ±${gps.acc} m.`
            : `Pinned within ±${gps.acc} m — zoom in and drag the pin onto the shop’s door to make it exact.`}
        </p>
      )}
      {gps.state === 'error' && <p className="text-sm text-camel">{gps.msg}</p>}

      {/* Coordinates + paste */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Crosshair className="size-4 text-steel" />
        {lat !== null && lng !== null ? (
          <span className="font-mono">
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </span>
        ) : (
          <span className="text-steel">Not pinned yet</span>
        )}
      </div>
      <input
        value={paste}
        onChange={(e) => {
          setPaste(e.target.value);
          const p = parseLatLng(e.target.value);
          if (p) manual(p[0], p[1], 19);
        }}
        placeholder="Or paste a Google Maps link / “9.0123, 38.7456”"
        className="h-11 w-full rounded-xl border border-seam bg-transparent px-3 text-sm placeholder:text-steel focus:border-camel focus:outline-none"
      />
    </div>
  );
}
