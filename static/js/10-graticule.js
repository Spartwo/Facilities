/* graticule.js — lat/lon grid overlay + its screen-space coordinate labels. Depends on: 07-scene-setup.js (graticuleLabelObjs, latLonToVec3). */

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

