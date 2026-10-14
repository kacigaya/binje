const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const TS_SYNC_BYTE = 0x47;
const TS_PACKET_BYTES = 188;

function isTransportStreamAt(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] === TS_SYNC_BYTE &&
    (bytes.length <= offset + TS_PACKET_BYTES || bytes[offset + TS_PACKET_BYTES] === TS_SYNC_BYTE)
  );
}

// CDNs may disguise MPEG-TS with an image MIME type or a PNG prefix.
// Return the transport stream, or null for other bodies.
export function unwrapTransportStream(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> | null {
  let offset = 0;
  if (PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let position = PNG_SIGNATURE.length;
    offset = -1;
    // Each chunk is length, type, data, CRC; the video starts after IEND.
    while (position + 12 <= bytes.length) {
      const length = view.getUint32(position);
      const type = String.fromCharCode(...bytes.subarray(position + 4, position + 8));
      position += 12 + length;
      if (type === "IEND") {
        offset = position;
        break;
      }
    }
    if (offset < 0) return null;
  }
  return isTransportStreamAt(bytes, offset) ? bytes.subarray(offset) : null;
}
