import type { VideoPlayer } from 'expo-video';

type Player = Pick<VideoPlayer, 'replaceAsync' | 'currentTime' | 'play' | 'pause'>;

/** Native replacements cannot be cancelled. Queue them so an old load cannot replace a new episode. */
export function createPlaybackLoader(player: Player) {
  let generation = 0;
  let tail: Promise<unknown> = Promise.resolve();
  return {
    invalidate() { generation += 1; player.pause(); },
    load(uri: string, position: number, shouldPlay: () => boolean) {
      const expected = generation;
      const operation = tail.catch(() => {}).then(async () => {
        if (expected !== generation) return false;
        await player.replaceAsync({ uri, contentType: 'hls' });
        if (expected !== generation) return false;
        player.currentTime = position;
        if (shouldPlay()) player.play();
        return true;
      });
      tail = operation;
      return operation;
    },
  };
}
