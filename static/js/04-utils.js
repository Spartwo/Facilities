/* utils.js — small standalone UI/formatting helpers (toast messages, distance/radius formatting). No dependencies. */

/* =========================================================================
   TOAST
   ========================================================================= */
let toastTimer=null;
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('show'), 2200);
}


/* =========================================================================
   NUMBER FORMATTING
   ========================================================================= */
function fmtDist(m){
  if(m===0) return '—';
  if(m>=1e9) return (m/1e9).toFixed(2)+' Gm';
  if(m>=1e6) return (m/1e6).toFixed(1)+' Mm';
  return (m/1e3).toFixed(0)+' km';
}
function fmtRadius(m){ return (m/1000).toLocaleString()+' km'; }

