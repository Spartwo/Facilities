/* sheet-api.js — fetches + parses the Colonies/Orbitals/Entities tabs from the Google Sheet API. Depends on: 01-data.js (BODIES), 02-state.js (sheetConfig/sheetFacilities/sheetOrbitals/entityFlags), 05-flags.js (isSafeImageUrl — called later at runtime, so load order doesn't matter, but keep 05-flags.js loaded before fetchSheetData() is ever called). */

/* =========================================================================
   GOOGLE SHEET FETCH  — via the deployed Apps Script API (kolonypedia-appscript.gs),
   which returns each tab as JSON in the same shape opensheet.elk.sh used to.
   ========================================================================= */
async function fetchAndParseFacilities(){
  if(!sheetConfig.apiBase){ sheetFacilities = {}; return; }
  try{
    const url = `${sheetConfig.apiBase}?tab=${encodeURIComponent(sheetConfig.tab||'Colonies')}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const rows = await res.json();
    if(!Array.isArray(rows)) throw new Error('unexpected response shape: '+shapeErrorReason(rows));

    const grouped = {};
    let matched = 0, unmatched = 0;
    rows.forEach((raw,i)=>{
      const r = {};
      Object.keys(raw).forEach(k=>{ r[k.trim().toLowerCase()] = (raw[k]||'').toString().trim(); });
      const planetRaw = r['planet'] || r['body'] || '';
      const body = BODIES.find(b => b.name.toLowerCase()===planetRaw.toLowerCase() || b.id===planetRaw.toLowerCase());
      const lat = parseFloat(r['lat'] || r['latitude']);
      const lon = parseFloat(r['lon'] || r['long'] || r['longitude']);
      if(!body || isNaN(lat) || isNaN(lon)){ unmatched++; return; }
      const name = r['name'] || r['colony'] || ('Facility '+(i+1));
      const owner = r['owner'] || r['faction'] || r['nation'] || 'Unclaimed';
      (grouped[body.id] = grouped[body.id]||[]).push({
        id:'sheet-'+body.id+'-'+i, name, lat, lon, owner, source:'sheet', kind:'surface'
      });
      matched++;
    });
    sheetFacilities = grouped;
  }catch(e){
    sheetFacilities = {};
    console.warn('Could not load Facilities from the API:', e.message);
  }
}
/* =========================================================================
   GOOGLE SHEET FETCH — orbital facilities (the "Orbitals" tab)
   Same shape as Colonies, but rows carry an orbit (SMA/eccentricity/
   inclination) instead of a lat/lon pin. SMA(m) is measured from sea level
   per-body (i.e. altitude above the surface, in metres), not from the
   planet's centre — the centre-referenced semi-major axis used for
   placement is body.radiusM + smaM.
   ========================================================================= */
async function fetchAndParseOrbitals(){
  if(!sheetConfig.apiBase){ sheetOrbitals = {}; return; }
  try{
    const url = `${sheetConfig.apiBase}?tab=${encodeURIComponent(sheetConfig.orbitalsTab||'Orbitals')}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const rows = await res.json();
    if(!Array.isArray(rows)) throw new Error('unexpected response shape: '+shapeErrorReason(rows));

    const grouped = {};
    rows.forEach((raw,i)=>{
      const r = {};
      Object.keys(raw).forEach(k=>{ r[k.trim().toLowerCase()] = (raw[k]||'').toString().trim(); });
      const planetRaw = r['planet'] || r['body'] || '';
      const body = BODIES.find(b => b.name.toLowerCase()===planetRaw.toLowerCase() || b.id===planetRaw.toLowerCase());
      const smaM = parseFloat(r['sma(m)'] || r['sma (m)'] || r['sma_m'] || r['sma']);
      const eccRaw = parseFloat(r['eccentricity'] || r['ecc']);
      const incRaw = parseFloat(r['inclination'] || r['inc']);
      if(!body || isNaN(smaM) || smaM<0) return;
      const ecc = isNaN(eccRaw) ? 0 : Math.min(0.95, Math.max(0, eccRaw));
      const incDeg = isNaN(incRaw) ? 0 : incRaw;
      const name = r['name'] || r['facility'] || ('Orbital Facility '+(i+1));
      const owner = r['owner'] || r['faction'] || r['nation'] || 'Unclaimed';
      const id = 'orbital-'+body.id+'-'+i;
      // Longitude of ascending node — rotates the whole orbital plane about
      // the body's polar axis so orbits with similar inclination don't all
      // sit in the same plane / point the same direction. Use an explicit
      // column if the sheet provides one; otherwise derive it from the row's
      // position in the table (spread by the golden angle for even coverage).
      const lanRaw = parseFloat(r['lan'] || r['raan'] || r['ascending node'] || r['loan']);
      const lanDeg = isNaN(lanRaw) ? (i*137.50776) % 360 : lanRaw;
      // Deterministic "random" position along the orbit — fixed per facility
      // (based on its id+name) rather than re-rolled on every load, since the
      // facility itself doesn't move.
      const seedNu = (hashStr(id+'|'+name) % 3600) / 3600 * Math.PI * 2;
      (grouped[body.id] = grouped[body.id]||[]).push({
        id, name, smaM, ecc, incDeg, lanDeg, owner, source:'sheet', kind:'orbital', seedNu
      });
    });
    sheetOrbitals = grouped;
  }catch(e){
    sheetOrbitals = {};
    console.warn('Could not load Orbitals from the API:', e.message);
  }
}
const HEX_RE = /^#?[0-9a-fA-F]{6}$/;
function normalizeHex(v){
  v = (v||'').trim();
  if(!HEX_RE.test(v)) return null;
  return v.startsWith('#') ? v : '#'+v;
}
async function fetchAndParseEntities(){
  try{
    const url = `${sheetConfig.apiBase}?tab=${encodeURIComponent(sheetConfig.entityTab||'Entities')}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const rows = await res.json();
    if(!Array.isArray(rows)) throw new Error('unexpected response shape: '+shapeErrorReason(rows));
    const map = {};
    rows.forEach(raw=>{
      const r = {};
      Object.keys(raw).forEach(k=>{ r[k.trim().toLowerCase()] = (raw[k]||'').toString().trim(); });
      const name = r['entity'] || r['name'] || r['owner'] || '';
      if(!name) return;
      const primary = normalizeHex(r['primary'] || r['color'] || r['colour']);
      const secondary = normalizeHex(r['secondary']);
      const pattern = PATTERNS.includes((r['pattern']||'').toLowerCase()) ? r['pattern'].toLowerCase() : null;
      const flagUrlRaw = r['flag'] || r['image'] || r['flagurl'] || r['flag url'] || '';
      const image = isSafeImageUrl(flagUrlRaw) ? flagUrlRaw : null;
      if(!primary && !image) return;
      const entry = {};
      if(primary) entry.primary = primary;
      if(secondary) entry.secondary = secondary;
      if(pattern) entry.pattern = pattern;
      if(image) entry.image = image;
      map[name.trim().toLowerCase()] = entry;
    });
    entityFlags = map;
  }catch(e){
    // entity flags are optional — silently fall back to auto-generated ones
  }
}
async function fetchSheetData(){
  await Promise.all([fetchAndParseFacilities(), fetchAndParseEntities(), fetchAndParseOrbitals()]);
  refreshAll();
}

