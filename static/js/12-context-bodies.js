/* context-bodies.js — dim sibling-body markers shown for spatial context around the focused body. Depends on: 01-data, 07-scene-setup, 08-terrain/09-streaming-imagery (getBodyTexture, streamingUrlsFor). */

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

