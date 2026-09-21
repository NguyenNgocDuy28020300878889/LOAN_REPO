import { useId, useLayoutEffect, useRef, useState, type ComponentProps } from 'react';
import { flushSync } from 'react-dom';
import { StyleSheet } from 'react-native';
import { Field, usePalette } from './loan-ui';

type Props = Omit<ComponentProps<typeof Field>, 'onChange' | 'onChangeText'> & {
  onChangeText: (value: string) => void;
  formatEdit: (
    value: string,
    start: number,
    end?: number,
  ) => { text: string; start: number; end: number };
};

export function FormattedField({
  onChangeText,
  value = '',
  formatEdit,
  label,
  hint,
  style,
  placeholder,
  maxLength,
  editable = true,
  keyboardType,
  autoFocus,
}: Props) {
  const p = usePalette();
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const initialValue = useRef(value);
  const emitted = useRef(value);
  const composing = useRef(false);
  const [focused, setFocused] = useState(false);
  const custom = StyleSheet.flatten(style);
  useLayoutEffect(() => {
    if (value !== emitted.current && ref.current) {
      ref.current.value = formatEdit(value, value.length).text;
      emitted.current = value;
    }
  }, [value, formatEdit]);

  const commit = (input: HTMLInputElement) => {
    const edit = formatEdit(
      input.value,
      input.selectionStart ?? input.value.length,
      input.selectionEnd ?? input.value.length,
    );
    input.value = edit.text;
    input.setSelectionRange(edit.start, edit.end);
    emitted.current = edit.text;
    flushSync(() => onChangeText(edit.text));
  };

  // Use the browser input directly: RN Web's text/selection restoration must
  // not race the formatter or the IME. Preserve the same label, theme and sizing.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <label
        htmlFor={id}
        style={{ color: p.text, fontSize: 14, lineHeight: '20px', fontWeight: 700 }}
      >
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type="text"
        defaultValue={initialValue.current}
        aria-describedby={hint ? `${id}-hint` : undefined}
        inputMode={keyboardType === 'number-pad' ? 'numeric' : 'decimal'}
        placeholder={placeholder}
        maxLength={maxLength}
        readOnly={!editable}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onInput={(event) => {
          const input = event.currentTarget;
          if (composing.current || (event.nativeEvent as InputEvent).isComposing) {
            emitted.current = input.value;
            flushSync(() => onChangeText(input.value));
          } else commit(input);
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          commit(event.currentTarget);
        }}
        onBlur={(event) => {
          composing.current = false;
          commit(event.currentTarget);
          setFocused(false);
        }}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          minWidth: 0,
          minHeight: 56,
          border: `2px solid ${focused ? p.primary : p.border}`,
          borderRadius: 16,
          padding: '12px 16px',
          fontFamily: 'inherit',
          fontSize: custom?.fontSize ?? 16,
          lineHeight: `${custom?.lineHeight ?? 24}px`,
          fontWeight: custom?.fontWeight ?? '400',
          fontVariantNumeric: 'tabular-nums',
          color: p.text,
          backgroundColor: p.surface,
          outline: focused ? `2px solid ${p.primary}` : 'none',
          outlineOffset: 2,
        }}
      />
      {hint ? (
        <div id={`${id}-hint`} style={{ color: p.muted, fontSize: 14, lineHeight: '20px' }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
