import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { VideoView, useVideoPlayer } from "expo-video";
import { getMediaDetails, getSeason } from "../../api/media";
import { useLocale } from "../../providers/LocaleProvider";
import { upsertPlayHistory, updatePlayHistoryProgress } from "../../storage/playHistory";
import { colors, spacing } from "../../theme";
import { createProgressWriter } from "./progressWriter";
import { proxiedHlsUrl, resolveStream, type AudioVariant } from "./resolveStream";
import type { MobileMediaType } from "../../types/api";

export function PlayerScreen({ type, id }: { type: MobileMediaType; id: number }) {
  const { locale } = useLocale();
  const [variant, setVariant] = useState<AudioVariant>("vo");
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const details = useQuery({
    queryKey: ["details", type, id, locale],
    queryFn: ({ signal }) => getMediaDetails(type, id, locale, signal),
    enabled: Number.isInteger(id) && id > 0,
  });
  const episodes = useQuery({
    queryKey: ["season", id, season, locale],
    queryFn: ({ signal }) => getSeason(id, season, locale, signal),
    enabled: type === "tv" && Number.isInteger(id) && id > 0,
  });

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = false;
    instance.timeUpdateEventInterval = 1;
    instance.keepScreenOnWhilePlaying = true;
  });

  const progressWriter = useMemo(
    () =>
      createProgressWriter((positionSeconds, durationSeconds) =>
        updatePlayHistoryProgress({ type, id, season, episode, positionSeconds, durationSeconds }),
      ),
    [episode, id, season, type],
  );

  useEffect(() => {
    const subscription = player.addListener("timeUpdate", ({ currentTime }) => {
      void progressWriter.update(currentTime, player.duration);
    });
    return () => {
      subscription.remove();
      void progressWriter.flush();
    };
  }, [player, progressWriter]);

  useEffect(() => {
    const media = details.data;
    if (!media) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setResolving(true);
        setStreamError(null);
      }
    });
    void upsertPlayHistory({
      type,
      id,
      title: media.title,
      poster_path: media.posterUrl,
      backdrop_path: media.backdropUrl,
      date: media.date,
      vote_average: media.rating,
      ...(type === "tv" ? { season, episode } : {}),
    });
    resolveStream(
      {
        type,
        id,
        title: media.stream.originalTitle || media.title,
        year: media.stream.year || media.date.slice(0, 4),
        imdbId: media.stream.imdbId,
        ...(type === "tv" ? { season, episode } : {}),
      },
      variant,
    )
      .then(async ({ url }) => {
        if (cancelled) return;
        await player.replaceAsync({ uri: proxiedHlsUrl(url), contentType: "hls" });
        if (!cancelled) player.play();
      })
      .catch((error: unknown) => {
        if (!cancelled) setStreamError(error instanceof Error ? error.message : "Stream unavailable.");
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
      player.pause();
      void progressWriter.flush();
    };
  }, [details.data, episode, id, player, progressWriter, season, type, variant]);

  if (details.isLoading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }
  if (!details.data || details.isError) {
    return <View style={styles.center}><Text style={styles.error}>Unable to load this title.</Text></View>;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{details.data.title}</Text>
      <View style={styles.videoShell}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls
          contentFit="contain"
          allowsPictureInPicture
          fullscreenOptions={{ enable: true }}
        />
        {resolving ? <View style={styles.overlay}><ActivityIndicator color="#fff" size="large" /></View> : null}
      </View>
      {streamError ? <Text style={styles.error}>{streamError}</Text> : null}
      <View style={styles.row}>
        {(["vo", "vf"] as const).map((item) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: variant === item }}
            key={item}
            onPress={() => setVariant(item)}
            style={[styles.pill, variant === item && styles.pillActive]}
          >
            <Text style={styles.pillText}>{item.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      {type === "tv" ? (
        <>
          <Text style={styles.heading}>Season</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {details.data.seasons.filter((item) => item.seasonNumber > 0).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => { setSeason(item.seasonNumber); setEpisode(1); }}
                style={[styles.pill, season === item.seasonNumber && styles.pillActive]}
              >
                <Text style={styles.pillText}>{item.seasonNumber}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.heading}>Episode</Text>
          {episodes.isLoading ? <ActivityIndicator color={colors.accent} /> : (
            <View style={styles.episodes}>
              {episodes.data?.episodes.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setEpisode(item.episodeNumber)}
                  style={[styles.episode, episode === item.episodeNumber && styles.episodeActive]}
                >
                  <Text style={styles.episodeTitle}>{item.episodeNumber}. {item.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 56, gap: spacing.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  videoShell: { aspectRatio: 16 / 9, backgroundColor: "#000", borderRadius: 12, overflow: "hidden" },
  video: { flex: 1 },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#0008" },
  error: { color: "#fca5a5", textAlign: "center", padding: spacing.md },
  row: { flexDirection: "row", gap: 10 },
  pill: { minWidth: 48, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.text, fontWeight: "800" },
  heading: { color: colors.text, fontSize: 19, fontWeight: "800", marginTop: 8 },
  episodes: { gap: 8 },
  episode: { backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  episodeActive: { borderColor: colors.accent },
  episodeTitle: { color: colors.text, fontWeight: "700" },
});
