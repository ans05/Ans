/** Small, accessible form primitives used by the editor panel. */

import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { normalizeHex } from '../lib/color';

export function Section({
  index,
  title,
  children,
  aside,
}: {
  index: string;
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  const id = useId();
  return (
    <section className="section" aria-labelledby={id}>
      <header className="section__head">
        <h2 className="section__title" id={id}>
          <span className="section__index" aria-hidden="true">
            {index}
          </span>
          {title}
        </h2>
        {aside ? <div className="section__aside">{aside}</div> : null}
      </header>
      <div className="section__body">{children}</div>
    </section>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  maxLength,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange(value: string): void;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function Slider({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange(value: number): void;
  hint?: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="field field--slider">
      <div className="field__row">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        <output className="field__value" htmlFor={id} aria-live="off">
          {pct}
        </output>
      </div>
      <input
        id={id}
        className="range"
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        aria-valuetext={`${pct} percent`}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{ ['--fill' as string]: `${pct}%` }}
      />
      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}

export function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const [syncedValue, setSyncedValue] = useState(value);
  // When the committed colour changes from outside (picker, preset, load),
  // re-derive the local text during render rather than in an effect.
  if (syncedValue !== value) {
    setSyncedValue(value);
    setText(value);
    setInvalid(false);
  }

  const commit = (raw: string) => {
    const hex = normalizeHex(raw);
    if (hex) {
      setInvalid(false);
      if (hex !== value) onChange(hex);
    } else {
      setInvalid(true);
    }
  };

  return (
    <div className="field field--color">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="color">
        <input
          id={id}
          className="color__swatch"
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} colour picker`}
        />
        <input
          className={`input color__hex${invalid ? ' is-invalid' : ''}`}
          type="text"
          value={text}
          inputMode="text"
          spellCheck={false}
          aria-label={`${label} hex value`}
          aria-invalid={invalid || undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit(text)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit(text);
          }}
        />
      </div>
      {invalid ? (
        <p className="field__hint field__hint--error" role="alert">
          Use a hex colour like #c8ff3b.
        </p>
      ) : null}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'default' | 'ghost';
};

export function Button({ variant = 'default', className = '', ...props }: ButtonProps) {
  return <button {...props} className={`btn btn--${variant} ${className}`.trim()} />;
}

export function Toggle({
  id,
  label,
  checked,
  onChange,
  note,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange(value: boolean): void;
  note?: string;
}) {
  return (
    <div className="toggle">
      <input id={id} type="checkbox" className="toggle__input" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id} className="toggle__label">
        <span className="toggle__track" aria-hidden="true">
          <span className="toggle__thumb" />
        </span>
        <span>
          {label}
          {note ? <span className="toggle__note"> {note}</span> : null}
        </span>
      </label>
    </div>
  );
}
