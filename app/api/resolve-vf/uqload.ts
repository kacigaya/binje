// Reverse the Dean Edwards p.a.c.k.e.r that uqload wraps its jwplayer setup in,
// then pull the signed HLS url out. Pure string work — never eval remote code
// (that would be RCE on a server route).

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

// Generic fallback for non-uqload hosters: unpack any packer, then grab the
// first in-page HLS url. Caller MUST probe it (isPlayable) — this only finds a
// candidate, it can't tell a live stream from a dead/placeholder one.
// ponytail: best-effort scrape. Recovers a title only when a hoster embeds a
// plain, non-IP-locked m3u8 in its HTML; netu (IP-locked/expired) and JS-gated
// hosters (playmogo) yield nothing here and fall through to the UI message.
export function scrapeM3u8(embedHtml: string): string | null {
  const unpacked = unpackPacked(embedHtml) ?? embedHtml;
  const m = unpacked.match(/https?:\/\/[^"'\s\\)]+\.m3u8[^"'\s\\)]*/);
  return m ? m[0] : null;
}
