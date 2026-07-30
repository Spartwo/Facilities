/* data.js — static reference data for the Kerbol system (bodies, radii, colours). No dependencies. */

if (typeof THREE === 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const vp = document.getElementById('viewport');
    if (vp) vp.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#e6555a;font-family:sans-serif;text-align:center;padding:20px;">Three.js failed to load from CDN.<br>Check your network/CDN access and reload.</div>';
  });
  throw new Error('THREE.js not loaded');
}

/* =========================================================================
   DATA — Kerbol System (Kerbal Space Program), approximate real game values
   ========================================================================= */
const BODIES = [
  { id:'kerbol', name:'Kerbol', type:'Star', parent:null, radiusM:261600000, smaM:0,
    color:'#ffcf6b', secondary:'#ff8a24', style:'star' },

  { id:'moho', name:'Moho', type:'Planet', parent:'kerbol', radiusM:250000, smaM:5263138304,
    color:'#8a6a4d', secondary:'#5e4531', style:'cratered' },

  { id:'eve', name:'Eve', type:'Planet', parent:'kerbol', radiusM:700000, smaM:9832684544,
    color:'#7c3fa3', secondary:'#4c2568', style:'terran' },
  { id:'gilly', name:'Gilly', type:'Moon', parent:'eve', radiusM:13000, smaM:31500000,
    color:'#a7997c', secondary:'#7d7159', style:'cratered', tidalLocked:false },

  { id:'kerbin', name:'Kerbin', type:'Planet', parent:'kerbol', radiusM:600000, smaM:13599840256,
    color:'#2f7dc4', secondary:'#3f9c4c', style:'terran' },
  { id:'mun', name:'Mun', type:'Moon', parent:'kerbin', radiusM:200000, smaM:12000000,
    color:'#9a958c', secondary:'#6f6a62', style:'cratered', tidalLocked:true },
  { id:'minmus', name:'Minmus', type:'Moon', parent:'kerbin', radiusM:60000, smaM:47000000,
    color:'#5fc3ac', secondary:'#3d8f7d', style:'flats', tidalLocked:false },

  { id:'duna', name:'Duna', type:'Planet', parent:'kerbol', radiusM:320000, smaM:20726155264,
    color:'#c1652f', secondary:'#8a441f', style:'terran' },
  { id:'ike', name:'Ike', type:'Moon', parent:'duna', radiusM:130000, smaM:3200000,
    color:'#8f8b85', secondary:'#615d58', style:'cratered', tidalLocked:true },

  { id:'dres', name:'Dres', type:'Dwarf Planet', parent:'kerbol', radiusM:138000, smaM:40839348203,
    color:'#7d7368', secondary:'#54493f', style:'cratered' },

  { id:'jool', name:'Jool', type:'Gas Giant', parent:'kerbol', radiusM:6000000, smaM:68773560320, color:'#4f9d5c', secondary:'#2e6e3d', style:'bands' },
  { id:'laythe', name:'Laythe', type:'Moon', parent:'jool', radiusM:500000, smaM:27184000,
    color:'#3f7ea6', secondary:'#c9a86a', style:'terran', tidalLocked:true },
  { id:'vall', name:'Vall', type:'Moon', parent:'jool', radiusM:300000, smaM:43152000,
    color:'#cfe3e8', secondary:'#9fb8c2', style:'icy', tidalLocked:true },
  { id:'tylo', name:'Tylo', type:'Moon', parent:'jool', radiusM:600000, smaM:68500000,
    color:'#b8b3a8', secondary:'#84806f', style:'cratered', tidalLocked:true },
  { id:'bop', name:'Bop', type:'Moon', parent:'jool', radiusM:65000, smaM:128500000,
    color:'#9c7a52', secondary:'#6a5236', style:'cratered', tidalLocked:false },
  { id:'pol', name:'Pol', type:'Moon', parent:'jool', radiusM:44000, smaM:179890000,
    color:'#cbab6c', secondary:'#94743f', style:'cratered', tidalLocked:false },

  { id:'eeloo', name:'Eeloo', type:'Dwarf Planet', parent:'kerbol', radiusM:210000, smaM:90118820000,
    color:'#dfe6e8', secondary:'#a9b8bc', style:'icy' },
];
const byId = Object.fromEntries(BODIES.map(b=>[b.id,b]));
const PLANETS = BODIES.filter(b=>b.parent==='kerbol');
const moonsOf = pid => BODIES.filter(b=>b.parent===pid);

const PATTERNS = ['solid','stripe-h','stripe-v','diagonal','cross'];

