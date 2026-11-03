import { Platform } from 'react-native';

/**
 * Arrows seek only while controls are hidden; when visible, they move D-pad focus between buttons.
 * Android sends key-up by default and key-down only while a key is held, so act on key-up for one action per press.
 */
export function tvPlaybackAction(eventType: string, eventKeyAction?: number, controlsVisible = false) {
  if (!Platform.isTV || eventKeyAction === 0) return null;
  switch (eventType) {
    case 'left': return controlsVisible ? null : 'rewind';
    case 'right': return controlsVisible ? null : 'forward';
    case 'rewind': return 'rewind';
    case 'fastForward': return 'forward';
    case 'playPause': return 'toggle';
    case 'play': return 'play';
    case 'pause': return 'pause';
    // Native Pressable handles select. Handling it here would toggle twice.
    default: return null;
  }
}

export function seekPosition(time: number, duration: number, step: number) {
  const target = Math.max(0, time + step);
  return duration > 0 ? Math.min(target, duration) : target;
}
