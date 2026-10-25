import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { MobileMediaSummary } from '../types/api';
import { colors, fonts, radius, spacing } from '../theme';
export function MediaCard({ item, width = 132 }: { item: MobileMediaSummary; width?: number }) {
  useColorScheme();
  return <Link href={`/${item.mediaType}/${item.id}`} asChild><Pressable accessibilityRole="link" accessibilityLabel={item.title} style={({ pressed }) => [{ width }, pressed && { opacity: 0.7 }]}>
    <View style={[styles.poster, { width, aspectRatio: 2 / 3 }]}>
      {item.posterUrl ? <Image source={item.posterUrl} alt="" style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={{ color: colors.muted }}>b!nje</Text>}
      <View style={styles.rating}><Text style={{ color: colors.onMedia, fontVariant: ['tabular-nums'] }}>{item.rating.toFixed(1)}</Text></View>
    </View>
    <Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>{item.date.slice(0, 4)}</Text>
  </Pressable></Link>;
}
const styles = StyleSheet.create({ poster: { backgroundColor: colors.surface, borderRadius: radius.sm, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }, rating: { position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: 'rgba(0,0,0,0.8)', padding: spacing.xs, borderRadius: radius.sm }, title: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 15, marginTop: spacing.sm }, meta: { color: colors.muted, fontSize: 13, marginTop: spacing.xs } });
