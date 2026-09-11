import { expect, test } from "bun:test";
import { masterPlaylist, mediaPlaylist, parseMpd } from "./dash-to-hls";

const MPD_URL = new URL("https://cdn.test/dash/title/index.mpd");

function template(timescale: number, timeline: string) {
  return `<SegmentTemplate timescale="${timescale}" initialization="init-stream$RepresentationID$.m4s" media="chunk-stream$RepresentationID$-$Number%05d$.m4s" startNumber="1">
    <SegmentTimeline>${timeline}</SegmentTimeline></SegmentTemplate>`;
}

// Mirrors the manifest MovieBox serves: static, one period, three HEVC video
// representations and one AAC audio representation with timelines.
const MPD = `<?xml version="1.0" encoding="utf-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" profiles="urn:mpeg:dash:profile:isoff-live:2011" type="static" mediaPresentationDuration="PT0M14.0S" maxSegmentDuration="PT5.0S">
  <ProgramInformation><Title>Sample &amp; Title</Title></ProgramInformation>
  <Period id="0" start="PT0.0S">
    <AdaptationSet id="0" contentType="video" segmentAlignment="true" maxWidth="1920" maxHeight="1080">
      <Representation id="0" mimeType="video/mp4" codecs="hev1" bandwidth="1600000" width="1920" height="1080">
        ${template(24000, '<S t="0" d="120000" /><S d="96000" r="1" /><S d="24000" />')}
      </Representation>
      <Representation id="1" mimeType="video/mp4" codecs="hev1" bandwidth="916000" width="1280" height="720">
        ${template(24000, '<S t="0" d="120000" /><S d="96000" r="1" /><S d="24000" />')}
      </Representation>
      <Representation id="2" mimeType="video/mp4" codecs="hev1" bandwidth="500000" width="854" height="480">
        ${template(24000, '<S t="0" d="120000" /><S d="96000" r="1" /><S d="24000" />')}
      </Representation>
    </AdaptationSet>
    <AdaptationSet id="1" contentType="audio" lang="eng">
      <Representation id="3" mimeType="audio/mp4" codecs="mp4a.40.2" bandwidth="128000" audioSamplingRate="48000">
        <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2" />
        ${template(48000, '<S t="0" d="240000" /><S d="192000" r="1" /><S d="48000" />')}
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

test("expands segment timelines into absolute segment lists", () => {
  const manifest = parseMpd(MPD, MPD_URL);
  expect(manifest.video.map((rep) => [rep.id, rep.height, rep.bandwidth])).toEqual([["0", 1080, 1600000], ["1", 720, 916000], ["2", 480, 500000]]);
  expect(manifest.audio.map((rep) => [rep.id, rep.lang, rep.codecs])).toEqual([["3", "eng", "mp4a.40.2"]]);

  const video = manifest.video[0];
  expect(video.init).toBe("https://cdn.test/dash/title/init-stream0.m4s");
  expect(video.segments.map((segment) => segment.duration)).toEqual([5, 4, 4, 1]);
  expect(video.segments.map((segment) => segment.url)).toEqual([
    "https://cdn.test/dash/title/chunk-stream0-00001.m4s",
    "https://cdn.test/dash/title/chunk-stream0-00002.m4s",
    "https://cdn.test/dash/title/chunk-stream0-00003.m4s",
    "https://cdn.test/dash/title/chunk-stream0-00004.m4s",
  ]);
  expect(manifest.audio[0].segments.map((segment) => segment.duration)).toEqual([5, 4, 4, 1]);
});

test("honours BaseURL, fixed durations, $Time$ and inherited templates", () => {
  const xml = `<MPD type="static" mediaPresentationDuration="PT10S"><BaseURL>https://media.test/root/</BaseURL>
    <Period><BaseURL>assets/</BaseURL>
      <AdaptationSet mimeType="video/mp4" codecs="avc1.640028">
        <SegmentTemplate timescale="1000" duration="4000" initialization="$RepresentationID$/init.mp4" media="$RepresentationID$/$Time$-$Bandwidth$.m4s" startNumber="5" />
        <Representation id="v" bandwidth="1000" width="640" height="360" />
      </AdaptationSet>
    </Period></MPD>`;
  const rep = parseMpd(xml, MPD_URL).video[0];
  expect(rep.init).toBe("https://media.test/root/assets/v/init.mp4");
  expect(rep.segments).toEqual([
    { url: "https://media.test/root/assets/v/0-1000.m4s", duration: 4 },
    { url: "https://media.test/root/assets/v/4000-1000.m4s", duration: 4 },
    { url: "https://media.test/root/assets/v/8000-1000.m4s", duration: 4 },
  ]);
});

test("rejects manifests it cannot translate", () => {
  expect(() => parseMpd("#EXTM3U", MPD_URL)).toThrow();
  expect(() => parseMpd("<html><body>blocked</body></html>", MPD_URL)).toThrow();
  expect(() => parseMpd(MPD.replace('type="static"', 'type="dynamic"'), MPD_URL)).toThrow(/live/);
  expect(() => parseMpd(MPD.replace("</Period>", '</Period><Period id="1"></Period>'), MPD_URL)).toThrow(/periods/);
  expect(() => parseMpd(MPD.replace(/<SegmentTemplate[\s\S]*?<\/SegmentTemplate>/, "<SegmentList/>"), MPD_URL)).toThrow(/segment lists/);
  expect(() => parseMpd(MPD.replace('<S d="24000" />', '<S d="24000" r="-1" />'), MPD_URL)).toThrow(/open-ended/);
});

test("writes an HLS master with an audio group and the highest variant first", () => {
  const manifest = parseMpd(MPD, MPD_URL);
  const master = masterPlaylist(manifest, (rep) => `/api/hls?url=mpd&rep=${rep.id}`);
  expect(master.split("\n")).toEqual([
    "#EXTM3U",
    "#EXT-X-VERSION:7",
    "#EXT-X-INDEPENDENT-SEGMENTS",
    '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="eng",LANGUAGE="eng",DEFAULT=YES,AUTOSELECT=YES,URI="/api/hls?url=mpd&rep=3"',
    '#EXT-X-STREAM-INF:BANDWIDTH=1728000,RESOLUTION=1920x1080,AUDIO="audio"',
    "/api/hls?url=mpd&rep=0",
    '#EXT-X-STREAM-INF:BANDWIDTH=1044000,RESOLUTION=1280x720,AUDIO="audio"',
    "/api/hls?url=mpd&rep=1",
    '#EXT-X-STREAM-INF:BANDWIDTH=628000,RESOLUTION=854x480,AUDIO="audio"',
    "/api/hls?url=mpd&rep=2",
    "",
  ]);

  const qualified = parseMpd(MPD.replace(/codecs="hev1"/g, 'codecs="hev1.2.4.L120.90"'), MPD_URL);
  expect(masterPlaylist(qualified, (rep) => rep.id)).toContain('CODECS="hev1.2.4.L120.90,mp4a.40.2"');
});

test("writes a VOD media playlist with the init segment map", () => {
  const rep = parseMpd(MPD, MPD_URL).video[1];
  const playlist = mediaPlaylist(rep, (url) => `/api/hls?url=${encodeURIComponent(url)}`);
  expect(playlist.split("\n")).toEqual([
    "#EXTM3U",
    "#EXT-X-VERSION:7",
    "#EXT-X-TARGETDURATION:5",
    "#EXT-X-PLAYLIST-TYPE:VOD",
    "#EXT-X-INDEPENDENT-SEGMENTS",
    '#EXT-X-MAP:URI="/api/hls?url=https%3A%2F%2Fcdn.test%2Fdash%2Ftitle%2Finit-stream1.m4s"',
    "#EXTINF:5,",
    "/api/hls?url=https%3A%2F%2Fcdn.test%2Fdash%2Ftitle%2Fchunk-stream1-00001.m4s",
    "#EXTINF:4,",
    "/api/hls?url=https%3A%2F%2Fcdn.test%2Fdash%2Ftitle%2Fchunk-stream1-00002.m4s",
    "#EXTINF:4,",
    "/api/hls?url=https%3A%2F%2Fcdn.test%2Fdash%2Ftitle%2Fchunk-stream1-00003.m4s",
    "#EXTINF:1,",
    "/api/hls?url=https%3A%2F%2Fcdn.test%2Fdash%2Ftitle%2Fchunk-stream1-00004.m4s",
    "#EXT-X-ENDLIST",
    "",
  ]);
});
