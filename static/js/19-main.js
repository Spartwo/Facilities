/* main.js — mobile panel toggles + app entry point (init()). Must load LAST: init() runs immediately and calls functions defined in every other file. */

/* =========================================================================
   PANEL TOGGLES (mobile)
   ========================================================================= */
document.getElementById('btn-left-toggle').addEventListener('click', ()=>{
  document.getElementById('panel-left').classList.toggle('open');
  document.getElementById('panel-right').classList.remove('open');
});
document.getElementById('btn-right-toggle').addEventListener('click', ()=>{
  document.getElementById('panel-right').classList.toggle('open');
  document.getElementById('panel-left').classList.remove('open');
});

/* =========================================================================
   INIT
   ========================================================================= */
async function init(){
  resizeRenderer();
  // start on the body named in the URL (/Laythe), else Kerbin; 'replace' so
  // the initial view doesn't add a history entry of its own
  selectBody(bodyIdFromURL() || DEFAULT_BODY_ID, {history:'replace'});
  await fetchSheetData();
  animate();
}
init();
