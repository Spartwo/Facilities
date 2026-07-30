/* flags.js — resolves an owner name to real, sheet-defined flag data (never a synthetic placeholder) and renders it. Depends on: 02-state.js (entityFlags), 11-markers.js (escapeHTML — called later at runtime, so load order doesn't matter in practice). */

/* =========================================================================
   OWNER-DERIVED FLAGS
   A facility's flag only exists if its owner is an explicitly-defined
   political entity (from the Entities tab) with real flag data (a colour
   scheme and/or a flag image). There is no owner (Unclaimed) or an owner
   with no matching Entities row — returns null, and no placeholder flag is
   ever synthesized. Callers must check for null and simply skip spawning
   that flag rather than rendering a stand-in.
   ========================================================================= */
function hashStr(str){ let h=0; for(let i=0;i<str.length;i++){ h=(h<<5)-h+str.charCodeAt(i); h|=0; } return h>>>0; }
function ownerFlag(owner){
  if(!owner || owner==='Unclaimed') return null;
  const explicit = entityFlags[owner.trim().toLowerCase()];
  if(!explicit) return null;
  return {
    primary: explicit.primary || '#9aa7ba',
    secondary: explicit.secondary || explicit.primary || '#9aa7ba',
    pattern: explicit.pattern || 'solid',
    image: explicit.image || null
  };
}
function flagCSS(primary, secondary, pattern){
  switch(pattern){
    case 'solid': return `background:${primary};`;
    case 'stripe-h': return `background: linear-gradient(0deg, ${primary} 34%, ${secondary} 34%, ${secondary} 66%, ${primary} 66%);`;
    case 'stripe-v': return `background: linear-gradient(90deg, ${primary} 34%, ${secondary} 34%, ${secondary} 66%, ${primary} 66%);`;
    case 'diagonal': return `background: linear-gradient(135deg, ${primary} 48%, ${secondary} 52%);`;
    case 'cross': return `background:${primary}; background-image: linear-gradient(${secondary},${secondary}), linear-gradient(${secondary},${secondary}); background-size: 100% 30%, 30% 100%; background-position: center; background-repeat: no-repeat;`;
    default: return `background:${primary};`;
  }
}
function isSafeImageUrl(url){
  return /^https?:\/\//i.test(url||'');
}
function flagStyle(flag){
  if(flag.image){
    const safeUrl = flag.image.replace(/'/g,'%27').replace(/"/g,'%22');
    return `background-image:url('${safeUrl}'); background-size:cover; background-position:center; background-color:${flag.primary};`;
  }
  return flagCSS(flag.primary, flag.secondary, flag.pattern);
}
function parseOwners(ownerStr){
  const parts = (ownerStr||'').split(';').map(s=>s.trim()).filter(Boolean);
  return parts.length ? parts : ['Unclaimed'];
}
function ownerFlagsHTML(ownerStr, flagClass){
  const owners = parseOwners(ownerStr);
  const swatches = owners.map(o=>{
    const f = ownerFlag(o);
    if(!f) return ''; // no entity / no flag data — don't spawn a placeholder
    return `<span class="${flagClass}" style="${flagStyle(f)}" title="${escapeHTML(o)}"></span>`;
  }).join('');
  return swatches ? `<span class="flag-group">${swatches}</span>` : '';
}

