import { useCallback, useEffect, useState } from 'react';
import { PASSWORD_MIN_LENGTH } from '@shared/config/defaults';
import type { User, UserRole } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { api, errorMessage } from '../../persistence/apiClient';
import { confirmDialog, promptDialog } from '../../store/confirmStore';
import { useProjectStore } from '../../store/projectStore';
import { toastError, toastSuccess } from '../../store/toastStore';
import { btn, cx, input, label, select } from '../common/ui';
import { Modal } from '../dialogs/Modal';

type Props = { onClose: () => void };

/** Admin dialog to list, add, reset the password of and remove people with access. */
export function UsersDialog({ onClose }: Props) {
  const me = useProjectStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('editor');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listUsers();
      setUsers(res.users);
    } catch (e) {
      toastError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(t.changePassword.tooShort);
      return;
    }
    setBusy(true);
    try {
      await api.createUser({ name: name.trim(), email: email.trim(), password, role });
      setName('');
      setEmail('');
      setPassword('');
      setRole('editor');
      toastSuccess(t.users.created);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (user: User) => {
    const value = await promptDialog({
      title: t.users.resetPassword,
      message: t.users.resetPrompt(user.name),
      promptLabel: t.users.tempPassword,
      promptType: 'text',
      promptMinLength: PASSWORD_MIN_LENGTH,
      confirmLabel: t.users.resetPassword,
    });
    if (value === null) return;
    try {
      await api.updateUser(user.id, { password: value });
      toastSuccess(t.users.passwordReset);
      await load();
    } catch (err) {
      toastError(errorMessage(err));
    }
  };

  const changeRole = async (user: User, next: UserRole) => {
    try {
      await api.updateUser(user.id, { role: next });
      await load();
    } catch (err) {
      toastError(errorMessage(err));
    }
  };

  const remove = async (user: User) => {
    const ok = await confirmDialog({ message: t.users.removeConfirm(user.name), confirmLabel: t.users.remove, destructive: true });
    if (!ok) return;
    try {
      await api.deleteUser(user.id);
      await load();
    } catch (err) {
      toastError(errorMessage(err));
    }
  };

  return (
    <Modal title={t.users.title} open onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="text-left text-xs text-gray-500">
            <tr>
              <th className="py-1 pr-2 font-medium">{t.users.name}</th>
              <th className="py-1 pr-2 font-medium">{t.users.email}</th>
              <th className="py-1 pr-2 font-medium">{t.users.role}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gray-100">
                <td className="py-1.5 pr-2">
                  {u.name}
                  {me?.id === u.id && <span className="ml-1 text-xs text-gray-500">({t.users.you})</span>}
                  {u.mustChangePassword && <span className="ml-1 text-xs text-amber-700">· {t.users.mustChange}</span>}
                </td>
                <td className="py-1.5 pr-2 text-gray-600">{u.email}</td>
                <td className="py-1.5 pr-2">
                  <select className={cx(select, 'py-1 text-xs')} value={u.role} disabled={me?.id === u.id} onChange={(e) => void changeRole(u, e.target.value as UserRole)} aria-label={t.users.role}>
                    <option value="editor">{t.users.roleEditor}</option>
                    <option value="admin">{t.users.roleAdmin}</option>
                  </select>
                </td>
                <td className="py-1.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button type="button" className={cx(btn.base, btn.secondary, btn.small)} onClick={() => void reset(u)}>
                      {t.users.resetPassword}
                    </button>
                    <button type="button" className={cx(btn.base, btn.danger, btn.small)} onClick={() => void remove(u)} disabled={me?.id === u.id}>
                      {t.users.remove}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-xs text-gray-500">
                  {t.app.none}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>

        <form onSubmit={(e) => void create(e)} className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <h3 className="mb-2 text-sm font-semibold">{t.users.create}</h3>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className={label}>{t.users.name}</label>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className={label}>{t.users.email}</label>
              <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className={label}>{t.users.tempPassword}</label>
              <input className={input} type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={PASSWORD_MIN_LENGTH} autoComplete="off" />
            </div>
            <div>
              <label className={label}>{t.users.role}</label>
              <select className={select} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="editor">{t.users.roleEditor}</option>
                <option value="admin">{t.users.roleAdmin}</option>
              </select>
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
          <div className="mt-3 flex justify-end">
            <button type="submit" className={cx(btn.base, btn.primary)} disabled={busy}>
              {t.users.create}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
