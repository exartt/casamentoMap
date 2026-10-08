import { useMemo, useState } from 'react';
import { CSV_PREVIEW_ROWS } from '@shared/config/defaults';
import {
  applyImport,
  decodeGuestFile,
  defaultMapping,
  parseGuestCsv,
  parsePastedNames,
  prepareImport,
  type ColumnMapping,
  type ImportField,
  type ImportMode,
  type ParsedCsv,
} from '../../csv/parseGuests';
import { downloadCsvTemplate } from '../../export/exportCsv';
import { t } from '../../i18n/strings';
import { confirmDialog } from '../../store/confirmStore';
import { useProjectStore } from '../../store/projectStore';
import { toastError, toastSuccess } from '../../store/toastStore';
import { btn, checkbox, cx, input, label, select } from '../common/ui';
import { Modal } from './Modal';

type Props = { onClose: () => void };

const FIELDS: ImportField[] = ['name', 'group', 'side', 'isChild', 'dietary', 'notes', 'table'];

/** Guest import dialog: file or pasted list, column mapping, preview, duplicates and mode. */
export function ImportGuestsDialog({ onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const commit = useProjectStore((s) => s.commit);
  const [rawText, setRawText] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [hasHeader, setHasHeader] = useState<boolean | undefined>(undefined);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [keepDuplicates, setKeepDuplicates] = useState(false);
  const [mode, setMode] = useState<ImportMode>('append');
  const [source, setSource] = useState<'file' | 'paste'>('file');

  const parsed: ParsedCsv | null = useMemo(() => {
    if (rawText === null) return null;
    return source === 'paste' ? parsePastedNames(rawText) : parseGuestCsv(rawText, hasHeader === undefined ? {} : { hasHeader });
  }, [rawText, hasHeader, source]);

  const prepared = useMemo(() => {
    if (!parsed || !project) return null;
    return prepareImport(parsed, mapping, project.guests, mode);
  }, [parsed, mapping, project, mode]);

  const loadParsed = (text: string, from: 'file' | 'paste') => {
    setSource(from);
    setRawText(text);
    setHasHeader(undefined);
    const p = from === 'paste' ? parsePastedNames(text) : parseGuestCsv(text);
    setMapping(defaultMapping(p));
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const bytes = await file.arrayBuffer();
    loadParsed(decodeGuestFile(bytes), 'file');
  };

  const toggleHeader = (value: boolean) => {
    if (rawText === null) return;
    setHasHeader(value);
    setMapping(defaultMapping(parseGuestCsv(rawText, { hasHeader: value })));
  };

  const runImport = async () => {
    if (!project || !prepared || !parsed) return;
    if (mapping.name === undefined) {
      toastError(t.importGuests.nameColumnRequired);
      return;
    }
    if (prepared.guests.length === 0 && !(keepDuplicates && prepared.duplicates.length > 0)) {
      toastError(t.importGuests.noRows);
      return;
    }
    if (mode === 'replace') {
      const ok = await confirmDialog({ message: t.importGuests.replaceConfirm, confirmLabel: t.importGuests.modeReplace, destructive: true });
      if (!ok) return;
    }
    const { project: next, summary } = applyImport(project, prepared, mode, keepDuplicates);
    commit(() => next);
    toastSuccess(t.importGuests.result(summary.imported, summary.duplicatesSkipped, summary.preAllocated));
    if (summary.errors.length > 0) toastError(t.importGuests.errors, summary.errors);
    onClose();
  };

  const columns = parsed ? Array.from({ length: parsed.columnCount }, (_, i) => i) : [];
  const columnLabel = (i: number) => (parsed?.headers ? `${i + 1}: ${parsed.headers[i] || '(sem nome)'}` : `Coluna ${i + 1}`);

  return (
    <Modal
      title={t.importGuests.title}
      open
      onClose={onClose}
      size="xl"
      footer={
        <>
          <button type="button" className={cx(btn.base, btn.secondary)} onClick={onClose}>
            {t.app.cancel}
          </button>
          <button type="button" className={cx(btn.base, btn.primary)} onClick={() => void runImport()} disabled={!prepared}>
            {t.importGuests.import}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={label}>{t.importGuests.file}</label>
            <input type="file" accept=".csv,.txt,text/csv,text/plain" className="block w-full text-sm" onChange={(e) => void onFile(e.target.files?.[0])} />
            <button type="button" className={cx(btn.base, btn.ghost, btn.small, 'mt-2')} onClick={downloadCsvTemplate}>
              {t.importGuests.template}
            </button>
          </div>
          <div>
            <label className={label}>{t.importGuests.paste}</label>
            <textarea className={cx(input, 'min-h-[5rem]')} placeholder={t.importGuests.pastePlaceholder} value={pasted} onChange={(e) => setPasted(e.target.value)} />
            <button type="button" className={cx(btn.base, btn.secondary, btn.small, 'mt-2')} onClick={() => loadParsed(pasted, 'paste')} disabled={pasted.trim() === ''}>
              {t.importGuests.parse}
            </button>
          </div>
        </div>

        {parsed && prepared && (
          <>
            {source === 'file' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className={checkbox} checked={parsed.headers !== null} onChange={(e) => toggleHeader(e.target.checked)} />
                {t.importGuests.hasHeader}
              </label>
            )}
            {source === 'file' && columns.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold">{t.importGuests.mapping}</h3>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {FIELDS.map((field) => (
                    <div key={field}>
                      <label className={label}>{t.importGuests.fields[field]}</label>
                      <select
                        className={select}
                        value={mapping[field] ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setMapping((m) => {
                            const next = { ...m };
                            if (value === '') delete next[field];
                            else next[field] = Number(value);
                            return next;
                          });
                        }}
                      >
                        <option value="">{t.importGuests.ignore}</option>
                        {columns.map((i) => (
                          <option key={i} value={i}>
                            {columnLabel(i)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-1 text-sm font-semibold">{t.importGuests.preview}</h3>
              <div className="max-h-56 overflow-auto rounded-md border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      {columns.map((i) => (
                        <th key={i} className="px-2 py-1 font-medium">
                          {columnLabel(i)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, CSV_PREVIEW_ROWS).map((row, r) => (
                      <tr key={r} className="border-t border-gray-100">
                        {columns.map((i) => (
                          <td key={i} className="px-2 py-1">
                            {row[i]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                <span>{t.importGuests.validRows(prepared.guests.length)}</span>
                <span>{t.importGuests.emptyRows(parsed.emptyLines + prepared.invalidRows)}</span>
                <span>{t.importGuests.duplicates(prepared.duplicates.length)}</span>
              </div>
              {prepared.duplicates.length > 0 && (
                <div className="mt-2 flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="dup" checked={!keepDuplicates} onChange={() => setKeepDuplicates(false)} />
                    {t.importGuests.skipDuplicates}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="dup" checked={keepDuplicates} onChange={() => setKeepDuplicates(true)} />
                    {t.importGuests.keepDuplicates}
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="mode" checked={mode === 'append'} onChange={() => setMode('append')} />
                {t.importGuests.modeAppend}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                {t.importGuests.modeReplace}
              </label>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
