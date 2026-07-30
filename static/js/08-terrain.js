/* terrain.js — heightmap sampling + texture loading, used to place pins on real terrain and texture each body. Depends on: 07-scene-setup.js (RENDER_R, markerObjs). */


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

