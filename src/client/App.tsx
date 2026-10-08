import { useCallback, useEffect, useState } from 'react';
import { Toasts } from './components/common/Toasts';
import { btn, cx } from './components/common/ui';
import { t } from './i18n/strings';
import { api, ApiError, errorMessage, setCsrfToken } from './persistence/apiClient';
import { ChangePasswordPage } from './pages/ChangePassword';
import { Editor } from './pages/Editor';
import { Login } from './pages/Login';
import { PublicView } from './pages/PublicView';
import { Setup } from './pages/Setup';
import { useProjectStore } from './store/projectStore';

type Screen = { kind: 'loading' } | { kind: 'login' } | { kind: 'setup' } | { kind: 'password' } | { kind: 'editor' } | { kind: 'error'; message: string };

const PUBLIC_PREFIX = '/ver/';

const SLOW_HINT_MS = 3000;

function publicToken(): string | null {
  const path = window.location.pathname;
  if (!path.startsWith(PUBLIC_PREFIX)) return null;
  const token = path.slice(PUBLIC_PREFIX.length).replace(/\/+$/, '');
  return token === '' ? null : token;
}

function setPath(path: string): void {
  if (window.location.pathname !== path) window.history.replaceState(null, '', path);
}

/** Root component: routes between the public view and the authenticated screens. */
export function App() {
  const token = publicToken();
  if (token) return <PublicView token={token} />;
  return <AuthGate />;
}

function AuthGate() {
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [slow, setSlow] = useState(false);
  const initialize = useProjectStore((s) => s.initialize);
  const mustChange = useProjectStore((s) => s.user?.mustChangePassword ?? false);

  const load = useCallback(async () => {
    setScreen({ kind: 'loading' });
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), SLOW_HINT_MS);
    try {
      const response = await api.getProject();
      initialize(response);
      setCsrfToken(response.csrfToken);
      setPath('/');
      setScreen(response.user.mustChangePassword ? { kind: 'password' } : { kind: 'editor' });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
        try {
          const status = await api.setupStatus();
          if (status.needsSetup) {
            setPath('/setup');
            setScreen({ kind: 'setup' });
          } else {
            setPath('/login');
            setScreen({ kind: 'login' });
          }
        } catch (inner) {
          setScreen({ kind: 'error', message: errorMessage(inner) });
        }
      } else {
        setScreen({ kind: 'error', message: errorMessage(error) });
      }
    } finally {
      clearTimeout(timer);
    }
  }, [initialize]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (screen.kind === 'password' && !mustChange) setScreen({ kind: 'editor' });
  }, [mustChange, screen.kind]);

  if (screen.kind === 'loading') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-gray-100 p-6 text-center text-gray-600">
        <p>{t.app.loading}</p>
        {slow && <p className="text-sm text-gray-500">{t.app.loadingSlow}</p>}
      </main>
    );
  }
  if (screen.kind === 'error') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-100 p-6 text-center">
        <p className="text-gray-800">{screen.message}</p>
        <button type="button" className={cx(btn.base, btn.primary)} onClick={() => void load()}>
          {t.app.retry}
        </button>
      </main>
    );
  }
  if (screen.kind === 'setup') return <Setup onDone={() => void load()} />;
  if (screen.kind === 'login') return <Login onLoggedIn={() => void load()} />;
  if (screen.kind === 'password') {
    return (
      <>
        <ChangePasswordPage onDone={() => setScreen({ kind: 'editor' })} />
        <Toasts />
      </>
    );
  }
  return <Editor />;
}
