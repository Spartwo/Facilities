/* entities-panel.js — right panel: the political-entities ("Entities") tab. Depends on: 01-data, 02-state, 05-flags, 11-markers (escapeHTML). */

/* =========================================================================
   POLITICAL ENTITIES (right-panel "Entities" tab)
   ========================================================================= */
function allOwnersSummary(){
  const map = {};
  BODIES.forEach(b=>{
    allFacilitiesFor(b.id).forEach(c=>{
      parseOwners(c.owner).forEach(o=>{
        if(!map[o]) map[o] = {count:0, bodies:new Set()};
        map[o].count++;
        map[o].bodies.add(b.name);
      });
    });
  });
  return Object.keys(map).sort((a,b)=>a.localeCompare(b)).map(name=>({
    name, count:map[name].count, bodies:[...map[name].bodies].sort()
  }));
}
function renderOwnersList(){
  const owners = allOwnersSummary();
  document.getElementById('owners-sub').textContent =
    `${owners.length} political entit${owners.length===1?'y':'ies'} recorded across the system.`;
  const wrap = document.getElementById('owners-list');
  if(!owners.length){
    wrap.innerHTML = `<div class="empty-state"><span class="eic">○</span>No political entities recorded yet.</div>`;
    return;
  }
  wrap.innerHTML = owners.map(o=>{
    const flag = ownerFlag(o.name);
    const flagHTML = flag ? `<span class="o-flag" style="${flagStyle(flag)}"></span>` : '';
    return `
    <div class="owner-row">
      <div class="o-top">
        ${flagHTML}
        <span class="o-name">${escapeHTML(o.name)}</span>
        <span class="o-count">${o.count} facilit${o.count===1?'y':'ies'}</span>
      </div>
      <div class="o-bodies">${o.bodies.map(escapeHTML).join(', ')}</div>
    </div>`;
  }).join('');
}
document.getElementById('tab-facilities').addEventListener('click', ()=>{
  document.getElementById('tab-facilities').classList.add('active');
  document.getElementById('tab-owners').classList.remove('active');
  document.getElementById('right-facilities-view').style.display = '';
  document.getElementById('right-owners-view').style.display = 'none';
});
document.getElementById('tab-owners').addEventListener('click', ()=>{
  document.getElementById('tab-owners').classList.add('active');
  document.getElementById('tab-facilities').classList.remove('active');
  document.getElementById('right-facilities-view').style.display = 'none';
  document.getElementById('right-owners-view').style.display = '';
  renderOwnersList();
});

