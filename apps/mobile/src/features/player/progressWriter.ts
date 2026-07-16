type SaveProgress = (positionSeconds: number, durationSeconds: number) => Promise<unknown>;

export function createProgressWriter(
  save: SaveProgress,
  now: () => number = Date.now,
  intervalMs = 5_000,
) {
  let lastSavedAt: number | null = null;
  let latest: { position: number; duration: number } | null = null;

  const valid = (position: number, duration: number) =>
    Number.isFinite(position) && Number.isFinite(duration) && position >= 0 && duration > 0;

  return {
    async update(position: number, duration: number) {
      if (!valid(position, duration)) return;
      latest = { position, duration };
      const timestamp = now();
      if (lastSavedAt !== null && timestamp - lastSavedAt < intervalMs) return;
      lastSavedAt = timestamp;
      await save(position, duration);
    },
    async flush() {
      if (!latest) return;
      await save(latest.position, latest.duration);
    },
  };
}
