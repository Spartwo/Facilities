/* facility-panel.js — right panel: the facility list for the selected body. Depends on: 02-state, 05-flags, 11-markers (escapeHTML), 07-scene-setup (selectedFacilityId). */

/* =========================================================================
   RIGHT PANEL: facility list rendering
   ========================================================================= */
function refreshFacilityList(){
  const body = byId[currentBodyId];
  const list = allFacilitiesFor(currentBodyId);
  document.getElementById('facility-count').textContent = list.length;
  document.getElementById('facility-body-name').textContent = body.name.toUpperCase();
  document.getElementById('facility-sub').textContent = list.length
    ? `${list.length} settlement${list.length===1?'':'s'} tracked on ${body.name}.`
    : 'No facilities on this body in the connected sheet.';

  const wrap = document.getElementById('facility-list');
  if(!list.length){
    wrap.innerHTML = `<div class="empty-state"><span class="eic">○</span>No facilities on ${body.name}.</div>`;
    return;
  }
  wrap.innerHTML = list.map(c=>{
    const owners = parseOwners(c.owner);
    const isSel = String(c.id)===String(selectedFacilityId);
    const isOrbital = c.kind==='orbital';
    const coordsHTML = isOrbital
      ? `${(c.smaM/1000).toFixed(1)}km`
      : `${c.lat.toFixed(1)}°,${c.lon.toFixed(1)}°`;
    const ownerFlagData = ownerFlag(owners[0]);
    const boxHTML = ownerFlagData ? `<span class="c-box" style="border-color:${ownerFlagData.primary}"></span>` : '';
    return `
    <div class="facility-row${isSel?' selected':''}" data-id="${c.id}">
      ${boxHTML}
      <span class="c-name-wrap">
        <div class="c-name">${escapeHTML(c.name)}</div>
        <div class="c-owner">${escapeHTML(owners.join('; '))}</div>
      </span>
      <span class="c-coords">${coordsHTML}</span>
    </div>`;
  }).join('');

  wrap.querySelectorAll('.facility-row').forEach(el=>{
    el.addEventListener('click', ()=> focusFacilityRow(el.dataset.id));
  });
}
function focusFacilityRow(id){
  selectedFacilityId = (String(selectedFacilityId)===String(id)) ? null : id;
  document.querySelectorAll('.facility-row').forEach(el=>{
    el.classList.toggle('selected', String(el.dataset.id)===String(selectedFacilityId));
  });
  if(selectedFacilityId!==null){
    const row = document.querySelector(`.facility-row[data-id="${selectedFacilityId}"]`);
    if(row){ row.scrollIntoView({block:'nearest'}); }
  }
}

