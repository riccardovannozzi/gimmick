'use client';

/**
 * Gimmick · Obsidian — Interactive control primitives.
 *
 * Button, IconButton, Field/Input, Select, Toggle, SegmentedControl.
 * All styling lives in app/obsidian-primitives.css (`.ob-*` classes) and reads
 * the `--ob-*` tokens, so light/dark follows the `data-theme` attribute on an
 * ancestor. These components carry no color logic.
 */
import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

// ─── Button ───────────────────────────────────────────────────────────────────
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon node. */
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('ob-btn', `ob-btn--${variant}`, size !== 'md' && `ob-btn--${size}`, className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

// ─── IconButton ───────────────────────────────────────────────────────────────
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md';
  /** Solid surface variant (visible border on canvas). */
  solid?: boolean;
  /** Active/selected state (accent-soft bg + accent icon). */
  active?: boolean;
  /** Accessible label — required since the button has no text. */
  'aria-label': string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'md', solid, active, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'ob-iconbtn',
        size === 'sm' && 'ob-iconbtn--sm',
        solid && 'ob-iconbtn--solid',
        active && 'ob-iconbtn--active',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

// ─── Field / Input ────────────────────────────────────────────────────────────
export interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Leading addon (icon). */
  leading?: React.ReactNode;
  /** Trailing addon (icon/button). */
  trailing?: React.ReactNode;
  /** Trailing mono hint, e.g. a keyboard shortcut. */
  hint?: React.ReactNode;
  invalid?: boolean;
  /** Class applied to the wrapper (the bordered box). */
  wrapperClassName?: string;
}

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(function Field(
  { leading, trailing, hint, invalid, wrapperClassName, className, ...rest },
  ref,
) {
  return (
    <div className={cn('ob-field', invalid && 'ob-field--invalid', wrapperClassName)}>
      {leading && <span className="ob-field__addon">{leading}</span>}
      <input ref={ref} className={cn('ob-field__input', className)} {...rest} />
      {hint && <span className="ob-field__hint">{hint}</span>}
      {trailing && <span className="ob-field__addon">{trailing}</span>}
    </div>
  );
});

// ─── Select ───────────────────────────────────────────────────────────────────
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

/**
 * Styled wrapper over a native <select> — keeps native a11y/keyboard behaviour
 * while presenting the Obsidian chrome. The native element sits transparent on
 * top; the visible value/chevron are rendered beneath it.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, value, defaultValue, className, ...rest },
  ref,
) {
  const selected = options.find((o) => o.value === (value ?? defaultValue));
  return (
    <div className={cn('ob-select', className)}>
      <span className={cn('ob-select__value', !selected && 'ob-select__value--placeholder')}>
        {selected ? selected.label : placeholder ?? 'Seleziona…'}
      </span>
      <span className="ob-select__chevron" aria-hidden>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <select ref={ref} className="ob-select__native" value={value} defaultValue={defaultValue} {...rest}>
        {placeholder && <option value="" disabled hidden>{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
});

// ─── Dropdown (custom, Obsidian popup) ────────────────────────────────────────
// Come Select ma con la LISTA aperta interamente stilata Obsidian (popup via
// portal) invece del menu nativo del browser. Da usare dove serve coerenza
// visiva del menu a discesa (es. Settings · Personalizzazione).
export interface DropdownOption {
  value: string;
  label: string;
  /** Nodo opzionale a sinistra dell'etichetta (icona/swatch). */
  leading?: React.ReactNode;
  disabled?: boolean;
}

export interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  placeholder?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  'aria-label'?: string;
}

const DROPDOWN_CHEVRON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const DROPDOWN_CHECK = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export function Dropdown({ options, value, placeholder, onValueChange, className, ...aria }: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const selected = options.find((o) => o.value === value);

  React.useEffect(() => {
    if (!open) return;
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    const onDoc = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={cn('ob-select ob-select--button', className)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={aria['aria-label']}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={cn('ob-select__value', !selected && 'ob-select__value--placeholder')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          {selected ? (<>{selected.leading}{selected.label}</>) : (placeholder ?? 'Seleziona…')}
        </span>
        <span className="ob-select__chevron" aria-hidden>{DROPDOWN_CHEVRON}</span>
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="ob-select__menu ob-scroll"
          role="listbox"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                disabled={o.disabled}
                className={cn('ob-select__option', active && 'ob-select__option--active')}
                onClick={() => { if (!o.disabled) { onValueChange?.(o.value); setOpen(false); } }}
              >
                {o.leading}
                <span className="ob-select__option-label">{o.label}</span>
                {active && <span className="ob-select__option-check">{DROPDOWN_CHECK}</span>}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── Toggle (switch) ──────────────────────────────────────────────────────────
export interface ToggleProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

export function Toggle({ checked, onChange, disabled, className, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn('ob-toggle', checked && 'ob-toggle--on', className)}
      {...rest}
    >
      <span className="ob-toggle__thumb" />
    </button>
  );
}

// ─── SegmentedControl ─────────────────────────────────────────────────────────
export interface SegmentedItem<T extends string = string> {
  value: T;
  label: React.ReactNode;
}

export interface SegmentedControlProps<T extends string = string> {
  items: SegmentedItem<T>[];
  value: T;
  onChange?: (value: T) => void;
  className?: string;
  'aria-label'?: string;
}

export function SegmentedControl<T extends string = string>({
  items,
  value,
  onChange,
  className,
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <div className={cn('ob-seg', className)} role="tablist" {...rest}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(it.value)}
            className={cn('ob-seg-item', active && 'ob-seg-item--active')}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
