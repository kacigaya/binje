
export function unpackPacked(source: string): string | null {
  const m = source.match(
    /\}\('([\s\S]+?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/,
  );
  if (!m) return null;
  let payload = m[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  const radix = Number(m[2]);
  let count = Number(m[3]);
  const dict = m[4].split("|");
  while (count--) {
    if (dict[count]) {
      payload = payload.replace(
        new RegExp("\\b" + count.toString(radix) + "\\b", "g"),
        dict[count],
      );
    }
  }
  return payload;
}

export function extractM3u8(embedHtml: string): string | null {
  const unpacked = unpackPacked(embedHtml) ?? embedHtml;
  const m = unpacked.match(/file\s*:\s*"([^"]+\.m3u8[^"]*)"/);
  return m ? m[1] : null;
}

export function scrapeM3u8(embedHtml: string): string | null {
  const unpacked = unpackPacked(embedHtml) ?? embedHtml;
  const m = unpacked.match(/https?:\/\/[^"'\s\\)]+\.m3u8[^"'\s\\)]*/);
  return m ? m[0] : null;
}

export function preferredStreamPaths(meta: Record<string, unknown>): string[] {
  const links = Array.isArray(meta.links) ? meta.links : [];
  const uqload = links.find(
    (link) =>
      typeof link === "object" &&
      link !== null &&
      (link as { host?: { slug?: unknown } }).host?.slug === "uqload",
  ) as { url?: unknown } | undefined;
  const paths = [uqload?.url, ...Array.from({ length: 7 }, (_, i) => meta[`link${i + 1}`])];
  return paths.filter(
    (path, index): path is string =>
      typeof path === "string" && path.length > 0 && paths.indexOf(path) === index,
  );
}
