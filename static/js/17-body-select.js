/* body-select.js — switching the focused celestial body and refreshing every panel/scene. Depends on nearly everything above it. */

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

