/* scene-loader.js — loads a body (terrain, graticule, markers, context bodies) into the 3D scene; canvas resize handling. Depends on nearly every file above it (07 through 12). */

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

