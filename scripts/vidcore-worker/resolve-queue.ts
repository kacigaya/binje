type Release = () => void;

export function createResolveQueue() {
  let active = false;
  let next: (() => void) | undefined;

  function release() {
    if (next) next();
    else active = false;
  }

  return async function acquire(signal: AbortSignal): Promise<Release | undefined> {
    if (signal.aborted) return;
    if (!active) {
      active = true;
      return release;
    }
    if (next) return;
    return new Promise((resolve) => {
      const abort = () => {
        next = undefined;
        resolve(undefined);
      };
      next = () => {
        next = undefined;
        signal.removeEventListener("abort", abort);
        resolve(release);
      };
      signal.addEventListener("abort", abort, { once: true });
    });
  };
}
