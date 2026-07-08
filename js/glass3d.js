// ============================================================
// glass3d.js — translucent glass hero (Lusion-technique preview)
// MeshPhysicalMaterial transmission+thickness (real glass, not metal) +
// noise displacement. Built CORRECT from the start: single gsap.ticker
// loop + Lenis scroll (lesson from tonight's site-1 jank fix).
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const canvas = document.getElementById('world-canvas');
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width:760px)').matches;

function fail(){ document.documentElement.classList.add('no-3d'); }
function hasWebGL(){ try { const c=document.createElement('canvas'); return !!(c.getContext('webgl2')||c.getContext('webgl')); } catch(e){ return false; } }

const SNOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;
vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);
vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);
vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}`;

function makeEnv(renderer){
  const c=document.createElement('canvas'); c.width=512;c.height=256; const g=c.getContext('2d');
  const grad=g.createLinearGradient(0,0,0,256);
  grad.addColorStop(0,'#0b1420'); grad.addColorStop(0.45,'#12222c'); grad.addColorStop(0.52,'#7FE0E8');
  grad.addColorStop(0.6,'#1a3038'); grad.addColorStop(1,'#040508');
  g.fillStyle=grad; g.fillRect(0,0,512,256);
  const tex=new THREE.CanvasTexture(c); tex.mapping=THREE.EquirectangularReflectionMapping;
  const pmrem=new THREE.PMREMGenerator(renderer); const env=pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); pmrem.dispose(); return env;
}

function initGlass(){
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:!isMobile, alpha:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, isMobile?1.5:2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070a, 0.1);
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth/window.innerHeight, 0.1, 100);
  camera.position.set(0,0,5.8);

  const envMap = makeEnv(renderer);

  // translucent glass object — MeshPhysicalMaterial transmission+thickness
  // (Lusion's real technique per research: matcap+thickness translucency,
  // not raymarched metaballs). Noise-displaced for an organic, non-CAD shape.
  const uniforms = { uTime:{value:0}, uAmp:{value:0} };
  const geo = new THREE.IcosahedronGeometry(1.55, isMobile?48:120);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x0d1a1f, metalness:0, roughness:0.12, transmission:1, thickness:1.6,
    ior:1.4, envMap, envMapIntensity:1.4, clearcoat:0.6, clearcoatRoughness:0.2,
    attenuationColor: new THREE.Color(0x7FE0E8), attenuationDistance: 1.2
  });
  mat.onBeforeCompile = (sh)=>{
    sh.uniforms.uTime=uniforms.uTime; sh.uniforms.uAmp=uniforms.uAmp;
    sh.vertexShader = `uniform float uTime; uniform float uAmp;\n${SNOISE}\n` + sh.vertexShader.replace('#include <begin_vertex>', `
      float n = snoise(normal*1.3 + uTime*0.13);
      vec3 transformed = position + normal * (n*(0.13+uAmp));`);
  };
  const orb = new THREE.Mesh(geo, mat);
  scene.add(orb);

  const key = new THREE.DirectionalLight(0x7FE0E8, 2.4); key.position.set(4,5,3); scene.add(key);
  const fill = new THREE.DirectionalLight(0x203040, 1.0); fill.position.set(-5,-2,-3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7); rim.position.set(-3,2,-4); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x30404a,0.3));

  let composer=null;
  if(!isMobile){
    composer=new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene,camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth,window.innerHeight),0.5,0.9,0.86));
  }

  function place(){
    const w=window.innerWidth;
    orb.position.x = w>900?1.7:(w>620?0.9:0);
    orb.position.y = w>620?0.1:0.5;
    const s = w>900?1:(w>620?0.85:0.7);
    orb.scale.setScalar(s);
  }
  place();

  const mouse={x:0,y:0,tx:0,ty:0,lastX:0,lastY:0};
  window.addEventListener('pointermove',(e)=>{
    mouse.tx=(e.clientX/window.innerWidth)*2-1; mouse.ty=(e.clientY/window.innerHeight)*2-1;
    uniforms.uAmp.value=Math.min(uniforms.uAmp.value+Math.hypot(mouse.tx-mouse.lastX,mouse.ty-mouse.lastY)*0.4,0.35);
    mouse.lastX=mouse.tx; mouse.lastY=mouse.ty;
  },{passive:true});

  function resize(){
    const W=window.innerWidth,H=window.innerHeight;
    camera.aspect=W/H; camera.updateProjectionMatrix();
    renderer.setSize(W,H); if(composer) composer.setSize(W,H); place();
  }
  window.addEventListener('resize',resize);

  const clock=new THREE.Clock();
  let running=true, raf=null;
  const usingTicker=!!(window.gsap && window.gsap.ticker);
  function renderOnce(){ if(composer) composer.render(); else renderer.render(scene,camera); }
  function tick(){
    if(!running) return;
    const t=clock.getElapsedTime();
    uniforms.uTime.value=t; uniforms.uAmp.value*=0.94;
    mouse.x += (mouse.tx-mouse.x)*0.05; mouse.y += (mouse.ty-mouse.y)*0.05;
    camera.position.x += (mouse.x*0.4-camera.position.x)*0.05;
    camera.position.y += (-mouse.y*0.3-camera.position.y)*0.05;
    camera.lookAt(orb.position.x*0.4,0,0);
    orb.rotation.y += 0.0014; orb.rotation.x += 0.0005;
    renderOnce();
    if(!usingTicker) raf=requestAnimationFrame(tick);
  }
  function startLoop(){ if(usingTicker) window.gsap.ticker.add(tick); else tick(); }
  function stopLoop(){ if(usingTicker) window.gsap.ticker.remove(tick); else if(raf) cancelAnimationFrame(raf); }
  if(REDUCED){ renderOnce(); } else startLoop();

  document.addEventListener('visibilitychange',()=>{
    if(REDUCED) return;
    if(document.hidden){ running=false; stopLoop(); }
    else if(!running){ running=true; clock.start(); startLoop(); }
  });
}

if (!canvas || !hasWebGL()) fail();
else { try { initGlass(); } catch(e){ console.warn('[glass3d] failed → no-3d', e); fail(); } }
