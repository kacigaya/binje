import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TVPressable as Pressable } from '../../components/TVPressable';
import { useLocale } from '../../providers/LocaleProvider';
import { colors, fonts, radius, spacing } from '../../theme';
import type { MobileSeason } from '../../types/api';

const ROW_HEIGHT = 48;

/** One button for any number of seasons. It opens a sheet that lists them, like a native picker. */
export function SeasonMenu({ seasons, season, onChange }: { seasons: MobileSeason[]; season: number; onChange: (season: number) => void }) {
  const { locale, t } = useLocale();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = seasons.find((item) => item.seasonNumber === season);
  const index = Math.max(seasons.findIndex((item) => item.seasonNumber === season), 0);
  const count = (value: number) => `${value} ${(value === 1 ? t('episode') : t('episodes')).toLocaleLowerCase(locale)}`;

  return (
    <View style={s.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('season')}: ${current?.name ?? ''}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.trigger, pressed && s.pressed]}
      >
        <Text style={s.triggerText}>{current?.name}</Text>
        <Feather name="chevron-down" size={16} color={colors.text} />
      </Pressable>
      {current ? <Text style={s.count}>{count(current.episodeCount)}</Text> : null}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityElementsHidden importantForAccessibility="no" onPress={() => setOpen(false)} style={s.overlay} />
        <View accessibilityViewIsModal style={[s.sheet, { paddingBottom: insets.bottom + spacing.sm }]}>
          <Text accessibilityRole="header" style={s.title}>{t('season')}</Text>
          <FlatList
            data={seasons}
            keyExtractor={(item) => String(item.id)}
            initialScrollIndex={index}
            getItemLayout={(_, at) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * at, index: at })}
            renderItem={({ item }) => {
              const selected = item.seasonNumber === season;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => { setOpen(false); onChange(item.seasonNumber); }}
                  style={({ pressed }) => [s.option, selected && s.optionSelected, pressed && s.pressed]}
                >
                  <Text style={s.optionText}>{item.name}</Text>
                  <View style={s.optionEnd}>
                    <Text style={s.count}>{count(item.episodeCount)}</Text>
                    {selected ? <Feather name="check" size={16} color={colors.text} /> : <View style={s.checkSpace} />}
                  </View>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: 'rgba(255,255,255,0.04)' },
  triggerText: { color: colors.text, fontSize: 15, fontFamily: fonts.bodySemiBold },
  pressed: { backgroundColor: colors.fillActive },
  count: { color: colors.muted, fontSize: 13, fontFamily: fonts.body },
  overlay: { flex: 1, backgroundColor: '#000b' },
  sheet: { maxHeight: '60%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: spacing.md, paddingHorizontal: spacing.sm },
  title: { color: colors.text, fontSize: 18, fontFamily: fonts.heading, paddingHorizontal: 12, paddingBottom: spacing.sm },
  option: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderRadius: radius.md },
  optionSelected: { backgroundColor: 'rgba(255,255,255,0.06)' },
  optionText: { color: colors.text, fontSize: 15, fontFamily: fonts.bodyMedium },
  optionEnd: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkSpace: { width: 16 },
});
