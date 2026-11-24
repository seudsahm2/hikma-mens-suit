import { cn } from '../../lib/format';
import type { User } from '../../lib/types';

/** Round photo from Telegram, or the first letter of the name. */
export function Avatar({ user, className }: { user: Pick<User, 'fullName' | 'photoUrl'>; className?: string }) {
  return user.photoUrl ? (
    <img src={user.photoUrl} alt="" referrerPolicy="no-referrer" className={cn('rounded-full object-cover', className)} />
  ) : (
    <span className={cn('grid place-items-center rounded-full bg-camel font-display font-bold text-ink', className)}>{user.fullName.trim().slice(0, 1).toUpperCase()}</span>
  );
}
