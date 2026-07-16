import { useLocalSearchParams } from "expo-router";
import { PlayerScreen } from "../../../features/player/PlayerScreen";

export default function MoviePlayerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlayerScreen type="movie" id={Number(id)} />;
}
