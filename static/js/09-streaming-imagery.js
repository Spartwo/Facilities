/* streaming-imagery.js — local streaming/ folder URLs + per-body altitude range (Info.txt) lookup. No dependencies. */

/* =========================================================================
   LOCAL STREAMING IMAGERY  — replaces the sheet-based "Bodies" imagery tab.
   Per-body diffuse (SatelliteMap) and heightmap (HeightMap) tiles, plus an
   Info.txt giving the real lowest/highest terrain altitude, are read
   straight from the streaming/ folder shipped alongside this app. Bodies
   without a folder (e.g. Jool, a gas giant) simply 404 and fall back to
   the procedural placeholder texture, same as before.
   ========================================================================= */
const STREAM_BASE = 'streaming';
function streamingUrlsFor(body){
  const base = `${STREAM_BASE}/${body.name}`;
  return {
    diffuse: `${base}/SatelliteMap/Tile0000.png`,
    heightmap: `${base}/HeightMap/Tile0000.png`,
    info: `${base}/Info.txt`
  };
}
let altitudeCache = {};
async function getAltitudeRange(body){
  if(Object.prototype.hasOwnProperty.call(altitudeCache, body.id)) return altitudeCache[body.id];
  try{
    const res = await fetch(streamingUrlsFor(body).info);
    if(!res.ok) throw new Error('no Info.txt');
    const text = await res.text();
    const lowestMatch = text.match(/Lowest Point[\s\S]*?ALT\s*=\s*(-?[\d.]+)/i);
    const highestMatch = text.match(/Highest Point[\s\S]*?ALT\s*=\s*(-?[\d.]+)/i);
    const radiusMatch = text.match(/Radius\s*\(km\)\s*=\s*(-?[\d.]+)/i);
    if(!lowestMatch || !highestMatch) throw new Error('unrecognized Info.txt format');
    const range = {
      lowestAlt: parseFloat(lowestMatch[1]),
      highestAlt: parseFloat(highestMatch[1]),
      // the exact reference radius the heightmap/satellite tiles were generated
      // against, in metres — falls back to our own game-data radius if Info.txt
      // doesn't specify one, so older Info.txt files still work
      radiusM: radiusMatch ? parseFloat(radiusMatch[1])*1000 : body.radiusM
    };
    altitudeCache[body.id] = range;
    return range;
  }catch(e){
    altitudeCache[body.id] = null;
    return null;
  }
}

