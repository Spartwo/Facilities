if (typeof THREE === 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const vp = document.getElementById('viewport');
    if (vp) vp.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#e6555a;font-family:sans-serif;text-align:center;padding:20px;">Three.js failed to load from CDN.<br>Check your network/CDN access and reload.</div>';
  });
  throw new Error('THREE.js not loaded');
}

/* =========================================================================
   DATA — Kerbol System (Kerbal Space Program), approximate real game values
   ========================================================================= */
const BODIES = [
  { id:'kerbol', name:'Kerbol', type:'Star', parent:null, radiusM:261600000, smaM:0,
    color:'#ffcf6b', secondary:'#ff8a24', style:'star' },

  { id:'moho', name:'Moho', type:'Planet', parent:'kerbol', radiusM:250000, smaM:5263138304,
    color:'#8a6a4d', secondary:'#5e4531', style:'cratered' },

  { id:'eve', name:'Eve', type:'Planet', parent:'kerbol', radiusM:700000, smaM:9832684544,
    color:'#7c3fa3', secondary:'#4c2568', style:'terran' },
  { id:'gilly', name:'Gilly', type:'Moon', parent:'eve', radiusM:13000, smaM:31500000,
    color:'#a7997c', secondary:'#7d7159', style:'cratered', tidalLocked:false },

  { id:'kerbin', name:'Kerbin', type:'Planet', parent:'kerbol', radiusM:600000, smaM:13599840256,
    color:'#2f7dc4', secondary:'#3f9c4c', style:'terran' },
  { id:'mun', name:'Mun', type:'Moon', parent:'kerbin', radiusM:200000, smaM:12000000,
    color:'#9a958c', secondary:'#6f6a62', style:'cratered', tidalLocked:true },
  { id:'minmus', name:'Minmus', type:'Moon', parent:'kerbin', radiusM:60000, smaM:47000000,
    color:'#5fc3ac', secondary:'#3d8f7d', style:'flats', tidalLocked:false },

  { id:'duna', name:'Duna', type:'Planet', parent:'kerbol', radiusM:320000, smaM:20726155264,
    color:'#c1652f', secondary:'#8a441f', style:'terran' },
  { id:'ike', name:'Ike', type:'Moon', parent:'duna', radiusM:130000, smaM:3200000,
    color:'#8f8b85', secondary:'#615d58', style:'cratered', tidalLocked:true },

  { id:'dres', name:'Dres', type:'Dwarf Planet', parent:'kerbol', radiusM:138000, smaM:40839348203,
    color:'#7d7368', secondary:'#54493f', style:'cratered' },

  { id:'jool', name:'Jool', type:'Gas Giant', parent:'kerbol', radiusM:6000000, smaM:68773560320, color:'#4f9d5c', secondary:'#2e6e3d', style:'bands' },
  { id:'laythe', name:'Laythe', type:'Moon', parent:'jool', radiusM:500000, smaM:27184000,
    color:'#3f7ea6', secondary:'#c9a86a', style:'terran', tidalLocked:true },
  { id:'vall', name:'Vall', type:'Moon', parent:'jool', radiusM:300000, smaM:43152000,
    color:'#cfe3e8', secondary:'#9fb8c2', style:'icy', tidalLocked:true },
  { id:'tylo', name:'Tylo', type:'Moon', parent:'jool', radiusM:600000, smaM:68500000,
    color:'#b8b3a8', secondary:'#84806f', style:'cratered', tidalLocked:true },
  { id:'bop', name:'Bop', type:'Moon', parent:'jool', radiusM:65000, smaM:128500000,
    color:'#9c7a52', secondary:'#6a5236', style:'cratered', tidalLocked:false },
  { id:'pol', name:'Pol', type:'Moon', parent:'jool', radiusM:44000, smaM:179890000,
    color:'#cbab6c', secondary:'#94743f', style:'cratered', tidalLocked:false },

  { id:'eeloo', name:'Eeloo', type:'Dwarf Planet', parent:'kerbol', radiusM:210000, smaM:90118820000,
    color:'#dfe6e8', secondary:'#a9b8bc', style:'icy' },
];
const byId = Object.fromEntries(BODIES.map(b=>[b.id,b]));
const PLANETS = BODIES.filter(b=>b.parent==='kerbol');
const moonsOf = pid => BODIES.filter(b=>b.parent===pid);

const PALETTE = ['#e6555a','#ff8a24','#f2c14e','#5fc3ac','#3fd0c9','#4f8ff7','#8a6dd8','#d16fc9','#ffffff','#9aa7ba'];
const PATTERNS = ['solid','stripe-h','stripe-v','diagonal','cross'];

/* =========================================================================
   STATE
   ========================================================================= */
let currentBodyId = 'kerbin';
const DEFAULT_API_BASE = 'https://script.google.com/macros/s/AKfycbzxdItRr5JMawEK-LYLcd4vqLmCsHHmS5-dm4apfRSEGXbtpCTCNLkz9bs00aOEiHBq/exec';
// hardcoded — not exposed or editable in the UI
const sheetConfig = { apiBase: DEFAULT_API_BASE, tab:'Colonies', entityTab:'Entities', orbitalsTab:'Orbitals' };
let sheetFacilities = {};
let entityFlags = {};
let sheetOrbitals = {};

function facilitiesFor(bodyId){
  return sheetFacilities[bodyId] || [];
}
// The Apps Script backend returns a JSON array on success, or a plain
// {error: "..."} object if e.g. the requested tab doesn't exist. Surface
// that message directly instead of a generic "unexpected shape" — it's
// almost always the real, actionable reason (wrong tab name, typo, etc).
function shapeErrorReason(rows){
  if(rows && typeof rows==='object' && !Array.isArray(rows) && rows.error) return rows.error;
  try{ return JSON.stringify(rows).slice(0,200); }catch(e){ return String(rows); }
}
function orbitalsFor(bodyId){
  return sheetOrbitals[bodyId] || [];
}
// Combined surface + orbital facilities for a body — used anywhere facilities
// are counted or listed (tree counts, the facility panel, owner summaries).
// The 3D scene keeps the two apart, since they're placed very differently.
function allFacilitiesFor(bodyId){
  return facilitiesFor(bodyId).concat(orbitalsFor(bodyId));
}

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
      // Deterministic "random" position along the orbit — fixed per facility
      // (based on its id+name) rather than re-rolled on every load, since the
      // facility itself doesn't move.
      const seedNu = (hashStr(id+'|'+name) % 3600) / 3600 * Math.PI * 2;
      (grouped[body.id] = grouped[body.id]||[]).push({
        id, name, smaM, ecc, incDeg, owner, source:'sheet', kind:'orbital', seedNu
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

/* =========================================================================
   TOAST
   ========================================================================= */
let toastTimer=null;
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('show'), 2200);
}

/* =========================================================================
   OWNER-DERIVED FLAGS
   Every facility's flag is deterministically derived from its Owner string,
   so every settlement belonging to the same faction shares one flag —
   anywhere in the system, sourced from the sheet or added locally.
   ========================================================================= */
function hashStr(str){ let h=0; for(let i=0;i<str.length;i++){ h=(h<<5)-h+str.charCodeAt(i); h|=0; } return h>>>0; }
function ownerFlag(owner){
  owner = owner || 'Unclaimed';
  const h = hashStr(owner);
  let primary = PALETTE[h % PALETTE.length];
  let secondary = PALETTE[(h>>>4) % PALETTE.length];
  if(secondary===primary) secondary = PALETTE[(PALETTE.indexOf(primary)+4) % PALETTE.length];
  const pattern = PATTERNS[(h>>>8) % PATTERNS.length];
  const explicit = entityFlags[owner.trim().toLowerCase()];
  if(explicit){
    return {
      primary: explicit.primary || primary,
      secondary: explicit.secondary || secondary,
      pattern: explicit.pattern || pattern,
      image: explicit.image || null
    };
  }
  return { primary, secondary, pattern, image:null };
}
function flagCSS(primary, secondary, pattern){
  switch(pattern){
    case 'solid': return `background:${primary};`;
    case 'stripe-h': return `background: linear-gradient(0deg, ${primary} 34%, ${secondary} 34%, ${secondary} 66%, ${primary} 66%);`;
    case 'stripe-v': return `background: linear-gradient(90deg, ${primary} 34%, ${secondary} 34%, ${secondary} 66%, ${primary} 66%);`;
    case 'diagonal': return `background: linear-gradient(135deg, ${primary} 48%, ${secondary} 52%);`;
    case 'cross': return `background:${primary}; background-image: linear-gradient(${secondary},${secondary}), linear-gradient(${secondary},${secondary}); background-size: 100% 30%, 30% 100%; background-position: center; background-repeat: no-repeat;`;
    default: return `background:${primary};`;
  }
}
function isSafeImageUrl(url){
  return /^https?:\/\//i.test(url||'');
}
function flagStyle(flag){
  if(flag.image){
    const safeUrl = flag.image.replace(/'/g,'%27').replace(/"/g,'%22');
    return `background-image:url('${safeUrl}'); background-size:cover; background-position:center; background-color:${flag.primary};`;
  }
  return flagCSS(flag.primary, flag.secondary, flag.pattern);
}
function parseOwners(ownerStr){
  const parts = (ownerStr||'').split(';').map(s=>s.trim()).filter(Boolean);
  return parts.length ? parts : ['Unclaimed'];
}
function ownerFlagsHTML(ownerStr, flagClass){
  const owners = parseOwners(ownerStr);
  const swatches = owners.map(o=>{
    const f = ownerFlag(o);
    return `<span class="${flagClass}" style="${flagStyle(f)}" title="${escapeHTML(o)}"></span>`;
  }).join('');
  return `<span class="flag-group">${swatches}</span>`;
}

/* =========================================================================
   SIDEBAR: system schematic (SVG)
   ========================================================================= */
function buildSchematic(){
  const svg = document.getElementById('schematic');
  const W=250,H=96, padL=14, padR=10, cy=H/2+6;
  const smas = PLANETS.map(p=>p.smaM);
  const logMin = Math.log10(Math.min(...smas));
  const logMax = Math.log10(Math.max(...smas));
  const xFor = sma => padL + (Math.log10(sma)-logMin)/(logMax-logMin) * (W-padL-padR);

  let svgHTML = `<line x1="${padL-8}" y1="${cy}" x2="${W-padR+2}" y2="${cy}" stroke="#28331f" stroke-width="1"/>`;
  svgHTML += `<circle cx="${padL-8}" cy="${cy}" r="5" fill="none" stroke="#3fe676" stroke-width="1.6"/>`;
  PLANETS.forEach(p=>{
    const x = xFor(p.smaM);
    const r = 3 + Math.log10(p.radiusM/1000)*0.9;
    const isActive = p.id===currentBodyId;
    svgHTML += `<g class="sch-body${isActive?' active':''}" data-body="${p.id}">
      <circle class="dot" cx="${x}" cy="${cy}" r="${Math.max(2.5,r)}" fill="${isActive?p.color:'none'}" stroke="${p.color}" stroke-width="1.6"/>
      <text class="sch-label" x="${x}" y="${cy+16}" text-anchor="middle">${p.name}</text>
    </g>`;
  });
  svg.innerHTML = svgHTML;
  svg.querySelectorAll('.sch-body').forEach(g=>{
    g.addEventListener('click', ()=> selectBody(g.dataset.body));
  });
}

/* =========================================================================
   SIDEBAR: body tree
   ========================================================================= */
function buildTree(){
  const tree = document.getElementById('tree');
  let html = `<div class="tree-star"><span class="sun-dot"></span>KERBOL</div>`;
  PLANETS.forEach(p=>{
    const moons = moonsOf(p.id);
    const n = allFacilitiesFor(p.id).length;
    const isActive = p.id===currentBodyId;
    html += `<div class="tree-body${isActive?' active':''}" data-body="${p.id}">
      <span class="b-dot" style="border-color:${p.color};background:${isActive?p.color:'transparent'}"></span>${p.name}
      ${n?`<span class="b-count">${n}</span>`:''}
    </div>`;
    if(moons.length){
      html += `<div class="tree-moons">`;
      moons.forEach(m=>{
        const mn = allFacilitiesFor(m.id).length;
        const mActive = m.id===currentBodyId;
        html += `<div class="tree-body${mActive?' active':''}" data-body="${m.id}">
          <span class="b-dot" style="border-color:${m.color};background:${mActive?m.color:'transparent'}"></span>${m.name}
          ${mn?`<span class="b-count">${mn}</span>`:''}
        </div>`;
      });
      html += `</div>`;
    }
  });
  tree.innerHTML = html;
  tree.querySelectorAll('.tree-body[data-body]').forEach(el=>{
    el.addEventListener('click', ()=> selectBody(el.dataset.body));
  });
}

/* =========================================================================
   NUMBER FORMATTING
   ========================================================================= */
function fmtDist(m){
  if(m===0) return '—';
  if(m>=1e9) return (m/1e9).toFixed(2)+' Gm';
  if(m>=1e6) return (m/1e6).toFixed(1)+' Mm';
  return (m/1e3).toFixed(0)+' km';
}
function fmtRadius(m){ return (m/1000).toLocaleString()+' km'; }

/* =========================================================================
   THREE.JS SCENE
   ========================================================================= */
const RENDER_R = 2.0;
const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, logarithmicDepthBuffer:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 20000);

const ambientLight = new THREE.AmbientLight(0xf1f7ec, 1.15);
scene.add(ambientLight);

let planetGroup = new THREE.Group();
scene.add(planetGroup);
let contextGroup = new THREE.Group();
scene.add(contextGroup);

let planetMesh=null, graticule=null;
let markerObjs = [];
let orbitPathObjs = [];
// Per-body terrain sample, set once the current body's heightmap image has
// loaded and been decoded to pixel data. Used so facility pins sit on the
// actual displaced terrain instead of a flat sphere. Null while no heightmap
// data is available yet (or for bodies with none), in which case pins fall
// back to the flat RENDER_R radius.
let heightSample = null;
let graticuleLabelObjs = [];
let selectedFacilityId = null;
let contextObjs = [];
let contextLabels = [];
let loadToken = 0;

const CAM_PHI_DEFAULT = 1.25;
const unitSphereGeo = new THREE.SphereGeometry(1, 128, 96);
const contextSphereGeo = new THREE.SphereGeometry(1, 24, 16);

let camTheta = 0, camPhi = CAM_PHI_DEFAULT, camRadius = 9;
const camRadiusMin=3.3, camRadiusMax=16;
function updateCameraPos(){
  camPhi = Math.max(0.18, Math.min(Math.PI-0.18, camPhi));
  camRadius = Math.max(camRadiusMin, Math.min(camRadiusMax, camRadius));
  camera.position.set(
    camRadius*Math.sin(camPhi)*Math.cos(camTheta),
    camRadius*Math.cos(camPhi),
    camRadius*Math.sin(camPhi)*Math.sin(camTheta)
  );
  camera.lookAt(0,0,0);
}
updateCameraPos();

let dragging=false, lastX=0, lastY=0;

canvas.addEventListener('pointerdown', e=>{
  dragging=true; lastX=e.clientX; lastY=e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e=>{
  if(!dragging) return;
  const dx=e.clientX-lastX, dy=e.clientY-lastY;
  camTheta += dx*0.006;
  camPhi   -= dy*0.006;
  lastX=e.clientX; lastY=e.clientY;
  updateCameraPos();
});
window.addEventListener('pointerup', ()=>{ dragging=false; });
canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  camRadius += e.deltaY*0.0022;
  updateCameraPos();
}, {passive:false});
let pinchDist=null;
canvas.addEventListener('touchmove', e=>{
  if(e.touches.length===2){
    const d = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
    if(pinchDist!=null){ camRadius -= (d-pinchDist)*0.01; updateCameraPos(); }
    pinchDist=d;
  }
},{passive:true});
canvas.addEventListener('touchend', ()=>{pinchDist=null;});

function latLonToVec3(lat, lon, r){
  const phi = THREE.MathUtils.degToRad(lat);
  const lam = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    r*Math.cos(phi)*Math.cos(lam),
    r*Math.sin(phi),
    r*Math.cos(phi)*Math.sin(lam)
  );
}

// Decodes a loaded heightmap Image element into raw pixel data we can sample
// directly, independent of how the corresponding THREE.Texture's UVs/repeat/
// offset are set up for rendering on the sphere.
function imageToImageData(img){
  const cvs = document.createElement('canvas');
  cvs.width = img.width; cvs.height = img.height;
  const ctx = cvs.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}
// Same equirectangular convention as the SatelliteMap tiles (0° longitude at
// the centre column, ±180° at the edges), with the standard assumption that
// the top row is the north pole (lat +90) and the bottom row the south pole
// (lat -90). Nearest-neighbour sample of the red channel, since heightmaps
// are greyscale.
function sampleHeight01(imgData, lat, lon){
  const w = imgData.width, h = imgData.height;
  let u = (lon + 180) / 360;
  u = ((u % 1) + 1) % 1;
  let v = (90 - lat) / 180;
  v = Math.min(1, Math.max(0, v));
  let x = Math.min(w - 1, Math.floor(u * w));
  let y = Math.min(h - 1, Math.floor(v * h));
  return imgData.data[(y * w + x) * 4] / 255;
}
// Mirrors the displacement math applied to the terrain mesh itself
// (mat.displacementScale/Bias, object-space radius 1) so a pin's radius
// matches the ground beneath it. Falls back to the flat RENDER_R radius
// when no heightmap has been sampled yet for the current body. A small
// fixed lift keeps the pin base from clipping into terrain, since this is a
// nearest-neighbour sample against the shader's bilinear-interpolated
// displacement.
const PIN_SURFACE_LIFT = RENDER_R * 0.002;
function markerRadiusFor(lat, lon){
  if(!heightSample) return RENDER_R;
  const v = sampleHeight01(heightSample.imgData, lat, lon);
  const objRadius = 1 + heightSample.objBias + v * heightSample.objScale;
  return RENDER_R * objRadius + PIN_SURFACE_LIFT;
}
// Recomputes the world position of every already-placed pin against the
// current heightSample — called once a body's heightmap finishes loading,
// since markers are placed (at the flat fallback radius) before that
// happens.
function refreshMarkerElevations(){
  markerObjs.forEach(m=>{
    if(m.facility.kind==='orbital') return;
    const r = markerRadiusFor(m.facility.lat, m.facility.lon);
    m.mesh.position.copy(m.normal.clone().multiplyScalar(r));
  });
}

// Simple shared placeholder used while a body's real satellite imagery is
// loading (or in place of it entirely for bodies with none, e.g. Jool) — a
// single flat black texture, reused for every body rather than a unique
// procedural texture per body.
let blackTexture = null;
function getBodyTexture(){
  if(blackTexture) return blackTexture;
  const cvs=document.createElement('canvas'); cvs.width=2; cvs.height=2;
  const ctx=cvs.getContext('2d');
  ctx.fillStyle='#000000'; ctx.fillRect(0,0,2,2);
  blackTexture = new THREE.CanvasTexture(cvs);
  blackTexture.needsUpdate = true;
  return blackTexture;
}
function loadImageTexture(url){
  return new Promise((resolve,reject)=>{
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    loader.load(url, tex=>{
      // The streaming SatelliteMap/HeightMap tiles are equirectangular with
      // column 0 at 180°W, the centre column at 0° longitude, and the last
      // column at 180°E. repeat.x=1/offset.x=1 (equivalent to no change,
      // since offset wraps mod 1) is the value confirmed to line imagery up
      // correctly with facility pins and the lat/lon grid.
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.x = 1;
      tex.offset.x = 1;
      tex.needsUpdate = true;
      resolve(tex);
    }, undefined, err=>reject(err));
  });
}

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

function buildGraticule(r){
  const group = new THREE.Group();
  const matNormal = new THREE.LineBasicMaterial({color:0x2f6b42, transparent:true, opacity:0.3});
  const matMajor = new THREE.LineBasicMaterial({color:0x3fe676, transparent:true, opacity:0.6});
  const segs=96;
  for(let lonStep=0; lonStep<180; lonStep+=30){
    const pts2=[];
    for(let i=0;i<=segs;i++){
      const a = (i/segs)*Math.PI*2;
      const lam = THREE.MathUtils.degToRad(lonStep);
      const x = r*Math.cos(a)*Math.cos(lam);
      const y = r*Math.sin(a);
      const z = r*Math.cos(a)*Math.sin(lam);
      pts2.push(new THREE.Vector3(x,y,z));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts2);
    const isMajor = lonStep===0;
    group.add(new THREE.LineLoop(geo, isMajor?matMajor:matNormal));
  }
  for(let lat=-60; lat<=60; lat+=30){
    const pts=[];
    const phi = THREE.MathUtils.degToRad(lat);
    const rr = r*Math.cos(phi), yy = r*Math.sin(phi);
    for(let i=0;i<=segs;i++){
      const a = (i/segs)*Math.PI*2;
      pts.push(new THREE.Vector3(rr*Math.cos(a), yy, rr*Math.sin(a)));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.LineLoop(geo, lat===0?matMajor:matNormal));
  }

  // Coordinate readout: text anchored right on the grid lines themselves,
  // then nudged a few pixels clear of the line in screen space (see
  // updateLabels) so it doesn't sit directly on top of the line it's
  // labelling. Longitude labels sit on the equator (least likely to bunch
  // up near the poles); latitude labels repeat at four longitudes around
  // the sphere so at least one set stays on the visible hemisphere as the
  // body is rotated.
  const layer = document.getElementById('context-label-layer');
  function addGridLabel(lat, lonStep, text){
    const anchor = new THREE.Object3D();
    anchor.position.copy(latLonToVec3(lat, lonStep, r));
    group.add(anchor);
    const el = document.createElement('div');
    el.className = 'grid-label';
    el.textContent = text;
    layer.appendChild(el);
    graticuleLabelObjs.push({anchor, el});
  }
  for(let lonStep=-150; lonStep<=180; lonStep+=30){
    const text = lonStep===0 ? '0\u00B0' : (lonStep===180||lonStep===-180) ? '180\u00B0' : `${Math.abs(lonStep)}\u00B0${lonStep>0?'E':'W'}`;
    addGridLabel(0, lonStep, text);
  }
  for(let lat=-60; lat<=60; lat+=30){
    if(lat===0) continue; // equator already labelled by the longitude labels
    for(let lonStep=0; lonStep<360; lonStep+=90){
      addGridLabel(lat, lonStep, `${Math.abs(lat)}\u00B0${lat>0?'N':'S'}`);
    }
  }

  return group;
}
function clearGraticuleLabels(){
  graticuleLabelObjs.forEach(l=>{ if(l.el.parentNode) l.el.parentNode.removeChild(l.el); });
  graticuleLabelObjs = [];
}

// Vector-line "beacon" marker: a ring on the surface, a mast, and a pulsing
// ring at the top — drawn only in outline, the way a vector-scope display
// (radar, motion tracker) draws everything as lines rather than filled
// shapes. Shared geometries, scaled per-instance.
const beaconRingGeo = (()=>{
  const pts=[]; const n=28;
  for(let i=0;i<=n;i++){ const a=(i/n)*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(a),0,Math.sin(a))); }
  return new THREE.BufferGeometry().setFromPoints(pts);
})();
const beaconMastGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,1,0)]);

function clearMarkers(){
  markerObjs.forEach(m=>{ planetGroup.remove(m.mesh); });
  markerObjs = [];
  document.getElementById('marker-layer').innerHTML='';
}
function escapeHTML(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

/* =========================================================================
   ORBITAL FACILITIES — placement + orbit-path geometry
   SMA(m) from the sheet is measured from sea level (i.e. altitude above the
   surface), so the true, centre-referenced semi-major axis is
   body.radiusM + orbital.smaM. The orbit's focus sits at the body's centre
   (the planetGroup origin), so a point at true anomaly nu is:
     r = a(1-e^2) / (1 + e·cos(nu))
   in the orbital plane, which is then tilted out of the equatorial plane by
   the inclination (rotation about the local X axis, since Y is the body's
   polar axis — same convention as latLonToVec3).
   ========================================================================= */
const ORBIT_BLUE = 0x4f8ff7;
function orbitalPositionAt(body, orbital, nu){
  const a = body.radiusM + orbital.smaM;
  const e = orbital.ecc;
  const r = a*(1-e*e) / (1 + e*Math.cos(nu));
  const xOrb = r*Math.cos(nu), zOrb = r*Math.sin(nu);
  const incRad = THREE.MathUtils.degToRad(orbital.incDeg);
  const y = -zOrb*Math.sin(incRad);
  const z =  zOrb*Math.cos(incRad);
  const scaleFactor = RENDER_R / body.radiusM;
  return new THREE.Vector3(xOrb*scaleFactor, y*scaleFactor, z*scaleFactor);
}
// Position + "up" direction for either kind of facility, in one place, so
// addMarkerObject doesn't need to know which kind it's placing.
function facilityWorldPos(facility, body){
  if(facility.kind==='orbital'){
    const pos = orbitalPositionAt(body, facility, facility.seedNu);
    return { pos, normal: pos.clone().normalize() };
  }
  const normal = latLonToVec3(facility.lat, facility.lon, 1); // unit direction, already normalized
  const pos = normal.clone().multiplyScalar(markerRadiusFor(facility.lat, facility.lon));
  return { pos, normal };
}

function clearOrbitPaths(){
  orbitPathObjs.forEach(o=>{ planetGroup.remove(o.line); o.line.geometry.dispose(); o.mat.dispose(); });
  orbitPathObjs = [];
}
// Draws the orbital path as a thin ellipse loop, same visual language as the
// lat/lon graticule — blue, and at the same opacity as the graticule's minor
// lines (0.3) until its facility is selected, at which point animate()
// brightens it to full opacity.
function buildOrbitPath(body, orbital){
  const segs = 96;
  const pts = [];
  for(let i=0;i<=segs;i++){
    pts.push(orbitalPositionAt(body, orbital, (i/segs)*Math.PI*2));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({color:ORBIT_BLUE, transparent:true, opacity:0.3});
  const line = new THREE.LineLoop(geo, mat);
  planetGroup.add(line);
  orbitPathObjs.push({line, mat, facility:orbital});
}

function addMarkerObject(facility, body){
  const owners = parseOwners(facility.owner);
  const firstFlag = ownerFlag(owners[0]);
  const {pos, normal} = facilityWorldPos(facility, body);
  const isOrbital = facility.kind==='orbital';
  const group = new THREE.Group();
  group.position.copy(pos);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), normal);

  // Fades the same way the orbit path does — dim at rest, full opacity once
  // its facility is selected (see animate()).
  const ownerMat = new THREE.LineBasicMaterial({color:new THREE.Color(firstFlag.primary), transparent:true, opacity:0.3});

  let baseRing = null, mast = null;
  if(!isOrbital){
    // Surface facilities stand on a "mast" with a footprint ring at ground
    // level. Orbital facilities have no ground to stand on, so they skip
    // this entirely — just the ring, sitting right on the orbital line.
    baseRing = new THREE.LineLoop(beaconRingGeo, ownerMat);
    baseRing.scale.set(0.03,1,0.03);
    baseRing.position.y = 0.004;

    mast = new THREE.Line(beaconMastGeo, ownerMat);
    mast.scale.y = 0.09;
    mast.position.y = 0.004;
  }

  const topRingMat = new THREE.LineBasicMaterial({color:0x3fe676, transparent:true, opacity:0.9});
  const topRing = new THREE.LineLoop(beaconRingGeo, topRingMat);
  topRing.scale.set(0.017,1,0.017);
  topRing.position.y = isOrbital ? 0 : 0.096;

  if(isOrbital) group.add(topRing);
  else group.add(baseRing, mast, topRing);
  planetGroup.add(group);

  const label = document.createElement('div');
  label.className='marker-label';
  label.innerHTML = `<span class="m-dot"></span><span class="m-text">${escapeHTML(facility.name)}${ownerFlagsHTML(facility.owner,'m-flag')}</span>`;
  const mText = label.querySelector('.m-text');
  const markerEntry = {mesh:group, label, mText, facility, normal, topRing, topRingMat, ownerMat, hovered:false, phase:Math.random()*Math.PI*2};
  mText.addEventListener('click', (e)=>{ e.stopPropagation(); focusFacilityRow(facility.id); });
  mText.addEventListener('mouseenter', ()=>{ markerEntry.hovered = true; });
  mText.addEventListener('mouseleave', ()=>{ markerEntry.hovered = false; });
  document.getElementById('marker-layer').appendChild(label);

  markerObjs.push(markerEntry);
}

function clearContextBodies(){
  contextObjs.forEach(o=>{ contextGroup.remove(o.mesh); o.mesh.material.dispose(); });
  contextObjs = [];
  contextLabels.forEach(l=>{ if(l.el.parentNode) l.el.parentNode.removeChild(l.el); });
  contextLabels = [];
}
function addContextSphere(body, position, size){
  const tex = getBodyTexture();
  const mat = new THREE.MeshLambertMaterial({map:tex});
  const mesh = new THREE.Mesh(contextSphereGeo, mat);
  mesh.scale.setScalar(size);
  mesh.position.copy(position);
  contextGroup.add(mesh);
  contextObjs.push({mesh, body});

  const streamUrls = streamingUrlsFor(body);
  loadImageTexture(streamUrls.diffuse).then(t=>{
    mat.map = t; mat.needsUpdate = true;
  }).catch(()=>{ /* no local imagery for this body (e.g. Jool) — keep procedural fallback */ });

  const label = document.createElement('div');
  label.className='context-label';
  label.textContent = body.name;
  document.getElementById('context-label-layer').appendChild(label);
  contextLabels.push({el:label, mesh});
}
function rotateAroundY(vec, angleRad){
  const c = Math.cos(angleRad), s = Math.sin(angleRad);
  return new THREE.Vector3(vec.x*c - vec.z*s, 0, vec.x*s + vec.z*c);
}
const SAFE_AZ = 12;
function spreadAzimuths(count, span){
  if(count<=0) return [];
  if(count===1) return [0];
  const arr=[];
  for(let i=0;i<count;i++) arr.push(-span + (2*span*i)/(count-1));
  return arr;
}
const CANON_DIR = new THREE.Vector3(1,0,0);
function familyCanonicalPositions(parent){
  const moons = moonsOf(parent.id);
  const azs = spreadAzimuths(moons.length, SAFE_AZ);
  const canonical = { [parent.id]: new THREE.Vector3(0,0,0) };
  moons.forEach((m,i)=>{
    const dir = rotateAroundY(CANON_DIR, THREE.MathUtils.degToRad(azs[i]));
    canonical[m.id] = dir.multiplyScalar(m.smaM);
  });
  return canonical;
}
function familyOf(focused){
  const parent = focused.type==='Moon' ? byId[focused.parent] : focused;
  return { parent, canonical: familyCanonicalPositions(parent) };
}
function defaultLookDir(focused){
  const {canonical} = familyOf(focused);
  if(focused.type==='Moon') return canonical[focused.id].clone().negate().normalize();
  return CANON_DIR.clone();
}
function thetaForHorizontalDir(dir){
  return Math.atan2(-dir.z, -dir.x);
}
function buildContextBodies(focused){
  clearContextBodies();
  const scaleFactor = RENDER_R / focused.radiusM;
  const { parent, canonical } = familyOf(focused);
  const focusedCanon = canonical[focused.id] || new THREE.Vector3(0,0,0);
  const minDist = RENDER_R*1.4;
  [parent, ...moonsOf(parent.id)].forEach(b=>{
    if(b.id===focused.id) return;
    let pos = canonical[b.id].clone().sub(focusedCanon).multiplyScalar(scaleFactor);
    if(pos.length() < minDist){
      pos = (pos.lengthSq()>1e-9 ? pos.clone().normalize() : CANON_DIR.clone()).multiplyScalar(minDist);
    }
    addContextSphere(b, pos, b.radiusM*scaleFactor);
  });
}

function loadBodyIntoScene(body){
  const myToken = ++loadToken;
  if(planetMesh){ planetGroup.remove(planetMesh); planetMesh.material.dispose(); }
  if(graticule){ planetGroup.remove(graticule); }
  clearGraticuleLabels();
  clearMarkers();
  clearOrbitPaths();
  heightSample = null;
  selectedFacilityId = null;

  const fallbackTex = getBodyTexture();
  const mat = new THREE.MeshStandardMaterial({map:fallbackTex, roughness:0.95, metalness:0.0});
  planetMesh = new THREE.Mesh(unitSphereGeo, mat);
  planetMesh.scale.setScalar(RENDER_R);
  planetGroup.add(planetMesh);

  const streamUrls = streamingUrlsFor(body);
  loadImageTexture(streamUrls.diffuse).then(t=>{
    if(myToken!==loadToken) return;
    mat.map = t; mat.needsUpdate = true;
  }).catch(()=>{ /* no local imagery for this body (e.g. Jool) — keep procedural fallback */ });

  getAltitudeRange(body).then(range=>{
    if(myToken!==loadToken) return;
    loadImageTexture(streamUrls.heightmap).then(t=>{
      if(myToken!==loadToken) return;
      mat.displacementMap = t;
      // Displacement is applied in the geometry's own OBJECT space (a unit
      // sphere, radius 1) before the mesh's RENDER_R scale is applied — so the
      // correct units here are altitude as a fraction of the body's real
      // radius, not raw metres, and NOT pre-multiplied by RENDER_R (that would
      // double-apply the scale once RENDER_R is applied on top, exaggerating
      // relief height). Black (0) in the heightmap -> lowestAlt, white (1) -> highestAlt.
      let objScale, objBias;
      if(range){
        objBias = range.lowestAlt / range.radiusM;
        objScale = (range.highestAlt - range.lowestAlt) / range.radiusM;
      } else {
        objScale = 0.03;
        objBias = -0.01;
      }
      mat.displacementScale = objScale;
      mat.displacementBias = objBias;
      mat.needsUpdate = true;

      // Decode the same heightmap image (t.image) to raw pixel data so pins
      // can be placed at the matching terrain radius, then move any
      // already-placed pins onto it.
      heightSample = { imgData: imageToImageData(t.image), objScale, objBias };
      refreshMarkerElevations();
      // The lat/lon grid was drawn at a fixed radius, but real terrain can now
      // bulge out past that. (objScale + objBias) is the highest point's offset
      // in the same object space as the displacement above — convert to world
      // units (multiply by RENDER_R) and rebuild the grid just outside it, so
      // it never sits under a mountain.
      const peakWorldOffset = RENDER_R * Math.max(0, objScale + objBias);
      const graticuleRadius = RENDER_R*1.004 + peakWorldOffset;
      if(graticule){ planetGroup.remove(graticule); }
      clearGraticuleLabels();
      graticule = buildGraticule(graticuleRadius);
      planetGroup.add(graticule);
    }).catch(()=>{ /* no local heightmap for this body — flat sphere is fine */ });
  });

  graticule = buildGraticule(RENDER_R*1.004);
  planetGroup.add(graticule);

  planetGroup.rotation.set(0,0,0);

  facilitiesFor(body.id).forEach(c=> addMarkerObject(c, body));
  orbitalsFor(body.id).forEach(o=>{
    buildOrbitPath(body, o);
    addMarkerObject(o, body);
  });
  buildContextBodies(body);
}

function resizeRenderer(){
  const vp = document.getElementById('viewport');
  const w = vp.clientWidth, h = vp.clientHeight;
  renderer.setSize(w,h,false);
  camera.aspect = w/Math.max(h,1);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resizeRenderer);

function updateLabels(){
  const rect = canvas.getBoundingClientRect();

  markerObjs.forEach(m=>{
    const worldPos = new THREE.Vector3();
    m.topRing.getWorldPosition(worldPos);
    const worldNormal = m.normal.clone().applyQuaternion(planetGroup.quaternion);
    const toCam = camera.position.clone().sub(worldPos).normalize();
    const facing = worldNormal.dot(toCam);
    const proj = worldPos.clone().project(camera);
    const visible = facing > 0.02 && proj.z < 1;
    if(!visible){ m.label.style.opacity='0'; m.mText.style.pointerEvents='none'; return; }
    const x = (proj.x*0.5+0.5)*rect.width;
    const y = (-proj.y*0.5+0.5)*rect.height;
    m.label.style.left = x+'px';
    m.label.style.top = y+'px';
    m.label.style.opacity = Math.min(1, facing/0.35);
    m.mText.style.pointerEvents='auto';
  });

  graticuleLabelObjs.forEach(l=>{
    const worldPos = new THREE.Vector3();
    l.anchor.getWorldPosition(worldPos);
    const localNormal = l.anchor.position.clone().normalize();
    const worldNormal = localNormal.applyQuaternion(planetGroup.quaternion);
    const toCam = camera.position.clone().sub(worldPos).normalize();
    const facing = worldNormal.dot(toCam);
    const proj = worldPos.clone().project(camera);
    if(facing <= 0.02 || proj.z >= 1){ l.el.style.opacity='0'; return; }
    const x = (proj.x*0.5+0.5)*rect.width;
    const y = (-proj.y*0.5+0.5)*rect.height - 9; // nudge clear of the grid line itself
    l.el.style.left = x+'px';
    l.el.style.top = y+'px';
    l.el.style.opacity = Math.min(0.85, facing/0.35*0.85);
  });

  contextLabels.forEach(l=>{
    const worldPos = new THREE.Vector3();
    l.mesh.getWorldPosition(worldPos);
    const proj = worldPos.clone().project(camera);
    if(proj.z>1){ l.el.style.opacity='0'; return; }
    const x = (proj.x*0.5+0.5)*rect.width;
    const y = (-proj.y*0.5+0.5)*rect.height;
    l.el.style.left = x+'px';
    l.el.style.top = y+'px';
    l.el.style.opacity='1';
  });
}
function animate(){
  requestAnimationFrame(animate);
  const t = performance.now()*0.001;
  markerObjs.forEach(m=>{
    const selected = String(m.facility.id)===String(selectedFacilityId);
    const s = selected ? 0.017*(1 + 0.22*Math.sin(t*2.4 + m.phase)) : 0.005;
    m.topRing.scale.set(s,1,s);
    // Same colour rule as the label text/dot: green normally, white on hover.
    m.topRingMat.color.set(m.hovered ? 0xffffff : 0x3fe676);
    m.ownerMat.opacity = selected ? 1 : 0.3;
  });
  orbitPathObjs.forEach(o=>{
    o.mat.opacity = String(o.facility.id)===String(selectedFacilityId) ? 1 : 0.3;
  });
  renderer.render(scene, camera);
  updateLabels();
}

/* =========================================================================
   RIGHT PANEL: facility list rendering
   ========================================================================= */
function refreshFacilityList(){
  const body = byId[currentBodyId];
  const list = allFacilitiesFor(currentBodyId);
  document.getElementById('facility-count').textContent = list.length;
  document.getElementById('facility-body-name').textContent = body.name.toUpperCase();
  document.getElementById('facility-sub').textContent = list.length
    ? `${list.length} settlement${list.length===1?'':'s'} tracked on ${body.name}.`
    : 'No facilities on this body in the connected sheet.';

  const wrap = document.getElementById('facility-list');
  if(!list.length){
    wrap.innerHTML = `<div class="empty-state"><span class="eic">○</span>No facilities on ${body.name}.</div>`;
    return;
  }
  wrap.innerHTML = list.map(c=>{
    const owners = parseOwners(c.owner);
    const isSel = String(c.id)===String(selectedFacilityId);
    const isOrbital = c.kind==='orbital';
    const coordsHTML = isOrbital
      ? `${(c.smaM/1000).toFixed(1)}km`
      : `${c.lat.toFixed(1)}°,${c.lon.toFixed(1)}°`;
    return `
    <div class="facility-row${isSel?' selected':''}" data-id="${c.id}">
      <span class="c-box" style="border-color:${ownerFlag(owners[0]).primary}"></span>
      <span class="c-name-wrap">
        <div class="c-name">${escapeHTML(c.name)}</div>
        <div class="c-owner">${escapeHTML(owners.join('; '))}</div>
      </span>
      <span class="c-coords">${coordsHTML}</span>
    </div>`;
  }).join('');

  wrap.querySelectorAll('.facility-row').forEach(el=>{
    el.addEventListener('click', ()=> focusFacilityRow(el.dataset.id));
  });
}
function focusFacilityRow(id){
  selectedFacilityId = id;
  document.querySelectorAll('.facility-row').forEach(el=>{
    el.classList.toggle('selected', String(el.dataset.id)===String(id));
  });
  const row = document.querySelector(`.facility-row[data-id="${id}"]`);
  if(row){ row.scrollIntoView({block:'nearest'}); }
}

/* =========================================================================
   POLITICAL ENTITIES (right-panel "Entities" tab)
   ========================================================================= */
function allOwnersSummary(){
  const map = {};
  BODIES.forEach(b=>{
    allFacilitiesFor(b.id).forEach(c=>{
      parseOwners(c.owner).forEach(o=>{
        if(!map[o]) map[o] = {count:0, bodies:new Set()};
        map[o].count++;
        map[o].bodies.add(b.name);
      });
    });
  });
  return Object.keys(map).sort((a,b)=>a.localeCompare(b)).map(name=>({
    name, count:map[name].count, bodies:[...map[name].bodies].sort()
  }));
}
function renderOwnersList(){
  const owners = allOwnersSummary();
  document.getElementById('owners-sub').textContent =
    `${owners.length} political entit${owners.length===1?'y':'ies'} recorded across the system.`;
  const wrap = document.getElementById('owners-list');
  if(!owners.length){
    wrap.innerHTML = `<div class="empty-state"><span class="eic">○</span>No political entities recorded yet.</div>`;
    return;
  }
  wrap.innerHTML = owners.map(o=>{
    const flag = ownerFlag(o.name);
    return `
    <div class="owner-row">
      <div class="o-top">
        <span class="o-flag" style="${flagStyle(flag)}"></span>
        <span class="o-name">${escapeHTML(o.name)}</span>
        <span class="o-count">${o.count} facilit${o.count===1?'y':'ies'}</span>
      </div>
      <div class="o-bodies">${o.bodies.map(escapeHTML).join(', ')}</div>
    </div>`;
  }).join('');
}
document.getElementById('tab-facilities').addEventListener('click', ()=>{
  document.getElementById('tab-facilities').classList.add('active');
  document.getElementById('tab-owners').classList.remove('active');
  document.getElementById('right-facilities-view').style.display = '';
  document.getElementById('right-owners-view').style.display = 'none';
});
document.getElementById('tab-owners').addEventListener('click', ()=>{
  document.getElementById('tab-owners').classList.add('active');
  document.getElementById('tab-facilities').classList.remove('active');
  document.getElementById('right-facilities-view').style.display = 'none';
  document.getElementById('right-owners-view').style.display = '';
  renderOwnersList();
});

/* =========================================================================
   BODY SELECTION
   ========================================================================= */
function selectBody(id){
  if(!byId[id] || id==='kerbol') return;
  currentBodyId = id;
  const body = byId[id];

  document.getElementById('card-type').textContent = body.type.toUpperCase();
  document.getElementById('card-name').textContent = body.name;
  document.getElementById('card-radius').textContent = fmtRadius(body.radiusM);
  document.getElementById('card-orbits').textContent = byId[body.parent].name;
  document.getElementById('card-dist').textContent = fmtDist(body.smaM);
  document.getElementById('card-facilities').textContent = allFacilitiesFor(id).length;

  loadBodyIntoScene(body);
  camTheta = thetaForHorizontalDir(defaultLookDir(body)); camPhi = CAM_PHI_DEFAULT; camRadius = 9; updateCameraPos();

  buildTree();
  buildSchematic();
  refreshFacilityList();

  if(window.innerWidth<=880){
    document.getElementById('panel-left').classList.remove('open');
  }
}
function refreshAll(){
  buildTree();
  buildSchematic();
  refreshFacilityList();
  loadBodyIntoScene(byId[currentBodyId]);
  document.getElementById('card-facilities').textContent = allFacilitiesFor(currentBodyId).length;
  if(document.getElementById('tab-owners').classList.contains('active')) renderOwnersList();
}

/* =========================================================================
   PANEL TOGGLES (mobile)
   ========================================================================= */
document.getElementById('btn-left-toggle').addEventListener('click', ()=>{
  document.getElementById('panel-left').classList.toggle('open');
  document.getElementById('panel-right').classList.remove('open');
});
document.getElementById('btn-right-toggle').addEventListener('click', ()=>{
  document.getElementById('panel-right').classList.toggle('open');
  document.getElementById('panel-left').classList.remove('open');
});

/* =========================================================================
   INIT
   ========================================================================= */
async function init(){
  resizeRenderer();
  selectBody('kerbin');
  await fetchSheetData();
  animate();
}
init();
