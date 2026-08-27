import type { VideoPlayer } from "expo-video";
import type { CastTrack } from "./cast";

export type NativeCastControlsProps = {
  player: VideoPlayer;
  mediaKey: string;
  source: string | null;
  tracks: CastTrack[];
  title: string;
  onCastingChange(casting: boolean): void;
  onDisconnect(positionSeconds: number, resume: boolean): void;
  onRemoteProgress(positionSeconds: number, durationSeconds: number): void;
};
