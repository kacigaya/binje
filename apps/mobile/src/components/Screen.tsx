import type { ReactNode } from 'react';
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, View, useColorScheme, type RefreshControlProps } from 'react-native';
import { colors, spacing } from '../theme';

export function Screen({ children, scroll = true, title, refreshControl }: {
  children: ReactNode;
  scroll?: boolean;
  title?: string;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  useColorScheme();
  return <>
    {title ? <Stack.Screen options={{ title }} /> : null}
    {scroll ? <ScrollView style={styles.screen} contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}>{children}</ScrollView>
      : <View style={styles.screen}>{children}</View>}
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { flexGrow: 1, paddingBottom: spacing.xl } });
