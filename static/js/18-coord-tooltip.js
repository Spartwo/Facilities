/* coord-tooltip.js — hold Alt over the globe to read the latitude/longitude under the pointer. Depends on: 07-scene-setup.js (canvas, camera, planetMesh, RENDER_R), 08-terrain.js (heightSample, markerRadiusFor, PIN_SURFACE_LIFT). Loads before 19-main.js. */

(function(){
  const tip = document.createElement('div');
  tip.id = 'coord-tip';
  document.body.appendChild(tip);

  // macOS calls the key Option; show whichever the user actually has.
  const keyName = document.getElementById('alt-key-name');
  if(keyName && /Mac|iPhone|iPad/.test(navigator.platform)) keyName.textContent = 'Option';

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const sphere = new THREE.Sphere(new THREE.Vector3(0,0,0), RENDER_R); // planetGroup is never moved or rotated
  const hitPt = new THREE.Vector3();

  // Inverse of latLonToVec3() (07-scene-setup.js), which the graticule and the
  // facility pins use, so the readout always agrees with the grid.
  function latLonOf(v){
    return {
      lat: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(v.y / v.length(), -1, 1))),
      lon: THREE.MathUtils.radToDeg(Math.atan2(v.z, v.x))
    };
  }

  // Terrain is drawn by a shader displacement, so a plain raycast only sees the
  // bare sphere. Start there, then re-intersect at the terrain radius under
  // the hit (same maths the pins use) a couple of times so relief doesn't
  // shift the reading. Returns null when the pointer isn't over the body.
  function pick(clientX, clientY){
    if(!planetMesh) return null;
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);

    let result = null, r = RENDER_R;
    for(let i = 0; i < 3; i++){
      sphere.radius = r;
      if(!raycaster.ray.intersectSphere(sphere, hitPt)) break;
      result = latLonOf(hitPt);
      const terrainR = heightSample ? markerRadiusFor(result.lat, result.lon) - PIN_SURFACE_LIFT : RENDER_R;
      if(Math.abs(terrainR - r) < 1e-4) break;
      r = terrainR;
    }
    return result;
  }

  function format(p){
    return `${Math.abs(p.lat).toFixed(2)}\u00B0${p.lat >= 0 ? 'N' : 'S'}  ${Math.abs(p.lon).toFixed(2)}\u00B0${p.lon >= 0 ? 'E' : 'W'}`;
  }

  let altDown = false, inside = false, px = 0, py = 0, running = false;

  function hide(){ tip.classList.remove('show'); }
  function render(){
    const p = pick(px, py);
    if(!p){ hide(); return; }
    tip.textContent = format(p);
    tip.classList.add('show');
    let x = px + 16, y = py + 18;
    if(x + tip.offsetWidth  > window.innerWidth  - 8) x = px - tip.offsetWidth  - 12;
    if(y + tip.offsetHeight > window.innerHeight - 8) y = py - tip.offsetHeight - 12;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }
  // Re-pick every frame while active, so the readout stays right when the globe
  // moves under a stationary pointer (scroll-zoom, drag, switching body).
  function tick(){
    if(!(altDown && inside)){ running = false; hide(); return; }
    render();
    requestAnimationFrame(tick);
  }
  function update(){
    if(altDown && inside){
      if(!running){ running = true; requestAnimationFrame(tick); }
    }else{
      hide();
    }
  }

  canvas.addEventListener('pointermove', e=>{
    px = e.clientX; py = e.clientY; inside = true;
    altDown = e.altKey;
    update();
  });
  canvas.addEventListener('pointerleave', ()=>{ inside = false; update(); });

  window.addEventListener('keydown', e=>{
    if(e.key !== 'Alt') return;
    altDown = true;
    if(inside) e.preventDefault();
    update();
  });
  window.addEventListener('keyup', e=>{
    if(e.key !== 'Alt') return;
    altDown = false;
    // Stops Windows/Linux browsers treating a lone Alt tap as "focus the menu bar"
    if(inside) e.preventDefault();
    update();
  });
  window.addEventListener('blur', ()=>{ altDown = false; update(); });
})();
