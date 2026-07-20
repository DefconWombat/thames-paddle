/**
 * GPX file parser — extracts track points from GPX files
 * Supports GPX 1.0 and 1.1 formats (Strava, Garmin, Apple Fitness, etc.)
 */

export function parseGpx(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid GPX file: ' + parserError.textContent);
  }

  const points = [];

  // Try track points first (most common)
  const trkpts = doc.querySelectorAll('trkpt');
  if (trkpts.length > 0) {
    trkpts.forEach(pt => {
      points.push(extractPoint(pt));
    });
  } else {
    // Fall back to route points
    const rtepts = doc.querySelectorAll('rtept');
    rtepts.forEach(pt => {
      points.push(extractPoint(pt));
    });
  }

  // Extract metadata
  const nameEl = doc.querySelector('trk > name') || doc.querySelector('metadata > name');
  const name = nameEl?.textContent || 'Imported Track';

  const timeEl = doc.querySelector('metadata > time');
  const date = timeEl?.textContent || null;

  return {
    name,
    date,
    points: points.filter(p => p.lat != null && p.lng != null),
    totalPoints: points.length
  };
}

function extractPoint(el) {
  const lat = parseFloat(el.getAttribute('lat'));
  const lng = parseFloat(el.getAttribute('lon'));

  const eleEl = el.querySelector('ele');
  const elevation = eleEl ? parseFloat(eleEl.textContent) : null;

  const timeEl = el.querySelector('time');
  const timestamp = timeEl ? new Date(timeEl.textContent).getTime() : null;

  // Heart rate from Garmin extensions
  const hrEl = el.querySelector('hr') ||
    el.querySelector('extensions > *|TrackPointExtension > *|hr');
  const heartRate = hrEl ? parseInt(hrEl.textContent) : null;

  return { lat, lng, timestamp, elevation, heartRate };
}

/**
 * Generate a GPX file from a track (for export)
 */
export function generateGpx(name, points) {
  const trackPoints = points.map(p => {
    let pt = `      <trkpt lat="${p.lat}" lon="${p.lng}">`;
    if (p.elevation != null) pt += `\n        <ele>${p.elevation}</ele>`;
    if (p.timestamp != null) pt += `\n        <time>${new Date(p.timestamp).toISOString()}</time>`;
    pt += `\n      </trkpt>`;
    return pt;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Thames Kayak Planner"
  xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
