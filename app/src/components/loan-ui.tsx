import { useState, type PropsWithChildren, type ComponentProps, type Ref } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { loanStatusLabel } from '@/i18n/loan-labels';

export const palettes = {
  light: {
    background: '#F5F7F4',
    surface: '#FFFFFF',
    text: '#172E29',
    muted: '#586A65',
    border: '#DDE5DF',
    primary: '#0F6553',
    onPrimary: '#FFFFFF',
    soft: '#E8F2EA',
    hero: '#173E35',
    heroText: '#F5FAF5',
    heroMuted: '#C4DBCC',
    accent: '#DDF2BF',
    danger: '#A52D30',
    dangerSoft: '#FCEDED',
    warning: '#79521E',
    warningSoft: '#FAF1DD',
  },
  dark: {
    background: '#101C19',
    surface: '#192A24',
    text: '#ECF4EE',
    muted: '#B0C2B9',
    border: '#3A5045',
    primary: '#A9DCB7',
    onPrimary: '#123326',
    soft: '#203A2F',
    hero: '#204737',
    heroText: '#F5FAF5',
    heroMuted: '#C4DBCC',
    accent: '#DDF2BF',
    danger: '#FFB4AF',
    dangerSoft: '#412725',
    warning: '#F1CE8F',
    warningSoft: '#392F1F',
  },
} as const;
export type Palette = { [K in keyof typeof palettes.light]: string };
export function usePalette(): Palette {
  return palettes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

// RN Web handles Enter for Pressable, but Space only for button roles.
// Supply Space activation for radio/switch roles without changing native input.
export function selectionKeyProps(select: () => void, disabled = false) {
  return Platform.OS === 'web'
    ? {
        onKeyDown: (event: { key: string; repeat: boolean; preventDefault: () => void }) => {
          if (event.key === ' ' && !disabled) {
            event.preventDefault();
            if (!event.repeat) select();
          }
        },
      }
    : {};
}

export type IconName =
  | 'wallet'
  | 'settings'
  | 'plus'
  | 'back'
  | 'forward'
  | 'check'
  | 'clock'
  | 'lock'
  | 'arrow-up'
  | 'arrow-down'
  | 'document';
// Small native primitives, no downloaded icon font, bitmap, SVG runtime or animation.
export function Icon({ name, color, size = 24 }: { name: IconName; color: string; size?: number }) {
  const line = (x: number, y: number, width: number, angle = 0) => (
    <View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height: 2,
        borderRadius: 1,
        backgroundColor: color,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
  return (
    <View
      accessible={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ width: 24, height: 24, transform: [{ scale: size / 24 }] }}>
        {name === 'wallet' && (
          <>
            <View
              style={{
                position: 'absolute',
                left: 3,
                top: 5,
                width: 18,
                height: 15,
                borderWidth: 2,
                borderColor: color,
                borderRadius: 4,
              }}
            />
            <View
              style={{
                position: 'absolute',
                right: 1,
                top: 10,
                width: 8,
                height: 6,
                borderWidth: 2,
                borderColor: color,
                borderRadius: 2,
              }}
            />
            {line(5, 3, 12)}
          </>
        )}
        {name === 'settings' && (
          <>
            {[6, 12, 18].map((y, i) => (
              <View key={y}>
                {line(3, y, 18)}
                <View
                  style={{
                    position: 'absolute',
                    left: i === 1 ? 14 : 6,
                    top: y - 2,
                    width: 5,
                    height: 6,
                    borderRadius: 2,
                    backgroundColor: color,
                  }}
                />
              </View>
            ))}
          </>
        )}
        {name === 'plus' && (
          <>
            {line(4, 11, 16)}
            {line(4, 11, 16, 90)}
          </>
        )}
        {(name === 'back' || name === 'forward') && (
          <View
            style={{
              width: 24,
              height: 24,
              transform: [{ rotate: name === 'back' ? '180deg' : '0deg' }],
            }}
          >
            {line(4, 11, 15)}
            {line(12, 8, 9, 45)}
            {line(12, 14, 9, -45)}
          </View>
        )}
        {(name === 'arrow-up' || name === 'arrow-down') && (
          <View
            style={{
              width: 24,
              height: 24,
              transform: [{ rotate: name === 'arrow-up' ? '-45deg' : '135deg' }],
            }}
          >
            {line(4, 11, 15)}
            {line(12, 8, 9, 45)}
            {line(12, 14, 9, -45)}
          </View>
        )}
        {name === 'check' && (
          <>
            {line(3, 13, 8, 45)}
            {line(8, 11, 14, -45)}
          </>
        )}
        {name === 'clock' && (
          <>
            <View
              style={{
                position: 'absolute',
                left: 3,
                top: 3,
                width: 18,
                height: 18,
                borderWidth: 2,
                borderColor: color,
                borderRadius: 10,
              }}
            />
            {line(9, 9, 6, 90)}
            {line(11, 13, 6, 25)}
          </>
        )}
        {name === 'lock' && (
          <>
            <View
              style={{
                position: 'absolute',
                left: 7,
                top: 2,
                width: 10,
                height: 12,
                borderWidth: 2,
                borderColor: color,
                borderRadius: 6,
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: 4,
                top: 10,
                width: 16,
                height: 12,
                borderWidth: 2,
                borderColor: color,
                borderRadius: 3,
              }}
            />
            {line(10, 15, 4, 90)}
          </>
        )}
        {name === 'document' && (
          <>
            <View
              style={{
                position: 'absolute',
                left: 5,
                top: 2,
                width: 14,
                height: 20,
                borderWidth: 2,
                borderColor: color,
                borderRadius: 3,
              }}
            />
            {line(8, 8, 8)}
            {line(8, 12, 8)}
            {line(8, 16, 5)}
          </>
        )}
      </View>
    </View>
  );
}

export function Brand() {
  const p = usePalette();
  return (
    <View style={base.row}>
      <View accessible={false} style={[base.brand, { backgroundColor: p.primary }]}>
        <Icon name="wallet" size={22} color={p.onPrimary} />
      </View>
      <Text style={[base.brandText, { color: p.text }]}>
        loan<Text style={{ color: p.primary }}>.</Text>
      </Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'quiet' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  const foreground = kind === 'primary' ? p.onPrimary : kind === 'danger' ? p.danger : p.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      disabled={disabled || loading}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={({ pressed }) => [
        base.button,
        {
          backgroundColor:
            kind === 'primary'
              ? p.primary
              : kind === 'danger'
                ? p.dangerSoft
                : kind === 'secondary'
                  ? p.soft
                  : 'transparent',
          borderColor: focused ? p.primary : 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : icon ? (
        <Icon name={icon} color={foreground} size={20} />
      ) : null}
      <Text style={[base.buttonText, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
}) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={({ pressed }) => [
        base.iconButton,
        {
          backgroundColor: p.surface,
          borderColor: focused ? p.primary : p.border,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Icon name={name} color={p.text} />
    </Pressable>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const p = usePalette();
  return (
    <View style={[base.card, { backgroundColor: p.surface, borderColor: p.border }, style]}>
      {children}
    </View>
  );
}
export function Label({
  children,
  muted = false,
  style,
}: PropsWithChildren<{ muted?: boolean; style?: ComponentProps<typeof Text>['style'] }>) {
  const p = usePalette();
  return <Text style={[base.body, { color: muted ? p.muted : p.text }, style]}>{children}</Text>;
}
export function Section({ children }: PropsWithChildren) {
  const p = usePalette();
  return (
    <Text accessibilityRole="header" style={[base.section, { color: p.text }]}>
      {children}
    </Text>
  );
}
export function Field({
  label,
  hint,
  inputRef,
  ...props
}: ComponentProps<typeof TextInput> & { label: string; hint?: string; inputRef?: Ref<TextInput> }) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8, minWidth: 0 }}>
      <Text style={[base.fieldLabel, { color: p.text }]}>{label}</Text>
      <TextInput
        {...props}
        ref={inputRef}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={p.muted}
        selectionColor={p.primary}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        style={[
          base.input,
          {
            color: p.text,
            backgroundColor: p.surface,
            borderColor: focused ? p.primary : p.border,
          },
          props.style,
        ]}
      />
      {hint ? <Text style={[base.caption, { color: p.muted }]}>{hint}</Text> : null}
    </View>
  );
}
export function Notice({
  children,
  tone = 'neutral',
}: PropsWithChildren<{ tone?: 'neutral' | 'warning' | 'danger' }>) {
  const p = usePalette();
  const color = tone === 'danger' ? p.danger : tone === 'warning' ? p.warning : p.primary;
  return (
    <View
      style={[
        base.notice,
        {
          backgroundColor:
            tone === 'danger' ? p.dangerSoft : tone === 'warning' ? p.warningSoft : p.soft,
        },
      ]}
    >
      <Icon name={tone === 'neutral' ? 'check' : 'clock'} color={color} size={20} />
      <Text style={[base.caption, { color, flex: 1 }]}>{children}</Text>
    </View>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const p = usePalette();
  const { t } = useTranslation();
  const waiting = status === 'PENDING' || status === 'DRAFT';
  const bad = status === 'DISPUTED' || status === 'DECLINED';
  return (
    <View
      style={[
        base.badge,
        { backgroundColor: bad ? p.dangerSoft : waiting ? p.warningSoft : p.soft },
      ]}
    >
      <Text
        style={[
          base.caption,
          { fontWeight: '700', color: bad ? p.danger : waiting ? p.warning : p.primary },
        ]}
      >
        {loanStatusLabel(status, t)}
      </Text>
    </View>
  );
}
export function PageHeader({
  title,
  subtitle,
  back = true,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
}) {
  const p = usePalette();
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={{ gap: 24 }}>
      {back ? (
        <View style={base.row}>
          <IconButton
            name="back"
            label={t('ui.back')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
          <Text style={[base.caption, { color: p.muted }]}>{t('appName')}</Text>
        </View>
      ) : (
        <Brand />
      )}
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={[base.title, { color: p.text }]}>
          {title}
        </Text>
        {subtitle ? <Label muted>{subtitle}</Label> : null}
      </View>
    </View>
  );
}
export function Screen({ children, footer }: PropsWithChildren<{ footer?: React.ReactNode }>) {
  const p = usePalette();
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: p.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={base.page}
        >
          {children}
        </ScrollView>
        {footer ? (
          <View style={[base.footer, { backgroundColor: p.background, borderColor: p.border }]}>
            <View style={base.footerContent}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export const base = StyleSheet.create({
  page: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    padding: 24,
    paddingBottom: 32,
    gap: 24,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brand: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontSize: 24, fontWeight: '700', letterSpacing: -1 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.5 },
  amount: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  },
  body: { fontSize: 16, lineHeight: 24 },
  caption: { fontSize: 14, lineHeight: 20 },
  fieldLabel: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  section: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 24, padding: 24, gap: 16 },
  button: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  buttonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  input: {
    minHeight: 56,
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 24,
  },
  notice: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    alignItems: 'flex-start',
    gap: 12,
  },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  footer: { borderTopWidth: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
  footerContent: { width: '100%', maxWidth: 592, alignSelf: 'center', gap: 8 },
});
