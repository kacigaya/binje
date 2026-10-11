// Every known source, the ones the probe listed first. Sources that failed
// here or that the probe left out are flagged and sorted last, not hidden:
// probes can be wrong, and a manual pick tries them anyway. Nothing is
// flagged while the probe runs or when it failed outright.
export function sourceMenu<T extends string>(
  all: readonly T[],
  available: readonly T[] | null | undefined,
  failed: readonly T[],
  current: T | null,
): { id: T; unavailable: boolean }[] {
  const listed = (available ?? []).filter((id) => all.includes(id));
  const ordered = [...listed, ...all.filter((id) => !listed.includes(id))];
  const unavailable = (id: T) =>
    id !== current && (failed.includes(id) || (Array.isArray(available) && !available.includes(id)));
  return [...ordered.filter((id) => !unavailable(id)), ...ordered.filter(unavailable)].map((id) => ({
    id,
    unavailable: unavailable(id),
  }));
}
