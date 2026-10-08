import { useEffect, useId, useState } from 'react';
import { formatDecimal, parseDecimal, roundTo } from '@shared/domain/text';
import { cx, input, label as labelClass } from './ui';

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  decimals?: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  className?: string;
};

/** Numeric input that accepts comma or point and commits on blur or Enter. */
export function NumberField({ label, value, onChange, decimals = 2, min, max, step, suffix, disabled, className }: Props) {
  const id = useId();
  const [text, setText] = useState(formatDecimal(value, decimals));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(formatDecimal(value, decimals));
  }, [value, decimals, focused]);

  const commit = () => {
    const parsed = parseDecimal(text);
    if (parsed === null) {
      setText(formatDecimal(value, decimals));
      return;
    }
    let next = roundTo(parsed, decimals);
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    setText(formatDecimal(next, decimals));
    if (next !== value) onChange(next);
  };

  const nudge = (direction: 1 | -1) => {
    const delta = step ?? 1 / 10 ** decimals;
    let next = roundTo(value + direction * delta, decimals);
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    setText(formatDecimal(next, decimals));
    if (next !== value) onChange(next);
  };

  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          className={cx(input, suffix && 'pr-8')}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              nudge(1);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              nudge(-1);
            }
          }}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}
