import { expect, it, vi, afterEach } from "vitest";
import {
  frostedPixels,
  fitEngraving,
  validPayload,
  startReceiver,
  BRIDGE,
} from "./engravingBridge";
import { BUILTIN_CUPS } from "./cup";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const payload = () => ({
  blob: new Blob(["png"], { type: "image/png" }),
  name: "a.png",
  width: 300,
  height: 600,
  widthMm: 25.4,
  heightMm: 50.8,
  dpi: 300,
  mode: "dither" as const,
});
it("converts black to transparent and gray to fractional white frost", () => {
  expect([
    ...frostedPixels(
      new Uint8ClampedArray([
        0, 0, 0, 255, 255, 255, 255, 255, 128, 128, 128, 255,
      ]),
    ),
  ]).toEqual([255, 255, 255, 0, 255, 255, 255, 255, 255, 255, 255, 128]);
});
it("validates transfer and scales oversized artwork uniformly", () => {
  expect(validPayload(payload())).toBe(true);
  expect(validPayload({ ...payload(), widthMm: 0 })).toBe(false);
  expect(validPayload({ ...payload(), width: 900000 })).toBe(false);
  expect(fitEngraving(BUILTIN_CUPS["cola-can"], 25.4, 50.8).shrunk).toBe(false);
  expect(fitEngraving(BUILTIN_CUPS["cola-can"], 900, 1800).shrunk).toBe(true);
});
it("accepts only matching source origin and session and acknowledges only after texture ready", async () => {
  vi.useFakeTimers();
  let listener: (e: any) => Promise<void> = async () => {};
  const opener = { postMessage: vi.fn() };
  vi.stubGlobal("window", {
    opener,
    addEventListener: (_n: string, fn: any) => (listener = fn),
    removeEventListener: vi.fn(),
  });
  let ready = () => {};
  const apply = vi.fn(async (_p: any, cb: () => void) => {
    ready = cb;
  });
  const stop = startReceiver("s", apply, vi.fn());
  const event = {
    source: opener,
    origin: "https://wilhelmzero.github.io",
    data: { bridge: BRIDGE, session: "s", type: "image", payload: payload() },
  };
  await listener({ ...event, origin: "https://evil.invalid" });
  await listener({ ...event, source: {} });
  await listener({ ...event, data: { ...event.data, session: "other" } });
  expect(apply).not.toHaveBeenCalled();
  await listener(event);
  await listener(event);
  expect(apply).toHaveBeenCalledTimes(1);
  expect(opener.postMessage).not.toHaveBeenCalled();
  ready();
  expect(opener.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ type: "applied" }),
    event.origin,
  );
  await listener(event);
  expect(apply).toHaveBeenCalledTimes(1);
  stop();
});
