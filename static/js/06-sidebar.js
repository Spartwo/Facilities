/* sidebar.js — left panel: system schematic (SVG) + celestial body tree. Depends on: 01-data.js, 02-state.js, 17-body-select.js (selectBody(), wired up as a click handler here but only called later). */

/* =========================================================================
   SIDEBAR: system schematic (SVG)
   ========================================================================= */
function buildSchematic(){
  const svg = document.getElementById('schematic');
  const W=250,H=96, padL=14, padR=10, cy=H/2+6;
  const smas = PLANETS.map(p=>p.smaM);
  const logMin = Math.log10(Math.min(...smas));
  const logMax = Math.log10(Math.max(...smas));
  const xFor = sma => padL + (Math.log10(sma)-logMin)/(logMax-logMin) * (W-padL-padR);

  let svgHTML = `<line x1="${padL-8}" y1="${cy}" x2="${W-padR+2}" y2="${cy}" stroke="#28331f" stroke-width="1"/>`;
  svgHTML += `<circle cx="${padL-8}" cy="${cy}" r="5" fill="none" stroke="#ffffff" stroke-width="1.6"/>`;
  PLANETS.forEach(p=>{
    const x = xFor(p.smaM);
    const r = 3 + Math.log10(p.radiusM/1000)*0.9;
    const current = byId[currentBodyId];
    const isActive = p.id===currentBodyId || (current && current.parent===p.id);
    svgHTML += `<g class="sch-body${isActive?' active':''}" data-body="${p.id}">
      <circle class="dot" cx="${x}" cy="${cy}" r="${Math.max(2.5,r)}" fill="${isActive?p.color:'none'}" stroke="${p.color}" stroke-width="1.6"/>
      <text class="sch-label" x="${x}" y="${cy+16}" text-anchor="middle">${p.name}</text>
    </g>`;
  });
  svg.innerHTML = svgHTML;
  svg.querySelectorAll('.sch-body').forEach(g=>{
    g.addEventListener('click', ()=> selectBody(g.dataset.body));
  });
}

/* =========================================================================
   SIDEBAR: body tree
   ========================================================================= */
function buildTree(){
  const tree = document.getElementById('tree');
  let html = `<div class="tree-star"><span class="sun-dot"></span>KERBOL</div>`;
  PLANETS.forEach(p=>{
    const moons = moonsOf(p.id);
    const n = allFacilitiesFor(p.id).length;
    const isActive = p.id===currentBodyId;
    html += `<div class="tree-body${isActive?' active':''}" data-body="${p.id}">
      <span class="b-dot" style="border-color:${p.color};background:${isActive?p.color:'transparent'}"></span>${p.name}
      ${n?`<span class="b-count">${n}</span>`:''}
    </div>`;
    if(moons.length){
      html += `<div class="tree-moons">`;
      moons.forEach(m=>{
        const mn = allFacilitiesFor(m.id).length;
        const mActive = m.id===currentBodyId;
        html += `<div class="tree-body${mActive?' active':''}" data-body="${m.id}">
          <span class="b-dot" style="border-color:${m.color};background:${mActive?m.color:'transparent'}"></span>${m.name}
          ${mn?`<span class="b-count">${mn}</span>`:''}
        </div>`;
      });
      html += `</div>`;
    }
  });
  tree.innerHTML = html;
  tree.querySelectorAll('.tree-body[data-body]').forEach(el=>{
    el.addEventListener('click', ()=> selectBody(el.dataset.body));
  });
}

