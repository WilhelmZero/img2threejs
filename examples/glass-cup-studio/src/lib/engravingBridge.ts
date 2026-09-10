import { getOuterRadiusAt } from "./cup";
import type { CupDefinition } from "../types";

export const BRIDGE = "engraving-preview-v1";
export const MAX_PIXELS = 40_000_000;
export type EngravingPayload = {
  blob: Blob;
  name: string;
  width: number;
  height: number;
  widthMm: number;
  heightMm: number;
  dpi: number;
  mode: "dither" | "grayscale";
};
export function validPayload(p: EngravingPayload) {
  return (
    p &&
    p.blob instanceof Blob &&
    p.blob.type === "image/png" &&
    p.blob.size > 0 &&
    p.blob.size <= 40 * 1024 * 1024 &&
    typeof p.name === "string" &&
    p.name.length <= 200 &&
    ["dither", "grayscale"].includes(p.mode) &&
    Number.isInteger(p.width) &&
    Number.isInteger(p.height) &&
    p.width > 0 &&
    p.height > 0 &&
    p.width * p.height <= MAX_PIXELS &&
    [p.widthMm, p.heightMm, p.dpi].every((n) => Number.isFinite(n) && n > 0) &&
    p.dpi >= 72 &&
    p.dpi <= 1200 &&
    Math.abs(p.widthMm - (p.width / p.dpi) * 25.4) < 0.1 &&
    Math.abs(p.heightMm - (p.height / p.dpi) * 25.4) < 0.1
  );
}
export function frostedPixels(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const alpha = Math.round(
      ((data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) *
        data[i + 3]) /
        255,
    );
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = alpha;
  }
  return data;
}
export function fitEngraving(
  cup: CupDefinition,
  widthMm: number,
  heightMm: number,
) {
  const bottom = cup.printAreaMm?.bottom ?? 0,
    top = cup.printAreaMm?.top ?? cup.heightMm;
  const height = top - bottom,
    circumference = Math.PI * 2 * getOuterRadiusAt(cup, bottom + height / 2);
  const factor = Math.min(
    1,
    (circumference * 0.9) / widthMm,
    (height * 0.9) / heightMm,
  );
  return { scale: (widthMm * factor) / circumference, shrunk: factor < 1 };
}
export function externalSession() {
  const q = new URLSearchParams(location.search);
  return q.get("engravingPreview") === "1"
    ? q.get("session") || "invalid"
    : null;
}
export function startReceiver(
  session: string,
  apply: (data: EngravingPayload, ready: () => void) => Promise<void>,
  status: (message: string) => void,
) {
  const opener = window.opener;
  let pending = false,
    complete = false,
    disposed = false,
    senderOrigin = "";
  const allowed = new Set([
    "https://wilhelmzero.github.io",
    ...(import.meta.env.DEV
      ? ["http://127.0.0.1:5179", "http://localhost:5179"]
      : []),
  ]);
  const send = (type: string, message?: string) =>
    opener?.postMessage(
      { bridge: BRIDGE, session, type, message },
      senderOrigin,
    );
  status("等待接收雕刻图片…");
  const timer = setTimeout(
    () => status("接收超时，请回到雕刻预览窗口重新打开3D预览。"),
    45000,
  );
  const receive = async (event: MessageEvent) => {
    if (
      disposed ||
      !opener ||
      event.source !== opener ||
      !allowed.has(event.origin) ||
      event.data?.bridge !== BRIDGE ||
      event.data?.session !== session
    )
      return;
    senderOrigin = event.origin;
    if (event.data.type === "hello") {
      send(complete ? "applied" : "ready");
      return;
    }
    if (event.data.type !== "image" || pending) return;
    if (complete) {
      send("applied");
      return;
    }
    if (!validPayload(event.data.payload)) {
      send("error", "雕刻图片格式或尺寸无效");
      status("雕刻图片格式或尺寸无效");
      return;
    }
    pending = true;
    status("正在导入雕刻贴图…");
    try {
      await apply(event.data.payload, () => {
        if (disposed) return;
        complete = true;
        pending = false;
        clearTimeout(timer);
        status("雕刻贴图已导入 · 独立预览，不覆盖原有草稿");
        send("applied");
      });
    } catch {
      pending = false;
      clearTimeout(timer);
      status("贴图导入失败，请重新打开3D预览。");
      send("error", "贴图导入失败");
    }
  };
  window.addEventListener("message", receive);
  return () => {
    disposed = true;
    clearTimeout(timer);
    window.removeEventListener("message", receive);
  };
}
