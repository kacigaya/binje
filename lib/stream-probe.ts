// Identify video/audio codecs from the first bytes of an MPEG-TS segment.
// The provider's playlists carry no CODECS/VIDEO-RANGE attributes, so this is
// the only way to know what the stream actually contains.

export type StreamTech = {
  video: "H264" | "HEVC" | null;
  audio: string | null;
};

const TS_PACKET_SIZE = 188;

const VIDEO_TYPES: Record<number, StreamTech["video"]> = {
  0x1b: "H264",
  0x24: "HEVC",
};

const AUDIO_TYPES: Record<number, string> = {
  0x03: "MP3",
  0x04: "MP3",
  0x0f: "AAC",
  0x11: "AAC",
  0x81: "Dolby Digital",
  0x87: "Dolby Digital+",
};

const AAC_CHANNELS: Record<number, string> = {
  1: "1.0",
  2: "2.0",
  3: "3.0",
  4: "4.0",
  5: "5.0",
  6: "5.1",
  7: "7.1",
};

function packetPayload(data: Uint8Array, offset: number) {
  const adaptation = (data[offset + 3] >> 4) & 0x3;
  let start = offset + 4;
  if (adaptation & 0x2) start += 1 + data[offset + 4];
  return start < offset + TS_PACKET_SIZE ? start : -1;
}

// PSI sections begin with a pointer_field on payload-start packets.
function sectionStart(data: Uint8Array, payload: number) {
  return payload + 1 + data[payload];
}

export function parseTsCodecs(data: Uint8Array): StreamTech {
  let pmtPid = -1;
  let video: StreamTech["video"] = null;
  let audioType = -1;

  for (
    let offset = 0;
    offset + TS_PACKET_SIZE <= data.length;
    offset += TS_PACKET_SIZE
  ) {
    if (data[offset] !== 0x47) {
      // Lost sync; try to re-sync on the next 0x47 byte.
      const next = data.indexOf(0x47, offset + 1);
      if (next === -1) break;
      offset = next - TS_PACKET_SIZE;
      continue;
    }
    const unitStart = (data[offset + 1] & 0x40) !== 0;
    const pid = ((data[offset + 1] & 0x1f) << 8) | data[offset + 2];
    if (!unitStart) continue;
    const payload = packetPayload(data, offset);
    if (payload === -1) continue;

    if (pid === 0) {
      // PAT: first program's PMT PID.
      const section = sectionStart(data, payload);
      if (data[section] !== 0x00) continue;
      const sectionLength = ((data[section + 1] & 0x0f) << 8) | data[section + 2];
      const programsEnd = section + 3 + sectionLength - 4; // minus CRC
      for (let p = section + 8; p + 4 <= programsEnd; p += 4) {
        const programNumber = (data[p] << 8) | data[p + 1];
        if (programNumber !== 0) {
          pmtPid = ((data[p + 2] & 0x1f) << 8) | data[p + 3];
          break;
        }
      }
    } else if (pid === pmtPid) {
      const section = sectionStart(data, payload);
      if (data[section] !== 0x02) continue;
      const sectionLength = ((data[section + 1] & 0x0f) << 8) | data[section + 2];
      const sectionEnd = section + 3 + sectionLength - 4; // minus CRC
      const programInfoLength =
        ((data[section + 10] & 0x0f) << 8) | data[section + 11];
      let es = section + 12 + programInfoLength;
      while (es + 5 <= sectionEnd) {
        const streamType = data[es];
        if (VIDEO_TYPES[streamType]) video = VIDEO_TYPES[streamType];
        if (AUDIO_TYPES[streamType] && audioType === -1) audioType = streamType;
        const esInfoLength = ((data[es + 3] & 0x0f) << 8) | data[es + 4];
        es += 5 + esInfoLength;
      }
      break; // PMT parsed; done with PSI.
    }
  }

  let audio = audioType !== -1 ? AUDIO_TYPES[audioType] : null;
  if (audio === "AAC") {
    const channels = findAacChannels(data);
    if (channels) audio = `AAC ${channels}`;
  }
  return { video, audio };
}

// Scan for an ADTS header to read the AAC channel configuration.
function findAacChannels(data: Uint8Array) {
  for (let i = 0; i + 4 < data.length; i++) {
    if (data[i] !== 0xff || (data[i + 1] & 0xf6) !== 0xf0) continue;
    const config = ((data[i + 2] & 0x01) << 2) | ((data[i + 3] & 0xc0) >> 6);
    const sampling = (data[i + 2] & 0x3c) >> 2;
    if (sampling > 12 || config === 0) continue; // invalid header, keep scanning
    return AAC_CHANNELS[config] ?? null;
  }
  return null;
}
