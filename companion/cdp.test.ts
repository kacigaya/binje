import { describe, expect, test } from "bun:test";
import { openCdpConnection } from "./cdp";
import { createFakeChrome, tick } from "./fake-chrome";

async function connect(timeoutMs = 200) {
  const chrome = createFakeChrome();
  const pending = openCdpConnection(chrome.socket, timeoutMs);
  chrome.open();
  return { chrome, connection: await pending };
}

describe("openCdpConnection", () => {
  test("correlates responses with their command", async () => {
    const { chrome, connection } = await connect();
    chrome.handle((command) => ({ echo: command.method }));

    const [first, second] = await Promise.all([
      connection.send("Target.getTargets"),
      connection.send("Cast.enable", {}, "session-1"),
    ]);

    expect(first).toEqual({ echo: "Target.getTargets" });
    expect(second).toEqual({ echo: "Cast.enable" });
    expect(chrome.sent[1]).toMatchObject({ method: "Cast.enable", sessionId: "session-1" });
  });

  test("rejects the caller when Chrome returns a protocol error", async () => {
    const { chrome, connection } = await connect();
    chrome.handle(() => new Error("'Cast.enable' wasn't found"));

    expect(connection.send("Cast.enable")).rejects.toThrow("'Cast.enable' wasn't found");
  });

  test("dispatches session events to listeners", async () => {
    const { chrome, connection } = await connect();
    const events: string[] = [];
    connection.onEvent((event) => events.push(`${event.method}:${event.sessionId}`));

    chrome.emit("Cast.sinksUpdated", { sinks: [] }, "session-1");
    expect(events).toEqual(["Cast.sinksUpdated:session-1"]);
  });

  test("settles pending commands when the socket dies", async () => {
    const { chrome, connection } = await connect();
    chrome.handle(() => undefined);
    const closed: true[] = [];
    connection.onClose(() => closed.push(true));

    const pending = connection.send("Cast.enable");
    chrome.drop();

    expect(pending).rejects.toThrow("CDP connection closed.");
    expect(closed).toEqual([true]);
    expect(connection.send("Cast.enable")).rejects.toThrow("CDP connection closed.");
  });

  test("times out a command Chrome never answers", async () => {
    const { chrome, connection } = await connect(20);
    chrome.handle(() => undefined);

    expect(connection.send("Cast.enable")).rejects.toThrow("CDP command timed out: Cast.enable");
    await tick(40);
  });

  test("rejects the connection when the socket fails before opening", async () => {
    const chrome = createFakeChrome();
    const pending = openCdpConnection(chrome.socket, 200);
    chrome.raise("connection refused");

    expect(pending).rejects.toThrow("connection refused");
  });

  test("ignores frames that are not valid protocol messages", async () => {
    const { chrome, connection } = await connect();
    const events: string[] = [];
    connection.onEvent((event) => events.push(event.method));

    chrome.deliverRaw("not json");
    chrome.deliverRaw(JSON.stringify([1, 2, 3]));
    chrome.deliverRaw(JSON.stringify({ id: 999, result: {} }));
    chrome.emit("Cast.issueUpdated", { issueMessage: "" });

    expect(events).toEqual(["Cast.issueUpdated"]);
  });
});
