/* body-select.js — switching the focused celestial body and refreshing every panel/scene, plus keeping the page title and URL (/Laythe) in sync with it. Depends on nearly everything above it. */

/* =========================================================================
   URL + TITLE ROUTING
   The focused body lives in the path: /Facilities/Laythe. BASE_PATH is
   worked out from this script's own location (static/js/ -> two levels up),
   so it is /Facilities/ on GitHub Pages and / on a local server, with no
   hardcoding. Deep links on GitHub Pages rely on 404.html (see there).
   ========================================================================= */
const BASE_PATH = new URL('../../', document.currentScript.src).pathname;
const DEFAULT_BODY_ID = 'kerbin';

// Body id for the current URL, or null if the path is empty / not a body.
// Case-insensitive, so /laythe and /Laythe both work. Kerbol is the star and
// has no view of its own (selectBody refuses it), so it counts as unknown.
function bodyIdFromURL(){
  let seg = location.pathname.slice(BASE_PATH.length).split('/')[0];
  try{ seg = decodeURIComponent(seg); }catch(e){}
  const id = seg.toLowerCase();
  return (byId[id] && id!=='kerbol') ? id : null;
}
// mode: 'push' (new history entry), 'replace' (fix up the current one),
// or 'none' (URL already correct, e.g. we're reacting to back/forward).
function syncURL(body, mode){
  document.title = 'KP Facilities | ' + body.name;
  if(mode==='none') return;
  const url = BASE_PATH + encodeURIComponent(body.name) + location.search + location.hash;
  if(location.pathname + location.search + location.hash === url) return;
  history[mode==='replace' ? 'replaceState' : 'pushState'](null, '', url);
}
// Back / forward buttons.
window.addEventListener('popstate', ()=>{
  selectBody(bodyIdFromURL() || DEFAULT_BODY_ID, {history:'none'});
});

/* =========================================================================
   BODY SELECTION
   ========================================================================= */
function selectBody(id, opts){
  if(!byId[id] || id==='kerbol') return;
  currentBodyId = id;
  const body = byId[id];
  syncURL(body, (opts && opts.history) || 'push');

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

