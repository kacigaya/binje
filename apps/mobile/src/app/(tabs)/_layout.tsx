import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ConsentBanner } from '../../components/ConsentBanner';
import { useLocale } from '../../providers/LocaleProvider';
import { colors } from '../../theme';
export const unstable_settings = { initialRouteName: '(home)' };
export default function TabsLayout() {
  const { t } = useLocale();
  return <>
    <NativeTabs tintColor={colors.accent}>
      <NativeTabs.Trigger name="(home)"><NativeTabs.Trigger.Icon sf="house.fill" md="home" /><NativeTabs.Trigger.Label>{t('home')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="(browse)"><NativeTabs.Trigger.Icon sf="square.grid.2x2" md="grid_view" /><NativeTabs.Trigger.Label>{t('browse')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="(library)"><NativeTabs.Trigger.Icon sf="bookmark.fill" md="bookmarks" /><NativeTabs.Trigger.Label>{t('library')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)"><NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" /><NativeTabs.Trigger.Label>{t('settings')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="(search)" role="search"><NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" /><NativeTabs.Trigger.Label>{t('search')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    </NativeTabs>
    <ConsentBanner />
  </>;
}
