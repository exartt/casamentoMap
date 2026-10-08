import { useState } from 'react';
import { DEFAULT_VENUE, LIMITS, PASSWORD_MIN_LENGTH } from '@shared/config/defaults';
import { NumberField } from '../components/common/NumberField';
import { btn, cx, input, label } from '../components/common/ui';
import { t } from '../i18n/strings';
import { api, errorMessage } from '../persistence/apiClient';
import { AuthShell } from './Login';

type Props = { onDone: () => void };

/** First-run page: creates the project and the first administrator. */
export function Setup({ onDone }: Props) {
  const [projectName, setProjectName] = useState('');
  const [widthM, setWidthM] = useState(DEFAULT_VENUE.widthM);
  const [depthM, setDepthM] = useState(DEFAULT_VENUE.depthM);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(t.changePassword.tooShort);
      return;
    }
    setBusy(true);
    try {
      await api.setup({ projectName: projectName.trim(), venue: { widthM, depthM }, admin: { name: name.trim(), email: email.trim(), password } });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t.setup.title} intro={t.setup.intro}>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <div>
          <label className={label}>{t.setup.projectName}</label>
          <input className={input} value={projectName} maxLength={LIMITS.maxProjectNameLength} placeholder={t.setup.projectNamePlaceholder} onChange={(e) => setProjectName(e.target.value)} required autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t.setup.venueWidth} value={widthM} min={LIMITS.minVenueM} max={LIMITS.maxVenueM} step={0.5} suffix="m" onChange={setWidthM} />
          <NumberField label={t.setup.venueDepth} value={depthM} min={LIMITS.minVenueM} max={LIMITS.maxVenueM} step={0.5} suffix="m" onChange={setDepthM} />
        </div>
        <div>
          <label className={label}>{t.setup.adminName}</label>
          <input className={input} value={name} maxLength={LIMITS.maxNameLength} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={label}>{t.setup.adminEmail}</label>
          <input className={input} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className={label}>{t.setup.adminPassword}</label>
          <input className={input} type="password" autoComplete="new-password" value={password} minLength={PASSWORD_MIN_LENGTH} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={cx(btn.base, btn.primary, 'mt-1')} disabled={busy}>
          {busy ? t.setup.submitting : t.setup.submit}
        </button>
      </form>
    </AuthShell>
  );
}
