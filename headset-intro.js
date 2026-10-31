import * as THREE from 'three';
import { createElectricArcs } from './electric-arcs.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const stage=document.getElementById('stage'), flash=document.getElementById('flash');
const site=document.getElementById('site'), loading=document.getElementById('loading');
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
let renderer, model, raf, electricity, finished=false;
const straps=[];
const clamp=(v)=>Math.max(0,Math.min(1,v));
const smooth=(a,b,t)=>{const x=clamp((t-a)/(b-a));return x*x*(3-2*x);};
function finish(){
 if(finished)return;finished=true;cancelAnimationFrame(raf);
 site.style.visibility='visible';
 document.body.classList.add('revealed');
 electricity?.dispose();
 renderer?.dispose();
 window.skipIntro();
}
document.getElementById('skip').addEventListener('click',finish);
reduceMotion.addEventListener('change',event=>{if(event.matches)finish();});
try {
 if(reduceMotion.matches || document.body.classList.contains('revealed'))finish();
 else {
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.82;
  stage.prepend(renderer.domElement);
  const aura=document.createElement('div');aura.id='aura';stage.prepend(aura);
  const scene=new THREE.Scene();
  const studio=new THREE.Scene();studio.background=new THREE.Color('#09051a');
  function softbox(color,intensity,x,y,z,w,h){
   const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide}));
   panel.position.set(x,y,z);panel.lookAt(0,0,0);studio.add(panel);
  }
  softbox('#9994d9',1.4,-1,2,1,1.3,3);
  softbox('#6c24bd',2.8,2,.5,-1,.7,4);
  softbox('#304bba',2.5,-2,0,-1,1,3);
  softbox('#742350',1.5,0,-2,1,3,.5);
  softbox('#b7c4ed',1.5,0,2,2,3,.25);
  const pmrem=new THREE.PMREMGenerator(renderer);
  scene.environment=pmrem.fromScene(studio,.04).texture;pmrem.dispose();
  const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.001,10);
  camera.position.set(0,.01,.36);
  scene.add(new THREE.HemisphereLight(0x686caa,0x020207,.12));
  const key=new THREE.DirectionalLight(0xabb6e0,1.1);key.position.set(-1,2,3);scene.add(key);
  const edge=new THREE.DirectionalLight(0x6525b5,2.6);edge.position.set(2,0,-2);scene.add(edge);
  const pink=new THREE.DirectionalLight(0x8b245e,.8);pink.position.set(-2,-1,1);scene.add(pink);
  const blue=new THREE.DirectionalLight(0x3654ac,.7);blue.position.set(1,1,2);scene.add(blue);
  // A tight shadow volume preserves detail at the headset's metre-scale size.
  for(const light of [key,pink]){
   light.castShadow=true;
   light.shadow.mapSize.set(1024,1024);
   Object.assign(light.shadow.camera,{left:-.24,right:.24,top:.24,bottom:-.24,near:.1,far:6});
   light.shadow.camera.updateProjectionMatrix();
   light.shadow.normalBias=.00035;
   light.shadow.bias=-.000015;
   light.shadow.radius=3;
  }
  const pivot=new THREE.Group();scene.add(pivot);
  electricity=createElectricArcs(pivot);
  const center=new THREE.Vector3(0,0,-.055);
  new GLTFLoader().load('./assets/models/quest-3.glb?v=5',gltf=>{
   if(finished)return;
   model=gltf.scene;
   model.traverse(object=>{
    if(!object.isMesh)return;
    object.castShadow=true;object.receiveShadow=true;
    const material=object.material;
    if(/porcelain/i.test(material.name)){
     object.material=new THREE.MeshPhysicalMaterial({color:0x373044,metalness:.6,roughness:.23,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:.85,side:THREE.DoubleSide});
    } else if(/black glass/i.test(material.name)) {
     object.material=material.clone();object.material.envMapIntensity=1.5;
    }
    if(!/woven.*strap/i.test(object.name))return;
    object.material=object.material.clone();
    object.material.transparent=true;
    object.material.depthWrite=false;
    straps.push(object);
   });
   model.position.sub(center);pivot.add(model);loading.remove();
  },undefined,()=>{loading.textContent='Unable to load headset';finish();});
  const boundsCorner=new THREE.Vector3(),screenRight=new THREE.Vector3(),screenUp=new THREE.Vector3();
  function centerSilhouette(weight){
   pivot.position.set(0,0,0);
   if(!model || weight<=0)return;
   camera.updateMatrixWorld();
   screenRight.setFromMatrixColumn(camera.matrixWorld,0);
   screenUp.setFromMatrixColumn(camera.matrixWorld,1);
   for(let pass=0;pass<2;pass++){
    pivot.updateMatrixWorld(true);
    let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity;
    model.traverse(object=>{
     if(!object.isMesh || !object.visible)return;
     object.geometry.computeBoundingBox();const box=object.geometry.boundingBox;
     for(let corner=0;corner<8;corner++){
      boundsCorner.set(corner&1?box.max.x:box.min.x,corner&2?box.max.y:box.min.y,corner&4?box.max.z:box.min.z);
      boundsCorner.applyMatrix4(object.matrixWorld).project(camera);
      left=Math.min(left,boundsCorner.x);right=Math.max(right,boundsCorner.x);
      top=Math.max(top,boundsCorner.y);bottom=Math.min(bottom,boundsCorner.y);
     }
    });
    const halfHeight=camera.position.distanceTo(pivot.position)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    pivot.position.addScaledVector(screenRight,-(left+right)/2*halfHeight*camera.aspect);
    pivot.position.addScaledVector(screenUp,-(top+bottom)/2*halfHeight);
   }
   // Release framing correction as the camera enters the lenses.
   pivot.position.multiplyScalar(weight);
  }
  let progress=0,last=performance.now();
  function render(now){
   if(finished)return;
   if(document.body.classList.contains('revealed')){finish();return;}
   const raw=clamp(scrollY/(document.getElementById('intro').offsetHeight-innerHeight));
   const dt=Math.min(50,now-last);last=now;
   if(model)progress+=(raw-progress)*(1-Math.exp(-dt/65));
   const seconds=now/1000;
   const phase=seconds*.12+progress*1.7;
   // Preserve the ominous opening, then build illumination toward the reveal.
   const illumination=smooth(.08,.84,progress);
   renderer.toneMappingExposure=.82+illumination*.58;
   edge.intensity=2.6+illumination*1.6;
   pink.intensity=.8+illumination*1.1;
   scene.environmentIntensity=1+illumination*.45;
   key.position.set(Math.sin(phase)*2,1.5,2+Math.cos(phase));
   pink.position.set(Math.cos(phase*.8)*2,-.6+Math.sin(phase)*.5,1.4);
   edge.position.set(1.5*Math.cos(phase),.5,-1.7);
   blue.intensity=(.55+.2*Math.sin(phase*1.3))*(1+illumination*1.8);
   key.intensity=(.85+.25*Math.sin(seconds*.45))*(1+illumination*2);
   scene.environmentRotation.set(.08*Math.sin(phase*.7),phase*.28,.04*Math.cos(phase));
   aura.style.transform=`translate(${Math.sin(phase)*4}%,${Math.cos(phase*.7)*3}%) rotate(${Math.sin(phase*.4)*12}deg)`;
   aura.style.opacity=String((.55+.45*illumination)*(1-smooth(.86,.95,progress)));
   const turn=smooth(.08,.58,progress),approach=smooth(.48,.91,progress);
   const strapOpacity=1-smooth(.38,.60,progress);
   for(const strap of straps){
    strap.material.opacity=strapOpacity;
    strap.visible=strapOpacity>.001;
    strap.castShadow=strapOpacity>.5;
   }
   pivot.rotation.set(.10*(1-turn),-.42+(Math.PI+.42)*turn,.08*(1-turn));
   // Once the inside faces the viewer, approach between the optical lenses.
   const startDistance=Math.max(.36,.09+.115/(Math.tan(THREE.MathUtils.degToRad(20))*camera.aspect));
   camera.position.z=THREE.MathUtils.lerp(startDistance,.074,approach);
   camera.position.y=THREE.MathUtils.lerp(.025,0,approach);
   camera.lookAt(0,0,0);
   centerSilhouette(1-smooth(.48,.72,progress));
   const bloom=smooth(.83,.93,progress);
   const reveal=smooth(.94,1,progress);
   flash.style.opacity=String(bloom*(1-reveal));
   site.style.visibility=progress>.92?'visible':'hidden';
   renderer.domElement.style.opacity=String(1-smooth(.91,.95,progress));
   stage.style.background=progress>.93?'transparent':'#000';
   electricity.update(progress,now,dt);
   renderer.render(scene,camera);
   if(progress>.997 && raw>.998){finish();return;}
   raf=requestAnimationFrame(render);
  }
  raf=requestAnimationFrame(render);
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  addEventListener('pagehide',()=>{finished=true;cancelAnimationFrame(raf);electricity?.dispose();renderer?.dispose();},{once:true});
 }
} catch(error){console.error('Headset intro:',error);finish();}
