import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, PageLoader } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import type { User } from '../../lib/types';
import { adminApi, Card, PageHeader } from '../ui';

type StaffUser = User & { isActive: boolean };

export default function Staff() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: () => adminApi<{ staff: StaffUser[] }>('/staff').then((r) => r.staff),
  });
  const [form, setForm] = useState({ fullName: '', phone: '', password: '' });
  const onError = (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Failed');
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'staff'] });

  const create = useMutation({
    mutationFn: () => adminApi('/staff', { body: form }),
    onSuccess: () => {
      toast.ok('Admin added. Share the phone and password with them.');
      setForm({ fullName: '', phone: '', password: '' });
      void refresh();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: (v: { id: string; isActive?: boolean; password?: string }) => adminApi(`/staff/${v.id}`, { method: 'PATCH', body: v }),
    onSuccess: () => {
      toast.ok('Updated');
      void refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi(`/staff/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.ok('Admin removed');
      void refresh();
    },
    onError,
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Admins" />
      <Card title="People who can manage the shop">
        <ul className="divide-y divide-seam">
          {data?.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  {s.fullName} {!s.isActive && <span className="text-xs text-danger">· disabled</span>}
                </p>
                <p className="font-mono text-xs text-steel">
                  {s.phone} · {s.role === 'OWNER' ? 'Owner' : 'Admin'}
                </p>
              </div>
              {s.role === 'ADMIN' && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const password = window.prompt(`New password for ${s.fullName} (min 8 characters)`);
                      if (password && password.length >= 8) update.mutate({ id: s.id, password });
                    }}
                  >
                    Reset password
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => update.mutate({ id: s.id, isActive: !s.isActive })}>
                    {s.isActive ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => window.confirm(`Remove ${s.fullName}?`) && remove.mutate(s.id)}>
                    Remove
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Add an admin">
        <p className="mb-4 text-sm text-steel">Admins can manage orders, products and stock. Only you can change settings and admins.</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Input name="fullName" label="Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input name="phone" label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input
            name="password"
            label="Password"
            type="text"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            hint="At least 8 characters"
          />
        </div>
        <Button
          variant="accent"
          className="mt-5"
          loading={create.isPending}
          disabled={form.fullName.length < 2 || form.phone.length < 9 || form.password.length < 8}
          onClick={() => create.mutate()}
        >
          Add admin
        </Button>
      </Card>
    </div>
  );
}
