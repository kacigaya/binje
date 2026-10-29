import { playlistQualities } from '../qualities';

const track = (height: number, url: string | null, peakBitrate: number) =>
  ({ url, size: { width: height * 16 / 9, height }, averageBitrate: null, peakBitrate });

test('keeps the best variant per height, highest first', () => {
  expect(playlistQualities([
    track(720, 'https://p/720a', 2e6), track(1080, 'https://p/1080', 5e6), track(720, 'https://p/720b', 3e6), track(480, null, 1e6),
  ])).toEqual([{ height: 1080, url: 'https://p/1080' }, { height: 720, url: 'https://p/720b' }]);
});

test('offers no choice for a single variant', () => {
  expect(playlistQualities([track(1080, 'https://p/1080', 5e6)])).toEqual([]);
});
