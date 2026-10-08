import { useEffect, useState } from 'react';
import { t } from '../../i18n/strings';
import { useConfirmStore } from '../../store/confirmStore';
import { btn, cx, input, label } from '../common/ui';
import { Modal } from './Modal';

/** Renders the pending confirmation or prompt request from the confirm store. */
export function ConfirmDialog() {
  const request = useConfirmStore((s) => s.request);
  const resolve = useConfirmStore((s) => s.resolve);
  const [value, setValue] = useState('');

  useEffect(() => {
    setValue('');
  }, [request]);

  if (!request) return null;
  const isPrompt = request.promptLabel !== undefined;
  const minLength = request.promptMinLength ?? 0;
  const valid = !isPrompt || value.trim().length >= minLength;
  const confirm = () => {
    if (!valid) return;
    resolve(isPrompt ? value : '');
  };
  return (
    <Modal title={request.title ?? t.app.confirm} open onClose={() => resolve(null)} size="sm" closeOnBackdrop={false}
      footer={
        <>
          <button type="button" className={cx(btn.base, btn.secondary)} onClick={() => resolve(null)}>
            {request.cancelLabel ?? t.app.cancel}
          </button>
          <button type="button" className={cx(btn.base, request.destructive ? btn.danger : btn.primary)} onClick={confirm} disabled={!valid}>
            {request.confirmLabel ?? t.app.confirm}
          </button>
        </>
      }
    >
      <p className="whitespace-pre-line">{request.message}</p>
      {isPrompt && (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
        >
          <label className={label}>{request.promptLabel}</label>
          <input
            type={request.promptType ?? 'text'}
            className={input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete={request.promptType === 'password' ? 'new-password' : 'off'}
          />
        </form>
      )}
    </Modal>
  );
}
