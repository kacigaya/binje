import { createPlaybackLoader } from '../playbackLoader';

test('seeks before starting playback', async () => {
  const player = { replaceAsync: jest.fn().mockResolvedValue(undefined), currentTime: 0, play: jest.fn(), pause: jest.fn() };
  const loader = createPlaybackLoader(player);
  player.play.mockImplementation(() => expect(player.currentTime).toBe(120));
  expect(await loader.load('https://example.com/a.m3u8', 120, () => true)).toBe(true);
  expect(player.play).toHaveBeenCalledTimes(1);
});

test('finishes an old native load before replacing it with the new episode', async () => {
  let finish = () => {};
  const player = { replaceAsync: jest.fn().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; })).mockResolvedValue(undefined), currentTime: 0, play: jest.fn(), pause: jest.fn() };
  const loader = createPlaybackLoader(player);
  const old = loader.load('old', 120, () => true);
  await Promise.resolve(); await Promise.resolve();
  loader.invalidate();
  const next = loader.load('next', 30, () => true);
  finish();
  expect(await old).toBe(false);
  expect(await next).toBe(true);
  expect(player.replaceAsync.mock.calls.map(call => call[0].uri)).toEqual(['old', 'next']);
  expect(player.currentTime).toBe(30);
  expect(player.play).toHaveBeenCalledTimes(1);
});

test('recovers after a replacement fails and honors remote playback', async () => {
  const player = { replaceAsync: jest.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValue(undefined), currentTime: 0, play: jest.fn(), pause: jest.fn() };
  const loader = createPlaybackLoader(player);
  await expect(loader.load('bad', 0, () => true)).rejects.toThrow('failed');
  expect(await loader.load('good', 4, () => false)).toBe(true);
  expect(player.play).not.toHaveBeenCalled();
});
