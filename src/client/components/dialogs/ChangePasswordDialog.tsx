import { t } from '../../i18n/strings';
import { ChangePasswordForm } from '../../pages/ChangePassword';
import { Modal } from './Modal';

type Props = { onClose: () => void };

/** Password change as a dialog from the user menu. */
export function ChangePasswordDialog({ onClose }: Props) {
  return (
    <Modal title={t.changePassword.title} open onClose={onClose} size="sm">
      <ChangePasswordForm onDone={onClose} onCancel={onClose} />
    </Modal>
  );
}
