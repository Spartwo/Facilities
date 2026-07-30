/* scene-setup.js — renderer/scene/camera setup plus mouse/touch camera controls. Self-contained; runs its own top-level setup immediately, so load this before any file that touches the 3D scene. */

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
