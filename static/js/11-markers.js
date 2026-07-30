/* markers.js — facility pin + orbital-path rendering (beacon geometry, orbit ellipses, marker labels). Also defines escapeHTML(), used throughout the app. Depends on: 01-data, 02-state, 05-flags, 07-scene-setup, 08-terrain. */

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
  const zTilt =  zOrb*Math.cos(incRad);
  // Longitude of ascending node — rotate the tilted orbital plane about the
  // body's polar (Y) axis so orbits don't all share the same orientation.
  const lanRad = THREE.MathUtils.degToRad(orbital.lanDeg||0);
  const cosL = Math.cos(lanRad), sinL = Math.sin(lanRad);
  const x = xOrb*cosL - zTilt*sinL;
  const z = xOrb*sinL + zTilt*cosL;
  const scaleFactor = RENDER_R / body.radiusM;
  return new THREE.Vector3(x*scaleFactor, y*scaleFactor, z*scaleFactor);
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
  const {pos, normal} = facilityWorldPos(facility, body);
  const isOrbital = facility.kind==='orbital';
  const group = new THREE.Group();
  group.position.copy(pos);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), normal);

  // One consistent colour for every pin/mast, matching the orbit-path colour
  // (ORBIT_BLUE) — no longer varies per-owner. Fades the same way the orbit
  // path does — dim at rest, full opacity once its facility is selected
  // (see animate()).
  const ownerMat = new THREE.LineBasicMaterial({color:ORBIT_BLUE, transparent:true, opacity:0.3});

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
