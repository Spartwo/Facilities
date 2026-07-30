/* render-loop.js — per-frame label placement/fade (including the orbital horizon-occlusion fade) and the main animate() loop. Depends on: 07-scene-setup.js (scene/camera/markerObjs/orbitPathObjs). */

// Ray/sphere occlusion against the planet body (radius RENDER_R, always
// centred at the world origin) — used for orbital facilities, which float
// above the surface and so shouldn't fade using the same surface-normal
// "facing" heuristic used for ground facilities (that heuristic hides them
// as soon as their sub-point normal turns away from the camera, i.e. far
// too early — well before the planet itself would actually block the view
// of something in orbit).
//
// Returns a continuous 0..1 visibility rather than a boolean: as the ray
// from the camera to the target grazes the sphere, the perpendicular
// distance from that ray to the sphere's centre ("distToLine") sits right
// at sphereRadius. We fade opacity across a small band around that
// threshold (ORBITAL_FADE_WIDTH) so the marker eases out behind the limb
// the same way surface markers ease out as they rotate out of view,
// instead of instantly swapping visible/hidden.
const ORBITAL_FADE_WIDTH = 0.12;
function orbitalVisibility(camPos, targetPos, sphereRadius, fadeWidth){
  const dir = targetPos.clone().sub(camPos);
  const dist = dir.length();
  dir.normalize();
  const b = camPos.dot(dir);
  const camDistSq = camPos.dot(camPos);
  const disc = b*b - (camDistSq - sphereRadius*sphereRadius);
  if(disc <= 0) return 1; // ray never comes near the sphere — always visible
  const sqrtDisc = Math.sqrt(disc);
  const t0 = -b - sqrtDisc; // near intersection with the sphere
  const t1 = -b + sqrtDisc; // far intersection with the sphere
  if(t0 >= dist - 0.001) return 1; // sphere sits beyond the target — doesn't block it
  if(t1 <= 0.001) return 1;        // sphere is entirely behind the camera
  // The ray does pass through the sphere before reaching the target, so the
  // marker is at least partly behind the planet. Fade based on how deep —
  // i.e. how far the ray's closest approach sits inside sphereRadius.
  const distToLine = Math.sqrt(Math.max(0, camDistSq - b*b));
  const penetration = sphereRadius - distToLine; // ~0 right at the limb, grows toward full occlusion
  return THREE.MathUtils.clamp(1 - penetration/fadeWidth, 0, 1);
}
function updateLabels(){
  const rect = canvas.getBoundingClientRect();

  markerObjs.forEach(m=>{
    const worldPos = new THREE.Vector3();
    m.topRing.getWorldPosition(worldPos);
    const proj = worldPos.clone().project(camera);
    let visible, opacity;
    if(m.facility.kind==='orbital'){
      opacity = orbitalVisibility(camera.position, worldPos, RENDER_R*1.004, ORBITAL_FADE_WIDTH);
      visible = opacity > 0.01 && proj.z < 1;
    }else{
      const worldNormal = m.normal.clone().applyQuaternion(planetGroup.quaternion);
      const toCam = camera.position.clone().sub(worldPos).normalize();
      const facing = worldNormal.dot(toCam);
      visible = facing > 0.02 && proj.z < 1;
      opacity = Math.min(1, facing/0.35);
    }
    if(!visible){ m.label.style.opacity='0'; m.mText.style.pointerEvents='none'; return; }
    const x = (proj.x*0.5+0.5)*rect.width;
    const y = (-proj.y*0.5+0.5)*rect.height;
    m.label.style.left = x+'px';
    m.label.style.top = y+'px';
    m.label.style.opacity = opacity;
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

