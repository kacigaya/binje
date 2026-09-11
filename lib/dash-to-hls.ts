// Translates a static MPEG-DASH manifest into HLS playlists so fMP4 DASH
// sources play through the existing HLS pipeline (hls.js, native Safari,
// expo-video, Cast). Supports the shapes seen in the wild for MovieBox: one
// Period, SegmentTemplate with SegmentTimeline or a fixed duration, and
// BaseURL at any level. Anything else throws and the proxy answers 502.

type Element = { name: string; attrs: Record<string, string>; children: Element[]; text: string };

export type Representation = {
  id: string;
  codecs: string;
  bandwidth: number;
  width?: number;
  height?: number;
  lang?: string;
  init: string;
  segments: { url: string; duration: number }[];
};
export type Manifest = { video: Representation[]; audio: Representation[] };

const TOKEN =
  /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
const ATTR = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function decodeEntities(value: string) {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (_match, name: string) =>
    ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[name] ?? _match,
  );
}

function parseXml(xml: string): Element {
  const root: Element = { name: "", attrs: {}, children: [], text: "" };
  const stack = [root];
  for (const match of xml.matchAll(TOKEN)) {
    const [, closing, opening, rawAttrs, selfClosing, text] = match;
    const current = stack[stack.length - 1];
    if (closing) {
      if (stack.length === 1 || current.name !== closing) throw new Error("Malformed manifest.");
      stack.pop();
    } else if (opening) {
      const attrs: Record<string, string> = {};
      for (const [, name, double, single] of (rawAttrs ?? "").matchAll(ATTR)) attrs[name] = decodeEntities(double ?? single ?? "");
      const element = { name: opening, attrs, children: [], text: "" };
      current.children.push(element);
      if (!selfClosing) stack.push(element);
    } else if (text) {
      current.text += decodeEntities(text);
    }
  }
  if (stack.length !== 1 || root.children.length !== 1) throw new Error("Malformed manifest.");
  return root.children[0];
}

function child(element: Element, name: string) {
  return element.children.find((item) => item.name === name);
}

function children(element: Element, name: string) {
  return element.children.filter((item) => item.name === name);
}

function baseUrl(element: Element, parent: URL) {
  const text = child(element, "BaseURL")?.text.trim();
  return text ? new URL(text, parent) : parent;
}

// ISO 8601 durations as written by packagers: PT2H28M8.0S.
function parseDuration(value: string | undefined): number | undefined {
  const match = value?.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!match) return;
  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function fillTemplate(template: string, values: { id: string; bandwidth: number; number: number; time: number }) {
  return template.replace(/\$(RepresentationID|Bandwidth|Number|Time)?(?:%0(\d+)d)?\$/g, (_match, name: string | undefined, width?: string) => {
    if (!name) return "$";
    const value = name === "RepresentationID" ? values.id : name === "Bandwidth" ? values.bandwidth : name === "Number" ? values.number : values.time;
    return width ? String(value).padStart(Number(width), "0") : String(value);
  });
}

function expandSegments(
  template: Record<string, string>,
  timeline: Element | undefined,
  periodDuration: number | undefined,
  base: URL,
  rep: { id: string; bandwidth: number },
) {
  const media = template.media;
  if (!media) throw new Error("Unsupported manifest: SegmentTemplate without media.");
  const timescale = Number(template.timescale ?? 1);
  const startNumber = Number(template.startNumber ?? 1);
  const entries: { time: number; duration: number }[] = [];

  if (timeline) {
    let time = 0;
    for (const segment of children(timeline, "S")) {
      const duration = Number(segment.attrs.d);
      const repeat = Number(segment.attrs.r ?? 0);
      if (!Number.isFinite(duration) || duration <= 0 || repeat < 0) throw new Error("Unsupported manifest: open-ended timeline.");
      if (segment.attrs.t !== undefined) time = Number(segment.attrs.t);
      for (let index = 0; index <= repeat; index++) {
        entries.push({ time, duration });
        time += duration;
      }
    }
  } else {
    const duration = Number(template.duration);
    if (!Number.isFinite(duration) || duration <= 0 || periodDuration === undefined) {
      throw new Error("Unsupported manifest: no segment timeline.");
    }
    const count = Math.ceil((periodDuration * timescale) / duration);
    for (let index = 0; index < count; index++) entries.push({ time: index * duration, duration });
  }

  return entries.map((entry, index) => ({
    url: new URL(fillTemplate(media, { ...rep, number: startNumber + index, time: entry.time }), base).href,
    duration: entry.duration / timescale,
  }));
}

export function parseMpd(xml: string, mpdUrl: URL): Manifest {
  const mpd = parseXml(xml);
  if (mpd.name !== "MPD") throw new Error("Not a DASH manifest.");
  if (mpd.attrs.type === "dynamic") throw new Error("Unsupported manifest: live.");
  if (/<Segment(List|Base)\b/.test(xml)) throw new Error("Unsupported manifest: segment lists.");
  const periods = children(mpd, "Period");
  if (periods.length !== 1) throw new Error("Unsupported manifest: multiple periods.");
  const period = periods[0];
  const periodDuration = parseDuration(period.attrs.duration) ?? parseDuration(mpd.attrs.mediaPresentationDuration);
  const periodBase = baseUrl(period, baseUrl(mpd, mpdUrl));
  const manifest: Manifest = { video: [], audio: [] };

  for (const set of children(period, "AdaptationSet")) {
    const setBase = baseUrl(set, periodBase);
    const setTemplate = child(set, "SegmentTemplate");
    for (const representation of children(set, "Representation")) {
      const mime = representation.attrs.mimeType ?? set.attrs.mimeType ?? "";
      const kind = set.attrs.contentType ?? mime.split("/")[0];
      if (kind !== "video" && kind !== "audio") continue;
      const repTemplate = child(representation, "SegmentTemplate");
      const template = { ...setTemplate?.attrs, ...repTemplate?.attrs };
      const timeline = (repTemplate && child(repTemplate, "SegmentTimeline")) ?? (setTemplate && child(setTemplate, "SegmentTimeline"));
      const base = baseUrl(representation, setBase);
      const id = representation.attrs.id;
      const bandwidth = Number(representation.attrs.bandwidth);
      if (!id || !Number.isFinite(bandwidth) || !template.initialization) throw new Error("Unsupported manifest: representation.");
      const rep: Representation = {
        id,
        codecs: representation.attrs.codecs ?? set.attrs.codecs ?? "",
        bandwidth,
        width: Number(representation.attrs.width) || undefined,
        height: Number(representation.attrs.height) || undefined,
        lang: set.attrs.lang,
        init: new URL(fillTemplate(template.initialization, { id, bandwidth, number: 0, time: 0 }), base).href,
        segments: expandSegments(template, timeline, periodDuration, base, { id, bandwidth }),
      };
      manifest[kind].push(rep);
    }
  }
  if (manifest.video.length === 0) throw new Error("Unsupported manifest: no video.");
  return manifest;
}

function formatDuration(seconds: number) {
  return seconds.toFixed(3).replace(/\.?0+$/, "");
}

function quoted(value: string) {
  return `"${value.replace(/"/g, "")}"`;
}

// CODECS is only advertised when every codec string is fully qualified; a bare
// "hev1" would make hls.js reject the level before it sniffs the init segment.
function codecsAttribute(reps: Representation[]) {
  const codecs = reps.map((rep) => rep.codecs).filter(Boolean);
  return codecs.length === reps.length && codecs.every((codec) => codec.includes(".")) ? `,CODECS=${quoted(codecs.join(","))}` : "";
}

export function masterPlaylist(manifest: Manifest, variantUrl: (rep: Representation) => string) {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:7", "#EXT-X-INDEPENDENT-SEGMENTS"];
  const audio = manifest.audio[0];
  for (const [index, rep] of manifest.audio.entries()) {
    const name = rep.lang ?? `Audio ${index + 1}`;
    lines.push(
      `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME=${quoted(name)}${rep.lang ? `,LANGUAGE=${quoted(rep.lang)}` : ""}` +
        `,DEFAULT=${index === 0 ? "YES" : "NO"},AUTOSELECT=YES,URI=${quoted(variantUrl(rep))}`,
    );
  }
  for (const rep of [...manifest.video].sort((a, b) => b.bandwidth - a.bandwidth)) {
    const attrs = [`BANDWIDTH=${rep.bandwidth + (audio?.bandwidth ?? 0)}`];
    if (rep.width && rep.height) attrs.push(`RESOLUTION=${rep.width}x${rep.height}`);
    if (audio) attrs.push('AUDIO="audio"');
    lines.push(`#EXT-X-STREAM-INF:${attrs.join(",")}${codecsAttribute(audio ? [rep, audio] : [rep])}`, variantUrl(rep));
  }
  return `${lines.join("\n")}\n`;
}

export function mediaPlaylist(rep: Representation, segmentUrl: (url: string) => string) {
  const target = Math.ceil(Math.max(...rep.segments.map((segment) => segment.duration), 1));
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:7",
    `#EXT-X-TARGETDURATION:${target}`,
    "#EXT-X-PLAYLIST-TYPE:VOD",
    "#EXT-X-INDEPENDENT-SEGMENTS",
    `#EXT-X-MAP:URI=${quoted(segmentUrl(rep.init))}`,
  ];
  for (const segment of rep.segments) lines.push(`#EXTINF:${formatDuration(segment.duration)},`, segmentUrl(segment.url));
  lines.push("#EXT-X-ENDLIST");
  return `${lines.join("\n")}\n`;
}
