/**
 * Owner only: who runs the shop.
 *  • Invite by phone or @username → they accept in Telegram → you tick "Make admin".
 *  • Search everyone the shop knows (customers, delivery people, admins) → make admin / remove.
 * No passwords: admins sign in with Telegram.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Search, Send, ShieldCheck, UserPlus, X } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { cn, formatDateTime } from '../../lib/format';
import { adminApi, Card, PageHeader } from '../ui';

interface Invite { id: string; contact: string; status: 'sent' | 'accepted' | 'declined'; name: string | null; username: string | null; createdAt: string; respondedAt: string | null; link: string }
interface Person { key: string; kind: 'owner' | 'admin' | 'driver' | 'customer'; name: string; phone: string | null; username: string | null; telegramId: string | null; staffId: string | null; active: boolean }

const KIND = { owner: 'Owner', admin: 'Admin', driver: 'Delivery', customer: 'Customer' };
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Failed');

export default function Staff() {
  const qc = useQueryClient();
  const [contact, setContact] = useState('');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const invites = useQuery({ queryKey: ['admin', 'staff', 'invites'], queryFn: () => adminApi<{ invites: Invite[] }>('/staff/invites').then((r) => r.invites), refetchInterval: 8000 });
  const people = useQuery({ queryKey: ['admin', 'staff', 'people', debounced], queryFn: () => adminApi<{ people: Person[] }>('/staff/people', { query: { q: debounced } }).then((r) => r.people) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'staff'] });
  };

  const invite = useMutation({
    mutationFn: () => adminApi<{ invite: { link: string; name: string | null }; delivered: boolean }>('/staff/invites', { body: { contact } }),
    onSuccess: (r) => {
      setContact('');
      refresh();
      if (r.delivered) toast.ok(`Sent to ${r.invite.name ?? 'them'} on Telegram`);
      else {
        void navigator.clipboard?.writeText(r.invite.link);
        toast.ok('Not on the bot yet — invite link copied, send it to them');
      }
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const approve = useMutation({
    mutationFn: (id: string) => adminApi(`/staff/invites/${id}/approve`, { body: {} }),
    onSuccess: () => (toast.ok('Admin added — they got a message on Telegram'), refresh()),
    onError: (e) => toast.error(errMsg(e)),
  });
  const cancel = useMutation({ mutationFn: (id: string) => adminApi(`/staff/invites/${id}`, { method: 'DELETE' }), onSuccess: refresh });
  const promote = useMutation({
    mutationFn: (p: Person) => adminApi('/staff/promote', { body: { telegramId: p.telegramId, name: p.name } }),
    onSuccess: () => (toast.ok('Admin added — they got a message on Telegram'), refresh()),
    onError: (e) => toast.error(errMsg(e)),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => adminApi(`/staff/${id}`, { method: 'DELETE' }),
    onSuccess: () => (toast.ok('Admin access removed'), refresh()),
    onError: (e) => toast.error(errMsg(e)),
  });

  const pending = invites.data ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <PageHeader title="Admins" />

      {/* Invite */}
      <Card title="Invite an admin">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (contact.trim()) invite.mutate();
          }}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <Input name="contact" label="Phone or Telegram @username" placeholder="0911… or @name" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <Button type="submit" variant="accent" loading={invite.isPending} disabled={contact.trim().length < 3}>
            <Send className="size-4" /> Send invite
          </Button>
        </form>
        <p className="mt-2 text-xs text-steel">They accept in Telegram, then you confirm here. They sign in with Telegram — no password.</p>

        {pending.length > 0 && (
          <ul className="mt-4 divide-y divide-seam/60 rounded-xl border border-seam/60">
            {pending.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {i.name ?? i.contact}
                    {i.username && <span className="ml-1 text-steel">@{i.username}</span>}
                  </span>
                  <span className={cn('block text-xs', i.status === 'accepted' ? 'text-ok' : i.status === 'declined' ? 'text-danger' : 'text-steel')}>
                    {i.status === 'accepted' ? `✓ Accepted ${i.respondedAt ? formatDateTime(i.respondedAt) : ''} — confirm to make admin` : i.status === 'declined' ? 'Declined' : `Waiting for them to accept · ${i.contact}`}
                  </span>
                </span>
                {i.status === 'accepted' ? (
                  <Button size="sm" variant="accent" loading={approve.isPending && approve.variables === i.id} onClick={() => approve.mutate(i.id)}>
                    <Check className="size-4" /> Make admin
                  </Button>
                ) : i.status === 'sent' ? (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(i.link);
                      toast.ok('Invite link copied');
                    }}
                    className="inline-flex items-center gap-1 text-xs text-camel"
                  >
                    <Copy className="size-3.5" /> Link
                  </button>
                ) : null}
                <button type="button" onClick={() => cancel.mutate(i.id)} className="text-steel hover:text-danger" aria-label="Cancel invite">
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Everyone */}
      <Card title="People">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-steel" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers, delivery people, admins…" className="h-11 w-full rounded-xl border border-seam bg-wool pl-9 pr-3 text-sm focus:border-camel focus:outline-none" />
        </label>
        <ul className="mt-3 divide-y divide-seam/60">
          {(people.data ?? []).map((p) => {
            const isAdmin = p.kind === 'admin' || p.kind === 'owner' || Boolean(p.staffId);
            return (
              <li key={p.key} className="flex items-center gap-3 py-3 text-sm">
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-full font-semibold', isAdmin ? 'bg-camel text-ink' : 'bg-wool-2 text-chalk')}>{p.name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 truncate">
                    {p.name}
                    <span className={cn('rounded-full px-2 py-px text-[0.62rem]', p.kind === 'owner' ? 'bg-camel text-ink' : p.kind === 'admin' ? 'bg-camel/20 text-camel' : 'bg-wool-2 text-steel')}>{KIND[p.kind]}</span>
                    {p.kind !== 'admin' && p.kind !== 'owner' && p.staffId && <span className="rounded-full bg-camel/20 px-2 py-px text-[0.62rem] text-camel">Admin</span>}
                    {(p.kind === 'admin' || p.kind === 'owner') && !p.active && <span className="rounded-full bg-danger/15 px-2 py-px text-[0.62rem] text-danger">Off</span>}
                  </span>
                  <span className="block truncate font-mono text-xs text-steel">{[p.username && `@${p.username}`, p.phone].filter(Boolean).join(' · ') || (p.telegramId ? 'Telegram' : '—')}</span>
                </span>
                {p.kind === 'owner' ? (
                  <ShieldCheck className="size-4 text-camel" />
                ) : isAdmin && p.staffId ? (
                  <button
                    type="button"
                    onClick={() => window.confirm(`Remove admin access for ${p.name}? They’re told on Telegram.`) && revoke.mutate(p.staffId!)}
                    className="text-xs text-steel hover:text-danger"
                  >
                    Remove admin
                  </button>
                ) : p.telegramId ? (
                  <button
                    type="button"
                    onClick={() => window.confirm(`Make ${p.name} an admin? They can see orders, customers and products.`) && promote.mutate(p)}
                    className="inline-flex items-center gap-1 text-xs text-camel"
                  >
                    <UserPlus className="size-3.5" /> Make admin
                  </button>
                ) : null}
              </li>
            );
          })}
          {people.data && !people.data.length && <li className="py-6 text-center text-sm text-steel">Nobody found.</li>}
        </ul>
      </Card>
    </div>
  );
}
