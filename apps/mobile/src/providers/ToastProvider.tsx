import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { Button } from '../components/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Toast = { message: string; actionLabel?: string; onAction?: () => void };
type ToastContextValue = { show(toast: Toast): void };

const TOAST_DURATION_MS = 4000;
const ToastContext = createContext<ToastContextValue | null>(null);

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}

export function ToastProvider({ children }: PropsWithChildren) {
  useColorScheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();
  const fadeDuration = reduceMotion ? 0 : 150;

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(opacity, {
      toValue: 0,
      duration: fadeDuration,
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished) setToast(null); });
  }, [fadeDuration, opacity]);

  const show = useCallback(
    (next: Toast) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast(next);
      Animated.timing(opacity, {
        toValue: 1,
        duration: fadeDuration,
        useNativeDriver: true,
      }).start();
      timerRef.current = setTimeout(hide, TOAST_DURATION_MS);
    },
    [fadeDuration, hide, opacity],
  );

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.wrapper, { opacity, top: insets.top + spacing.md }]}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <View style={styles.toast}>
            <Text style={styles.message}>{toast.message}</Text>
            {toast.actionLabel && toast.onAction ? (
              <Button secondary label={toast.actionLabel}
                onPress={() => { const action = toast.onAction; hide(); action?.(); }} />
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used within ToastProvider');
  return value;
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.md },
  toast: {
    alignItems: 'stretch',
    gap: spacing.sm,
    maxWidth: 520,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  message: { flexShrink: 1, color: colors.text, fontFamily: fonts.body, fontSize: 14 },
});
