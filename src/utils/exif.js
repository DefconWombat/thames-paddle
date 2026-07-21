/**
 * Lightweight EXIF GPS extraction from JPEG data URLs.
 * Returns { lat, lng } or null.
 */
export function extractExifGps(dataUrl) {
  try {
    const bin = atob(dataUrl.split(',')[1]);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);

    // Check JPEG marker
    if (buf[0] !== 0xFF || buf[1] !== 0xD8) return null;

    let offset = 2;
    while (offset < buf.length - 4) {
      if (buf[offset] !== 0xFF) { offset++; continue; }
      const marker = buf[offset + 1];
      if (marker === 0xE1) { // APP1 — EXIF
        const len = (buf[offset + 2] << 8) | buf[offset + 3];
        const exifData = buf.slice(offset + 4, offset + 2 + len);
        return parseExifForGps(exifData);
      }
      if (marker === 0xDA) break; // Start of scan — stop
      const segLen = (buf[offset + 2] << 8) | buf[offset + 3];
      offset += 2 + segLen;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function parseExifForGps(data) {
  const exifStr = String.fromCharCode(...data.slice(0, 4));
  if (exifStr !== 'Exif') return null;
  const tiffStart = 6;
  const le = data[tiffStart] === 0x49; // little-endian

  function read16(o) {
    return le
      ? (data[tiffStart + o] | (data[tiffStart + o + 1] << 8))
      : ((data[tiffStart + o] << 8) | data[tiffStart + o + 1]);
  }
  function read32(o) {
    return le
      ? (data[tiffStart + o] | (data[tiffStart + o + 1] << 8) | (data[tiffStart + o + 2] << 16) | (data[tiffStart + o + 3] << 24))
      : ((data[tiffStart + o] << 24) | (data[tiffStart + o + 1] << 16) | (data[tiffStart + o + 2] << 8) | data[tiffStart + o + 3]);
  }

  // Find GPS IFD
  const ifdCount = read16(8);
  let gpsOffset = 0;
  for (let i = 0; i < ifdCount; i++) {
    const entryOff = 10 + i * 12;
    const tag = read16(entryOff);
    if (tag === 0x8825) { // GPSInfoIFDPointer
      gpsOffset = read32(entryOff + 8);
      break;
    }
  }
  if (!gpsOffset) return null;

  // Parse GPS IFD
  const gpsCount = read16(gpsOffset);
  let latRef = 'N', lngRef = 'E', latVals = null, lngVals = null;
  for (let i = 0; i < gpsCount; i++) {
    const eo = gpsOffset + 2 + i * 12;
    const tag = read16(eo);
    const valOff = read32(eo + 8);
    if (tag === 1) latRef = String.fromCharCode(data[tiffStart + eo + 8]);
    if (tag === 3) lngRef = String.fromCharCode(data[tiffStart + eo + 8]);
    if (tag === 2) latVals = readRationals(valOff, 3);
    if (tag === 4) lngVals = readRationals(valOff, 3);
  }

  function readRationals(off, count) {
    const vals = [];
    for (let i = 0; i < count; i++) {
      const num = read32(off + i * 8);
      const den = read32(off + i * 8 + 4);
      vals.push(den ? num / den : 0);
    }
    return vals;
  }

  if (!latVals || !lngVals) return null;
  let lat = latVals[0] + latVals[1] / 60 + latVals[2] / 3600;
  let lng = lngVals[0] + lngVals[1] / 60 + lngVals[2] / 3600;
  if (latRef === 'S') lat = -lat;
  if (lngRef === 'W') lng = -lng;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}
