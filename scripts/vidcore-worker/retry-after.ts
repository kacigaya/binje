export function retryAt(header: string | null, now: number): number {
  if (header !== null) {
    const end = /^\d+$/.test(header) ? now + Number(header) * 1_000 : Date.parse(header);
    if (Number.isFinite(end) && end > now) return end;
  }
  return now + 30_000;
}
