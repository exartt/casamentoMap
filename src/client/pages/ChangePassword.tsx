import { useState } from 'react';
import { PASSWORD_MIN_LENGTH } from '@shared/config/defaults';
import { btn, cx, input, label } from '../components/common/ui';
import { t } from '../i18n/strings';
import { api, errorMessage } from '../persistence/apiClient';
import { useProjectStore } from '../store/projectStore';
import { toastSuccess } from '../store/toastStore';
import { AuthShell } from './Login';

type FormProps = { onDone: () => void; onCancel?: () => void };

/** Form that changes the current user's password. */
export function ChangePasswordForm({ onDone, onCancel }: FormProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setUser = useProjectStore((s) => s.setUser);
  const user = useProjectStore((s) => s.user);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < PASSWORD_MIN_LENGTH) {
      setError(t.changePassword.tooShort);
      return;
    }
    if (next !== confirm) {
      setError(t.changePassword.mismatch);
      return;
    }
    setBusy(true);
    try {
      const res = await api.changePassword({ currentPassword: current, newPassword: next });
      setUser(user ? { ...user, mustChangePassword: false } : res.user);
      toastSuccess(t.changePassword.success);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <div>
        <label className={label}>{t.changePassword.current}</label>
        <input className={input} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
      </div>
      <div>
        <label className={label}>{t.changePassword.newPassword}</label>
        <input className={input} type="password" autoComplete="new-password" value={next} minLength={PASSWORD_MIN_LENGTH} onChange={(e) => setNext(e.target.value)} required />
      </div>
      <div>
        <label className={label}>{t.changePassword.confirmPassword}</label>
        <input className={input} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="mt-1 flex justify-end gap-2">
        {onCancel && (
          <button type="button" className={cx(btn.base, btn.secondary)} onClick={onCancel}>
            {t.app.cancel}
          </button>
        )}
        <button type="submit" className={cx(btn.base, btn.primary)} disabled={busy}>
          {t.changePassword.submit}
        </button>
      </div>
    </form>
  );
}

type PageProps = { onDone: () => void };

/** Full page shown when the password is provisional and must be changed. */
export function ChangePasswordPage({ onDone }: PageProps) {
  return (
    <AuthShell title={t.changePassword.title} intro={t.changePassword.required}>
      <ChangePasswordForm onDone={onDone} />
    </AuthShell>
  );
}
