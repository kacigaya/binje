import { useLocalSearchParams } from "expo-router";
import { PlayerScreen } from "../../../features/player/PlayerScreen";

export default function TVPlayerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlayerScreen type="tv" id={Number(id)} />;
}
