import { createProgressWriter } from "../progressWriter";

describe("playback progress writer", () => {
  test("throttles writes and flushes the final valid position", async () => {
    let now = 1_000;
    const save = jest.fn().mockResolvedValue(true);
    const writer = createProgressWriter(save, () => now, 5_000);

    await writer.update(10, 100);
    now += 1_000;
    await writer.update(11, 100);
    now += 5_000;
    await writer.update(16, 100);
    await writer.flush();

    expect(save.mock.calls).toEqual([[10, 100], [16, 100], [16, 100]]);
  });

  test("ignores invalid positions", async () => {
    const save = jest.fn();
    const writer = createProgressWriter(save);
    await writer.update(-1, 100);
    await writer.update(1, 0);
    await writer.flush();
    expect(save).not.toHaveBeenCalled();
  });
});
