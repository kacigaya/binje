import { describe, expect, test } from "bun:test";
import { createCastController } from "./cast-controller";
import { openCdpConnection } from "./cdp";
import { createFakeChrome, tick, type FakeChrome, type SentCommand } from "./fake-chrome";

const ORIGINS = ["http://localhost:3000"] as const;
const TAB = "http://localhost:3000/en/watch/1";
const SESSION_ID = "session-1";

type FakeSink = { name: string; session?: string };

type SetupOptions = {
  targets?: unknown[];
  sinksOnEnable?: FakeSink[];
  enableError?: string;
  startError?: string;
  stopError?: string;
  connectError?: string;
  idleTimeoutMs?: number;
};

function setup(options: SetupOptions = {}) {
  const chromes: FakeChrome[] = [];

  function handler(chrome: FakeChrome) {
    return (command: SentCommand) => {
      switch (command.method) {
        case "Target.getTargets":
          return {
            targetInfos: options.targets ?? [
              { targetId: "tab-1", type: "page", url: TAB, title: "b!nje" },
            ],
          };
        case "Target.attachToTarget":
          return { sessionId: SESSION_ID };
        case "Cast.enable":
          if (options.enableError) return new Error(options.enableError);
          if (options.sinksOnEnable) {
            const sinks = options.sinksOnEnable;
            queueMicrotask(() => chrome.emit("Cast.sinksUpdated", { sinks }, SESSION_ID));
          }
          return {};
        case "Cast.startTabMirroring":
          return options.startError ? new Error(options.startError) : {};
        case "Cast.stopCasting":
          return options.stopError ? new Error(options.stopError) : {};
        default:
          return {};
      }
    };
  }

  const controller = createCastController({
    allowedOrigins: ORIGINS,
    connect: async () => {
      if (options.connectError) throw new Error(options.connectError);
      const chrome = createFakeChrome();
      chrome.handle(handler(chrome));
      chromes.push(chrome);
      const pending = openCdpConnection(chrome.socket, 200);
      chrome.open();
      return pending;
    },
    discoveryTimeoutMs: 40,
    confirmTimeoutMs: 40,
    idleTimeoutMs: options.idleTimeoutMs ?? 10_000,
  });

  const chrome = () => chromes[chromes.length - 1];
  return {
    controller,
    chromes,
    chrome,
    emitSinks: (sinks: FakeSink[]) => chrome().emit("Cast.sinksUpdated", { sinks }, SESSION_ID),
    emitIssue: (issueMessage: string) =>
      chrome().emit("Cast.issueUpdated", { issueMessage }, SESSION_ID),
    methods: () => chrome().sent.map((command) => command.method),
  };
}

describe("cast controller discovery", () => {
  test("enables Cast on the app tab and reports the sinks Chrome finds", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }] });

    expect(await kit.controller.listSinks(TAB)).toEqual([
      { name: "Living Room TV", active: false },
    ]);
    expect(kit.methods()).toEqual([
      "Target.getTargets",
      "Target.attachToTarget",
      "Cast.enable",
    ]);
    expect(kit.chrome().sent[1].params).toEqual({ targetId: "tab-1", flatten: true });
    expect(kit.chrome().sent[2].sessionId).toBe(SESSION_ID);
  });

  test("waits for sinks that appear after discovery starts", async () => {
    const kit = setup();
    const pending = kit.controller.listSinks(TAB);
    await tick(5);
    kit.emitSinks([{ name: "Living Room TV" }, { name: "Bedroom TV" }]);

    expect(await pending).toEqual([
      { name: "Living Room TV", active: false },
      { name: "Bedroom TV", active: false },
    ]);
  });

  test("returns an empty list when the network has no receiver", async () => {
    const kit = setup();
    expect(await kit.controller.listSinks(TAB)).toEqual([]);
  });

  test("reuses one CDP connection across calls", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }] });
    await kit.controller.listSinks(TAB);
    await kit.controller.listSinks(TAB);
    expect(kit.chromes).toHaveLength(1);
  });

  test("fails when no app tab is open in Chrome", async () => {
    const kit = setup({ targets: [] });
    expect(kit.controller.listSinks(TAB)).rejects.toThrow("No b!nje tab is open");
    await tick(5);
    expect(kit.chrome().isClosed()).toBe(true);
  });

  test("fails when Chrome is not reachable", () => {
    const kit = setup({ connectError: "Chrome is not listening" });
    expect(kit.controller.listSinks(TAB)).rejects.toThrow("Chrome is not listening");
  });

  test("fails when the Cast domain is missing and leaves no connection behind", async () => {
    const kit = setup({ enableError: "'Cast.enable' wasn't found" });
    expect(kit.controller.listSinks(TAB)).rejects.toThrow("'Cast.enable' wasn't found");
    await tick(5);
    expect(kit.chrome().isClosed()).toBe(true);
  });
});

describe("cast controller mirroring", () => {
  test("starts tab mirroring and confirms it from the sink update", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }] });
    await kit.controller.listSinks(TAB);

    const pending = kit.controller.start("Living Room TV", TAB);
    await tick(0);
    kit.emitSinks([{ name: "Living Room TV", session: "Casting tab" }]);

    expect(await pending).toEqual({ casting: true, sinkName: "Living Room TV" });
    const start = kit.chrome().sent.find((command) => command.method === "Cast.startTabMirroring");
    expect(start).toMatchObject({ params: { sinkName: "Living Room TV" }, sessionId: SESSION_ID });
  });

  test("refuses a sink Chrome is not reporting", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }] });
    expect(kit.controller.start("Attacker TV", TAB)).rejects.toThrow(
      "That Cast device is no longer available.",
    );
    await tick(5);
    expect(kit.methods()).not.toContain("Cast.startTabMirroring");
  });

  test("surfaces the issue Chrome reports when the receiver refuses", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }] });
    await kit.controller.listSinks(TAB);

    const pending = kit.controller.start("Living Room TV", TAB);
    await tick(0);
    kit.emitIssue("Unable to cast to Living Room TV");

    expect(pending).rejects.toThrow("Unable to cast to Living Room TV");
    await pending.catch(() => undefined);
    expect(kit.controller.status()).toEqual({ casting: false, sinkName: null });
  });

  test("maps a rejected start command to a cast failure", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }], startError: "sink busy" });
    expect(kit.controller.start("Living Room TV", TAB)).rejects.toThrow("sink busy");
  });

  test("refuses a second device while this tab is already casting", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }, { name: "Bedroom TV" }] });
    const started = kit.controller.start("Living Room TV", TAB);
    await tick(0);
    kit.emitSinks([{ name: "Living Room TV", session: "Casting tab" }, { name: "Bedroom TV" }]);
    await started;

    expect(kit.controller.start("Bedroom TV", TAB)).rejects.toThrow(
      "This tab is already casting to Living Room TV.",
    );
  });

  test("stops mirroring on request", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }] });
    const started = kit.controller.start("Living Room TV", TAB);
    await tick(0);
    kit.emitSinks([{ name: "Living Room TV", session: "Casting tab" }]);
    await started;

    expect(await kit.controller.stop("Living Room TV")).toEqual({ casting: false, sinkName: null });
    const stop = kit.chrome().sent.find((command) => command.method === "Cast.stopCasting");
    expect(stop).toMatchObject({ params: { sinkName: "Living Room TV" }, sessionId: SESSION_ID });
  });

  test("keeps the session marked as casting when Chrome refuses to stop", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }], stopError: "route gone" });
    const started = kit.controller.start("Living Room TV", TAB);
    await tick(0);
    kit.emitSinks([{ name: "Living Room TV", session: "Casting tab" }]);
    await started;

    const failure = kit.controller.stop("Living Room TV");
    expect(failure).rejects.toThrow("route gone");
    await failure.catch(() => undefined);
    expect(kit.controller.status()).toEqual({ casting: true, sinkName: "Living Room TV" });
  });

  test("treats stopping an already-finished session as a no-op", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }] });
    expect(await kit.controller.stop(null)).toEqual({ casting: false, sinkName: null });
    expect(kit.chromes).toHaveLength(0);
  });

  test("notices a session stopped from the TV", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }] });
    const started = kit.controller.start("Living Room TV", TAB);
    await tick(0);
    kit.emitSinks([{ name: "Living Room TV", session: "Casting tab" }]);
    await started;
    expect(kit.controller.status().casting).toBe(true);

    kit.emitSinks([{ name: "Living Room TV" }]);
    expect(kit.controller.status()).toEqual({ casting: false, sinkName: null });
  });

  test("keeps casting through the sink update that races the start command", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }] });
    const started = kit.controller.start("Living Room TV", TAB);
    await tick(0);
    kit.emitSinks([{ name: "Living Room TV" }]);
    kit.emitSinks([{ name: "Living Room TV", session: "Casting tab" }]);

    expect(await started).toEqual({ casting: true, sinkName: "Living Room TV" });
  });

  test("clears state and reconnects after Chrome restarts", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }] });
    const started = kit.controller.start("Living Room TV", TAB);
    await tick(0);
    kit.emitSinks([{ name: "Living Room TV", session: "Casting tab" }]);
    await started;

    kit.chrome().drop();
    expect(kit.controller.status()).toEqual({ casting: false, sinkName: null });

    expect(await kit.controller.listSinks(TAB)).toEqual([
      { name: "Living Room TV", active: false },
    ]);
    expect(kit.chromes).toHaveLength(2);
  });

  test("drops the mirrored session when the tab goes away", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }] });
    const started = kit.controller.start("Living Room TV", TAB);
    await tick(0);
    kit.emitSinks([{ name: "Living Room TV", session: "Casting tab" }]);
    await started;

    kit.chrome().emit("Target.detachedFromTarget", { sessionId: SESSION_ID });
    await tick(5);
    expect(kit.controller.status()).toEqual({ casting: false, sinkName: null });
    expect(kit.chrome().isClosed()).toBe(true);
  });
});

describe("cast controller lifecycle", () => {
  test("disables discovery and closes the socket when idle", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }], idleTimeoutMs: 10 });
    await kit.controller.listSinks(TAB);

    await tick(40);
    expect(kit.methods()).toContain("Cast.disable");
    expect(kit.chrome().isClosed()).toBe(true);
  });

  test("keeps the socket while mirroring is active", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }], idleTimeoutMs: 10 });
    const started = kit.controller.start("Living Room TV", TAB);
    await tick(0);
    kit.emitSinks([{ name: "Living Room TV", session: "Casting tab" }]);
    await started;

    await tick(40);
    expect(kit.chrome().isClosed()).toBe(false);
    expect(kit.controller.status().casting).toBe(true);
  });

  test("shuts down cleanly", async () => {
    const kit = setup({ sinksOnEnable: [{ name: "Living Room TV" }] });
    await kit.controller.listSinks(TAB);
    await kit.controller.close();

    expect(kit.methods()).toContain("Cast.disable");
    expect(kit.chrome().isClosed()).toBe(true);
  });
});
