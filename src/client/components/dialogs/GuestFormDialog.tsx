import { useState } from 'react';
import { LIMITS } from '@shared/config/defaults';
import type { Guest, GuestSide } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { saveGuest } from '../../store/actions';
import { btn, checkbox, cx, input, label, select } from '../common/ui';
import { Modal } from './Modal';

type Props = { guest: Guest | null; groups: string[]; onClose: () => void };

/** Form to add or edit a guest. */
export function GuestFormDialog({ guest, groups, onClose }: Props) {
  const [name, setName] = useState(guest?.name ?? '');
  const [group, setGroup] = useState(guest?.group ?? '');
  const [side, setSide] = useState<GuestSide | ''>(guest?.side ?? '');
  const [isChild, setIsChild] = useState(guest?.isChild ?? false);
  const [dietary, setDietary] = useState(guest?.dietary ?? '');
  const [notes, setNotes] = useState(guest?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed === '') {
      setError(t.guests.nameRequired);
      return;
    }
    const next: Guest = { id: guest?.id ?? crypto.randomUUID(), name: trimmed };
    if (group.trim()) next.group = group.trim();
    if (side) next.side = side;
    if (isChild) next.isChild = true;
    if (dietary.trim()) next.dietary = dietary.trim();
    if (notes.trim()) next.notes = notes.trim();
    saveGuest(next);
    onClose();
  };

  return (
    <Modal
      title={guest ? t.guests.editGuest : t.guests.addGuest}
      open
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className={cx(btn.base, btn.secondary)} onClick={onClose}>
            {t.app.cancel}
          </button>
          <button type="button" className={cx(btn.base, btn.primary)} onClick={submit}>
            {t.app.save}
          </button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div>
          <label className={label}>{t.guests.name}</label>
          <input className={input} value={name} maxLength={LIMITS.maxNameLength} onChange={(e) => setName(e.target.value)} autoFocus />
          {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
        </div>
        <div>
          <label className={label}>{t.guests.group}</label>
          <input className={input} value={group} maxLength={LIMITS.maxLabelLength} list="guest-groups" onChange={(e) => setGroup(e.target.value)} />
          <datalist id="guest-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={label}>{t.guests.side}</label>
          <select className={select} value={side} onChange={(e) => setSide(e.target.value as GuestSide | '')}>
            <option value="">{t.guests.sideNone}</option>
            <option value="bride">{t.guests.sideBride}</option>
            <option value="groom">{t.guests.sideGroom}</option>
            <option value="both">{t.guests.sideBoth}</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className={checkbox} checked={isChild} onChange={(e) => setIsChild(e.target.checked)} />
          {t.guests.isChild}
        </label>
        <div>
          <label className={label}>{t.guests.dietary}</label>
          <input className={input} value={dietary} maxLength={LIMITS.maxNotesLength} onChange={(e) => setDietary(e.target.value)} />
        </div>
        <div>
          <label className={label}>{t.guests.notes}</label>
          <textarea className={cx(input, 'min-h-[3rem]')} value={notes} maxLength={LIMITS.maxNotesLength} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button type="submit" className="hidden" aria-hidden="true" />
      </form>
    </Modal>
  );
}
