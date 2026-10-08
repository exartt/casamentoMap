import { useCallback, useEffect, useState } from 'react';
import type { ShareLinkInfo } from '@shared/api/schemas';
import { formatDateTime } from '../../i18n/format';
import { t } from '../../i18n/strings';
import { api, errorMessage } from '../../persistence/apiClient';
import { confirmDialog } from '../../store/confirmStore';
import { toastError, toastSuccess } from '../../store/toastStore';
import { btn, cx, input, label } from '../common/ui';
import { Modal } from '../dialogs/Modal';

type Props = { onClose: () => void };

/** Admin dialog to create and revoke read-only share links. */
export function ShareLinksDialog({ onClose }: Props) {
  const [links, setLinks] = useState<ShareLinkInfo[]>([]);
  const [labelText, setLabelText] = useState('');
  const [created, setCreated] = useState<{ url: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.listShareLinks();
      setLinks(res.links);
    } catch (e) {
      toastError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.createShareLink({ label: labelText.trim() });
      setCreated({ url: res.url, label: res.link.label });
      setLabelText('');
      await load();
    } catch (err) {
      toastError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (link: ShareLinkInfo) => {
    const ok = await confirmDialog({ message: t.shareLinks.revokeConfirm(link.label), confirmLabel: t.shareLinks.revoke, destructive: true });
    if (!ok) return;
    try {
      await api.revokeShareLink(link.id);
      await load();
    } catch (err) {
      toastError(errorMessage(err));
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toastSuccess(t.toasts.copiedLink);
    } catch {
      toastError(t.app.error);
    }
  };

  return (
    <Modal title={t.shareLinks.title} open onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <p className="text-gray-600">{t.shareLinks.intro}</p>
        {created && (
          <div className="rounded-md border border-brand-300 bg-brand-50 p-3">
            <p className="mb-1 text-sm font-medium text-brand-900">{t.shareLinks.newLink}</p>
            <div className="flex items-center gap-2">
              <input className={cx(input, 'font-mono text-xs')} value={created.url} readOnly onFocus={(e) => e.target.select()} aria-label={created.label} />
              <button type="button" className={cx(btn.base, btn.secondary, btn.small)} onClick={() => void copy(created.url)}>
                {t.app.copy}
              </button>
            </div>
          </div>
        )}
        <form onSubmit={(e) => void create(e)} className="flex items-end gap-2">
          <div className="flex-1">
            <label className={label}>{t.shareLinks.label}</label>
            <input className={input} value={labelText} onChange={(e) => setLabelText(e.target.value)} placeholder={t.shareLinks.labelPlaceholder} required />
          </div>
          <button type="submit" className={cx(btn.base, btn.primary)} disabled={busy || labelText.trim() === ''}>
            {t.shareLinks.create}
          </button>
        </form>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500">
            <tr>
              <th className="py-1 pr-2 font-medium">{t.shareLinks.label}</th>
              <th className="py-1 pr-2 font-medium">{t.shareLinks.createdAt}</th>
              <th className="py-1 pr-2 font-medium">{t.shareLinks.createdBy}</th>
              <th className="py-1 pr-2 font-medium">Status</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.id} className="border-t border-gray-100">
                <td className="py-1.5 pr-2">{link.label}</td>
                <td className="py-1.5 pr-2 text-gray-600">{formatDateTime(link.createdAt)}</td>
                <td className="py-1.5 pr-2 text-gray-600">{link.createdBy}</td>
                <td className="py-1.5 pr-2">
                  {link.revokedAt ? <span className="text-red-700">{t.shareLinks.revoked}</span> : <span className="text-brand-700">{t.shareLinks.active}</span>}
                </td>
                <td className="py-1.5 text-right">
                  {!link.revokedAt && (
                    <button type="button" className={cx(btn.base, btn.danger, btn.small)} onClick={() => void revoke(link)}>
                      {t.shareLinks.revoke}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {links.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-xs text-gray-500">
                  {t.shareLinks.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
