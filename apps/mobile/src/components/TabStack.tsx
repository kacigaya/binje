import { Stack } from 'expo-router';
import { Platform, useColorScheme } from 'react-native';
import { colors } from '../theme';
export default function TabStack() {
  useColorScheme();
  return <Stack screenOptions={{ headerLargeTitleEnabled: Platform.OS === 'ios', headerTintColor: colors.accent, contentStyle: { backgroundColor: colors.background } }} />;
}
