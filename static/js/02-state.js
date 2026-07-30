/* state.js — mutable app state (current body, sheet config) + sheet-derived facility/orbital/entity data and small accessors. Depends on: 01-data.js (BODIES). */

/* =========================================================================
   STATE
   ========================================================================= */
let currentBodyId = 'kerbin';
const DEFAULT_API_BASE = 'https://script.google.com/macros/s/AKfycbzxdItRr5JMawEK-LYLcd4vqLmCsHHmS5-dm4apfRSEGXbtpCTCNLkz9bs00aOEiHBq/exec';
// hardcoded — not exposed or editable in the UI
const sheetConfig = { apiBase: DEFAULT_API_BASE, tab:'Colonies', entityTab:'Entities', orbitalsTab:'Orbitals' };
let sheetFacilities = {};
let entityFlags = {};
let sheetOrbitals = {};

function facilitiesFor(bodyId){
  return sheetFacilities[bodyId] || [];
}
// The Apps Script backend returns a JSON array on success, or a plain
// {error: "..."} object if e.g. the requested tab doesn't exist. Surface
// that message directly instead of a generic "unexpected shape" — it's
// almost always the real, actionable reason (wrong tab name, typo, etc).
function shapeErrorReason(rows){
  if(rows && typeof rows==='object' && !Array.isArray(rows) && rows.error) return rows.error;
  try{ return JSON.stringify(rows).slice(0,200); }catch(e){ return String(rows); }
}
function orbitalsFor(bodyId){
  return sheetOrbitals[bodyId] || [];
}
// Combined surface + orbital facilities for a body — used anywhere facilities
// are counted or listed (tree counts, the facility panel, owner summaries).
// The 3D scene keeps the two apart, since they're placed very differently.
function allFacilitiesFor(bodyId){
  return facilitiesFor(bodyId).concat(orbitalsFor(bodyId));
}

