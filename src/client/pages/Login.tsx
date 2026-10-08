import { useState } from 'react';
import { t } from '../i18n/strings';
import { api, ApiError, errorMessage } from '../persistence/apiClient';
import { btn, cx, input, label } from '../components/common/ui';

type Props = { onLoggedIn: () => void };

/** Login page with e-mail and password. */
export function Login({ onLoggedIn }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.login({ email: email.trim(), password });
      onLoggedIn();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError(t.login.invalid);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t.login.title}>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <div>
          <label className={label} htmlFor="login-email">
            {t.login.email}
          </label>
          <input id="login-email" className={input} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className={label} htmlFor="login-password">
            {t.login.password}
          </label>
          <input id="login-password" className={input} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={cx(btn.base, btn.primary, 'mt-1')} disabled={busy}>
          {busy ? t.login.submitting : t.login.submit}
        </button>
        <p className="text-xs text-gray-500">{t.login.forgot}</p>
      </form>
    </AuthShell>
  );
}

/** Centered card used by the login, setup and password pages. */
export function AuthShell({ title, children, intro }: { title: string; children: React.ReactNode; intro?: string }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t.app.title}</p>
        <h1 className="mb-1 text-xl font-semibold text-gray-900">{title}</h1>
        {intro && <p className="mb-4 text-sm text-gray-600">{intro}</p>}
        {!intro && <div className="mb-4" />}
        {children}
      </div>
    </main>
  );
}
