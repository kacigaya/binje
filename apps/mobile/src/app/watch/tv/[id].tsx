import { useLocalSearchParams } from "expo-router";
import { PlayerScreen } from "../../../features/player/PlayerScreen";

function positiveInt(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export default function TVPlayerRoute() {
  const { id, season, episode } = useLocalSearchParams<{ id: string; season?: string; episode?: string }>();
  return (
    <PlayerScreen
      type="tv"
      id={Number(id)}
      initialSeason={positiveInt(season)}
      initialEpisode={positiveInt(episode)}
    />
  );
}
