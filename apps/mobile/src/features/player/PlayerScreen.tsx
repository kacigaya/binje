import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { getMediaDetails, getSeason } from "../../api/media";
import { BackButton } from "../../components/BackButton";
import { RtRating, TmdbRating } from "../../components/Badges";
import { useLocale } from "../../providers/LocaleProvider";
import { upsertPlayHistory, updatePlayHistoryProgress } from "../../storage/playHistory";
import { colors, fonts, spacing } from "../../theme";
import { createProgressWriter } from "./progressWriter";
import { proxiedHlsUrl, resolveStream, type AudioVariant } from "./resolveStream";
import type { MobileMediaType, StreamResponse } from "../../types/api";

export function PlayerScreen({
  type,
  id,
  initialSeason,
  initialEpisode,
}: {
  type: MobileMediaType;
  id: number;
  initialSeason?: number;
  initialEpisode?: number;
}) {
  const { locale, t } = useLocale();
  const [variant, setVariant] = useState<AudioVariant>("vo");
  const [season, setSeason] = useState(initialSeason ?? 1);
  const [episode, setEpisode] = useState(initialEpisode ?? 1);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [stream, setStream] = useState<StreamResponse | null>(null);
  const [qualityHeight, setQualityHeight] = useState<number | null>(null);
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
        setStream(null);
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
      .then(async (result) => {
        if (cancelled) return;
        setStream(result);
        setQualityHeight(null);
        await player.replaceAsync({ uri: proxiedHlsUrl(result.url), contentType: "hls" });
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

  const qualityHeights = [...new Set((stream?.sources ?? []).map((source) => source.height))].sort((a, b) => b - a);

  async function changeQuality(height: number | null) {
    if (!stream || height === qualityHeight) return;
    const file = height == null ? stream.url : stream.sources?.find((source) => source.height === height)?.file;
    if (!file) return;
    setQualityHeight(height);
    const position = player.currentTime;
    await player.replaceAsync({ uri: proxiedHlsUrl(file), contentType: "hls" });
    if (position > 0) player.seekBy(position);
    player.play();
  }

  if (details.isLoading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }
  if (!details.data || details.isError) {
    return <View style={styles.center}><Text style={styles.error}>Unable to load this title.</Text></View>;
  }

  return (
    <View style={styles.screen}>
    <BackButton />
    <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={details.data.title}
        onPress={() => router.push(`/${type}/${id}` as never)}
        style={({ pressed }) => [styles.titleLink, pressed && { opacity: 0.7 }]}
      >
        {details.data.logoUrl ? (
          <Image
            source={details.data.logoUrl}
            alt={details.data.title}
            style={styles.titleLogo}
            contentFit="contain"
            contentPosition="left center"
            transition={200}
          />
        ) : (
          <Text style={styles.title}>{details.data.title}</Text>
        )}
      </Pressable>
      {details.data.genres.length ? (
        <View style={styles.genres}>
          {details.data.genres.map((genre) => (
            <View key={genre.id} style={styles.genre}><Text style={styles.genreText}>{genre.name}</Text></View>
          ))}
        </View>
      ) : null}
      <View style={styles.metaRow}>
        <TmdbRating rating={details.data.rating.toFixed(1)} />
        {details.data.rottenTomatoesScore != null ? <RtRating score={details.data.rottenTomatoesScore} /> : null}
        {details.data.contentRating ? <Text style={styles.rated}>{details.data.contentRating}</Text> : null}
        {details.data.runtime ? (
          <Text style={styles.metaText}>
            {Math.floor(details.data.runtime / 60) > 0 ? `${Math.floor(details.data.runtime / 60)}h ` : ""}{details.data.runtime % 60}m
          </Text>
        ) : null}
        {details.data.date ? <Text style={styles.metaText}>{details.data.date.slice(0, 4)}</Text> : null}
      </View>
      {details.data.overview ? (
        <Text numberOfLines={4} style={styles.overview}>{details.data.overview}</Text>
      ) : null}
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
      <View style={[styles.row, styles.wrapRow]}>
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
        {qualityHeights.length > 0 ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t("quality")}: ${t("auto")}`}
              accessibilityState={{ selected: qualityHeight === null }}
              onPress={() => void changeQuality(null)}
              style={[styles.pill, qualityHeight === null && styles.pillActive]}
            >
              <Text style={styles.pillText}>{t("auto")}</Text>
            </Pressable>
            {qualityHeights.map((height) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("quality")}: ${height}p`}
                accessibilityState={{ selected: qualityHeight === height }}
                key={height}
                onPress={() => void changeQuality(height)}
                style={[styles.pill, qualityHeight === height && styles.pillActive]}
              >
                <Text style={styles.pillText}>{height}p</Text>
              </Pressable>
            ))}
          </>
        ) : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  content: { padding: spacing.md, paddingTop: 96, gap: spacing.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 26, fontFamily: fonts.heading, letterSpacing: -0.5 },
  titleLink: { alignSelf: "flex-start" },
  titleLogo: { width: 280, maxWidth: "100%", height: 84 },
  genres: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genre: { borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  genreText: { color: "rgba(240,240,240,0.8)", fontSize: 12, fontFamily: fonts.body },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  metaText: { color: colors.muted, fontSize: 14, fontFamily: fonts.body },
  rated: { color: colors.accent, fontSize: 14, fontFamily: fonts.bodySemiBold },
  overview: { color: "rgba(240,240,240,0.7)", fontSize: 14, lineHeight: 21, fontFamily: fonts.body },
  videoShell: { aspectRatio: 16 / 9, backgroundColor: "#000", borderRadius: 12, overflow: "hidden" },
  video: { flex: 1 },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#0008" },
  error: { color: colors.destructive, textAlign: "center", padding: spacing.md },
  row: { flexDirection: "row", gap: 10 },
  wrapRow: { flexWrap: "wrap" },
  pill: { minWidth: 48, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.text, fontFamily: fonts.bodySemiBold },
  heading: { color: colors.text, fontSize: 19, fontFamily: fonts.heading, marginTop: 8 },
  episodes: { gap: 8 },
  episode: { backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  episodeActive: { borderColor: colors.accent },
  episodeTitle: { color: colors.text, fontFamily: fonts.bodySemiBold },
});
