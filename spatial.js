import * as THREE from 'three';
import {createSmoothScroll} from './smooth-scroll.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
const loading=document.getElementById('loading');
let introPreviewPaused=new URLSearchParams(location.search).has('introPreview');
if(introPreviewPaused){
 const updatePreview=()=>{introPreviewPaused=parent.document.querySelector('#site iframe')?.dataset.active!=='true';};
 updatePreview();
 addEventListener('message',event=>{
  if(event.origin===location.origin && event.source===parent && event.data?.type==='intro-preview')introPreviewPaused=!event.data.active;
 });
}
try{
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const smoothScroll=createSmoothScroll(()=>['main','officers'].includes(document.body.dataset.view));
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#030308');scene.fog=new THREE.FogExp2('#030308',.035);
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,100);camera.position.set(0,2,11);
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room).texture;room.dispose();pmrem.dispose();
const ambient=new THREE.HemisphereLight(0x8f89d5,0x080610,1);scene.add(ambient);const key=new THREE.DirectionalLight(0xbca3ff,4);key.position.set(3,5,4);scene.add(key);const pink=new THREE.PointLight(0xb02bff,35,20);pink.position.set(-3,2,2);scene.add(pink);
const floor=new THREE.GridHelper(100,100,0x302044,0x151022);floor.position.y=-2;scene.add(floor);
const stations=[];const selectable=[];
const glass=new THREE.MeshPhysicalMaterial({color:0x5a3a8a,metalness:.65,roughness:.18,clearcoat:1,transparent:true,opacity:.8});
const glow=new THREE.MeshBasicMaterial({color:0xa87bff});
function textTexture(title,sub){const c=document.createElement('canvas');c.width=768;c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#100c1e';ctx.fillRect(0,0,768,512);ctx.strokeStyle='#64507d';ctx.strokeRect(20,20,728,472);ctx.fillStyle='#b7a1de';ctx.font='20px monospace';ctx.fillText(sub,45,65);ctx.fillStyle='#eee8ff';ctx.font='44px sans-serif';ctx.fillText(title,45,455);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;}
const croppedPosters=new Map();
function trimPosterMargins(image){
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
 const {data}=context.getImageData(0,0,canvas.width,canvas.height),w=canvas.width,h=canvas.height;
 const dark=(x,y)=>{const i=(y*w+x)*4;return data[i+3]<8 || Math.max(data[i],data[i+1],data[i+2])<=8;};
 const darkColumn=x=>{for(let y=0;y<h;y+=Math.max(1,Math.floor(h/200)))if(!dark(x,y))return false;return true;};
 const darkRow=y=>{for(let x=0;x<w;x+=Math.max(1,Math.floor(w/200)))if(!dark(x,y))return false;return true;};
 let left=0,right=w-1,top=0,bottom=h-1;
 while(left<w*.2&&darkColumn(left))left++;
 while(right>w*.8&&darkColumn(right))right--;
 while(top<h*.15&&darkRow(top))top++;
 while(bottom>h*.85&&darkRow(bottom))bottom--;
 const cropped=document.createElement('canvas');cropped.width=right-left+1;cropped.height=bottom-top+1;
 cropped.getContext('2d').drawImage(canvas,left,top,cropped.width,cropped.height,0,0,cropped.width,cropped.height);
 return cropped;
}
function panel(group,x,y,z,title,sub,image,lit=false){const mat=lit?new THREE.MeshStandardMaterial({map:textTexture(title,sub),side:THREE.DoubleSide,roughness:.65,metalness:.05,emissive:0xffffff,emissiveIntensity:.12}):new THREE.MeshBasicMaterial({map:textTexture(title,sub),side:THREE.DoubleSide});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2.1,1.4),mat);mesh.position.set(x,y,z);group.add(mesh);if(image)new THREE.TextureLoader().load(image,tex=>{if(lit){
 const cropped=trimPosterMargins(tex.image);tex.dispose();tex=new THREE.CanvasTexture(cropped);
 croppedPosters.set(image,cropped.toDataURL('image/png'));
 mesh.geometry.dispose();mesh.geometry=new THREE.PlaneGeometry(1.7*cropped.width/cropped.height,1.7);
 }
 tex.colorSpace=THREE.SRGBColorSpace;mat.map=tex;if(lit)mat.emissiveMap=tex;mat.needsUpdate=true;});return mesh;}
for(let i=0;i<4;i++){const group=new THREE.Group();group.position.x=i*18;scene.add(group);stations.push(group);const ring=new THREE.Mesh(new THREE.TorusGeometry(2.3,.018,8,100),glow);ring.rotation.x=.1;ring.position.set(2,0,-1);group.add(ring);}
// A small school of glass jellyfish replaces the Main sculpture and floating cards.
stations[0].children[0].visible=false;
const aquarium=new THREE.Group();stations[0].add(aquarium);
let mainJelly=null;
const smallJellyPivot=new THREE.Group();stations[0].add(smallJellyPivot);
function loadLiveJellyfish(){new GLTFLoader().load('./assets/models/glass-jellyfish.glb',gltf=>{
 mainJelly=gltf.scene;
 mainJelly.traverse(object=>{
  if(!object.isMesh)return;
  const material=object.material.clone();
  material.color.set(0x9162c7);material.roughness=.1;
  material.transmission=.86;material.envMapIntensity=.75;material.clearcoat=1;
  material.emissive.set(0x542383);material.emissiveIntensity=.05;
  if(material.attenuationColor)material.attenuationColor.set(0x9665d2);
  object.material=material;
 });
 // Center the complete bell-and-tentacle silhouette around its rotation pivot.
 const center=new THREE.Box3().setFromObject(mainJelly).getCenter(new THREE.Vector3());
 mainJelly.position.sub(center);aquarium.add(mainJelly);
 smallJellyPivot.add(mainJelly.clone(true));
},undefined,error=>console.warn('Could not load Main jellyfish',error));}
// Main uses a recorded loop; its 3D model is loaded only if video decoding fails.
const mainVideo=document.createElement('video');
mainVideo.id='main-jellyfish-video';mainVideo.muted=true;mainVideo.loop=true;mainVideo.playsInline=true;mainVideo.autoplay=true;mainVideo.preload='auto';
mainVideo.poster='./assets/video/jellyfish-poster.jpg';mainVideo.src='./assets/video/jellyfish-loop.mp4';mainVideo.setAttribute('aria-hidden','true');document.body.prepend(mainVideo);
let jellyVideoFailed=false;
function syncJellyVideo(){
 const active=document.body.dataset.view==='main'&&!document.hidden&&!introPreviewPaused;
 if(active&&!reduced)mainVideo.play().catch(()=>{});else mainVideo.pause();
}
mainVideo.addEventListener('loadeddata',syncJellyVideo);
mainVideo.addEventListener('error',()=>{if(jellyVideoFailed)return;jellyVideoFailed=true;document.body.classList.add('live-jellyfish');mainVideo.remove();loadLiveJellyfish();},{once:true});
addEventListener('visibilitychange',syncJellyVideo);
addEventListener('pointerdown',syncJellyVideo,{once:true});

const officerOrbs=[];
stations[1].children[0].visible=false;
const officerColors=[0x6152a4,0x394d8f,0x824695,0x356c78,0x9a6247,0x536992,0x7d4d80,0x638579];
for(let i=0;i<8;i++){
 const column=i%4,row=Math.floor(i/4);
 const card=document.createElement('article');card.className='officer-card';
 const viewport=document.createElement('div');viewport.className='planet-viewport';viewport.setAttribute('aria-hidden','true');
 const name=document.createElement('h2');name.textContent=`Officer ${String(i+1).padStart(2,'0')}`;
 const role=document.createElement('p');role.textContent='Name / role coming soon';
 card.append(viewport,name,role);document.getElementById('officers-grid').append(card);
 const planetScene=new THREE.Scene();planetScene.environment=scene.environment;
 planetScene.add(new THREE.HemisphereLight(0xc8baff,0x0a0915,1.5));
 const planetKey=new THREE.DirectionalLight(0xb7caff,3);planetKey.position.set(2,3,4);planetScene.add(planetKey);
 const planetRim=new THREE.DirectionalLight(0xc086ff,2);planetRim.position.set(-2,1,-2);planetScene.add(planetRim);
 const planetCamera=new THREE.PerspectiveCamera(35,1,.1,10);planetCamera.position.set(0,0,1.85);
 const orbit=new THREE.Group();planetScene.add(orbit);
 const orb=new THREE.Mesh(new THREE.SphereGeometry(.32,40,28),new THREE.MeshPhysicalMaterial({color:officerColors[i],metalness:.3,roughness:.12,transmission:.65,thickness:.25,ior:1.3,clearcoat:1,iridescence:1,iridescenceIOR:1.3,iridescenceThicknessRange:[100,450],emissive:0x291447,emissiveIntensity:.18}));orbit.add(orb);
 const stars=[];
 for(let k=0;k<36;k++){const t=k*2.39996,y=1-2*(k+.5)/36,r=Math.sqrt(1-y*y)*.27;stars.push(Math.cos(t)*r,y*.27,Math.sin(t)*r);}
 const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
 orbit.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xc7bbff,size:.013,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending})));
 for(let ring=0;ring<2;ring++){
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.43+ring*.07,.003,6,80),new THREE.MeshBasicMaterial({color:ring?0x779cd9:0xb294e6,transparent:true,opacity:ring?.3:.65}));
  halo.rotation.set(.8+ring*.6,.3+i*.4,ring*.7);orbit.add(halo);
 }
 officerOrbs.push({group:orbit,baseY:0,phase:i*2.1,scene:planetScene,camera:planetCamera,viewport});
}

const posterSphere=new THREE.Group();posterSphere.position.set(2,0,0);stations[2].add(posterSphere);
const posterMeshes=[];
for(let i=0;i<10;i++){
 const y=1-2*(i+.5)/10,r=Math.sqrt(1-y*y),theta=i*Math.PI*(3-Math.sqrt(5));
 const mesh=panel(posterSphere,Math.cos(theta)*r*2.35,y*2.35,Math.sin(theta)*r*2.35,'','',`./assets/event${i+1}.png`,true);
 mesh.geometry.dispose();mesh.geometry=new THREE.PlaneGeometry(1.35,1.7);
 mesh.material.transparent=false;mesh.material.opacity=1;mesh.userData.poster=i+1;mesh.userData.home=mesh.position.clone();mesh.userData.pop=0;
 posterMeshes.push(mesh);
}
const sphereWire=new THREE.Mesh(new THREE.SphereGeometry(2.3,20,12),new THREE.MeshBasicMaterial({color:0x7053aa,wireframe:true,transparent:true,opacity:.07,depthWrite:false}));posterSphere.add(sphereWire);
stations[2].children[0].visible=false;
const eventViolet=new THREE.PointLight(0xa46aff,12,14,2);
const eventBlue=new THREE.PointLight(0x6496ff,9,14,2);
const eventPink=new THREE.PointLight(0xe680c8,5,12,2);
stations[2].add(eventViolet,eventBlue,eventPink);
const glowCanvas=document.createElement('canvas');glowCanvas.width=128;glowCanvas.height=128;
const glowContext=glowCanvas.getContext('2d'),gradient=glowContext.createRadialGradient(64,64,0,64,64,64);
gradient.addColorStop(0,'rgba(255,255,255,.45)');gradient.addColorStop(.3,'rgba(255,255,255,.14)');gradient.addColorStop(1,'rgba(255,255,255,0)');
glowContext.fillStyle=gradient;glowContext.fillRect(0,0,128,128);
const glowTexture=new THREE.CanvasTexture(glowCanvas);
const sphereHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:0x8651ed,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false}));
sphereHalo.position.set(2,0,-2.8);sphereHalo.scale.set(8,8,1);stations[2].add(sphereHalo);
let sphereYaw=0,spherePitch=0,drag=null,dragged=false;
let selectedPoster=null,frontPosterIndex=0;
function stepPoster(direction){
 selectedPoster=((selectedPoster??frontPosterIndex)+direction+posterMeshes.length)%posterMeshes.length;
}
function resumeSphereRotation(){
 selectedPoster=null;sphereYaw=posterSphere.rotation.y;spherePitch=posterSphere.rotation.x;
}
document.getElementById('event-back').addEventListener('click',()=>stepPoster(-1));
document.getElementById('event-forward').addEventListener('click',()=>stepPoster(1));
const posterDialog=document.getElementById('poster-dialog'),posterImage=document.getElementById('poster-image');
function openPoster(number){const path=`./assets/event${number}.png`;posterImage.src=croppedPosters.get(path)||path;posterImage.alt=`TritonXR event poster ${number}`;document.getElementById('poster-caption').textContent=`Poster ${number} / 10`;posterDialog.showModal();}
document.getElementById('close-poster').onclick=()=>posterDialog.close();
posterDialog.addEventListener('click',event=>{if(event.target===posterDialog)posterDialog.close();});

// Projects use a DOM carousel so cards remain crisp and keyboard accessible.
stations[3].visible=false;
const projectTrack=document.querySelector('.project-track');
const originals=[...projectTrack.querySelectorAll('.project-slide')];
const projectTotal=originals.length;
for(let copy=0;copy<2;copy++)for(const slide of originals)projectTrack.append(slide.cloneNode(true));
const projectSlides=[...projectTrack.querySelectorAll('.project-slide')];
let projectIndex=projectTotal,projectsReady=false;
function centerProject(index,behavior='instant'){
 const slide=projectSlides[index];
 projectTrack.scrollTo({left:slide.offsetLeft+slide.offsetWidth/2-projectTrack.clientWidth/2,behavior});
}
function initializeProjects(){
 if(!projectsReady){projectsReady=true;projectIndex=projectTotal;}
 centerProject(projectIndex);updateProjectSlide();
}
function updateProjectSlide(){
 const center=projectTrack.scrollLeft+projectTrack.clientWidth/2;
 let nearest=0,distance=Infinity;
 projectSlides.forEach((slide,index)=>{const delta=Math.abs(slide.offsetLeft+slide.offsetWidth/2-center);if(delta<distance){distance=delta;nearest=index;}});
 projectIndex=nearest;
 projectSlides.forEach((slide,index)=>slide.classList.toggle('is-current',index===nearest));
 document.getElementById('project-count').textContent=`${String(nearest%projectTotal+1).padStart(2,'0')} / 03`;
}
function moveProject(direction){
 normalizeProjectLoop();
 projectIndex+=direction;
 centerProject(projectIndex,reduced?'instant':'smooth');
}
// Clicking a faded neighboring card brings that exact loop copy into focus.
projectSlides.forEach((slide,index)=>{
 slide.addEventListener('click',()=>{
  if(slide.classList.contains('is-current'))return;
  projectIndex=index;
  centerProject(index,reduced?'instant':'smooth');
 });
});
projectSlides[projectTotal].classList.add('is-current');
function normalizeProjectLoop(){
 if(!projectTrack.clientWidth)return;
 updateProjectSlide();
 if(projectIndex<projectTotal || projectIndex>=projectTotal*2){
  const equivalent=projectTotal+projectIndex%projectTotal;
  // Preserve the exact visual offset while moving to an identical middle copy.
  const shift=projectSlides[equivalent].offsetLeft-projectSlides[projectIndex].offsetLeft;
  projectTrack.style.scrollSnapType='none';
  projectTrack.scrollTo({left:projectTrack.scrollLeft+shift,behavior:'instant'});
  projectIndex=equivalent;updateProjectSlide();
  requestAnimationFrame(()=>{projectTrack.style.scrollSnapType='';});
 }
}
let projectSettleTimer;
projectTrack.addEventListener('scrollend',normalizeProjectLoop);
addEventListener('resize',()=>{if(document.body.dataset.view==='projects')initializeProjects();});
projectTrack.addEventListener('scroll',()=>{
 updateProjectSlide();
 clearTimeout(projectSettleTimer);
 projectSettleTimer=setTimeout(normalizeProjectLoop,140);
},{passive:true});
document.getElementById('project-back').onclick=()=>moveProject(-1);
document.getElementById('project-next').onclick=()=>moveProject(1);
projectTrack.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();moveProject(event.key==='ArrowRight'?1:-1);}});
projectTrack.addEventListener('wheel',event=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX)){event.preventDefault();projectTrack.scrollLeft+=event.deltaY;}},{passive:false});

const data={main:['01 / UC San Diego','Reality,<br>reassembled.','A collective of students exploring what happens beyond the screen.',['Build','Play','Experiment']],officers:['02 / The people','Meet the <br>collective.','Different disciplines. Shared curiosity. A space for the people making TritonXR happen.',['Officer profiles coming soon']],events:['03 / In the room','Step out.<br>Plug in.','Hackathons, workshops, and game nights. A few windows into what we do together.',['HackXR','Game nights','Workshops']],projects:['04 / Project collection','Ideas with<br>dimensions.','A gallery for student-built worlds, prototypes, and experiments.',['Placeholder collection · demos coming soon']]};
const destinations=['main','officers','events','projects'];
let initialized=false,pageAnimations=[];
let view='main',targetX=0,currentX=0;const pointer=new THREE.Vector2(),ray=new THREE.Raycaster();
function navigate(name,{historyMode='push'}={}){if(!data[name])return;const previous=view;const changed=previous!==name;const direction=destinations.indexOf(name)>=destinations.indexOf(previous)?1:-1;view=name;document.body.dataset.view=name;syncJellyVideo();if(name==='projects')initializeProjects();smoothScroll.reset();drag=null;targetX=['main','officers','events','projects'].indexOf(name)*18;if(reduced)currentX=targetX;const [label,title,description,tags]=data[name];document.getElementById('label').textContent=label;document.getElementById('title').innerHTML=title;document.getElementById('description').textContent=description;document.getElementById('details').replaceChildren(...tags.map(t=>{const s=document.createElement('span');s.textContent=t;return s;}));document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-current',button.dataset.view===name?'page':'false'));if(historyMode==='replace')history.replaceState(null,'',`#${name}`);
else if(historyMode==='push'&&changed)history.pushState(null,'',`#${name}`);
pageAnimations.forEach(animation=>animation.cancel());pageAnimations=[];
if(initialized&&changed&&!reduced){
 const selectors=name==='main'?['#home']:name==='officers'?['#copy','#officers-grid']:name==='projects'?['#project-carousel']:['#copy','#details'];
 for(const selector of selectors){
  const element=document.querySelector(selector);
  if(!element||getComputedStyle(element).display==='none')continue;
  // Individual translate preserves existing layout transforms (e.g. centered controls).
  pageAnimations.push(element.animate([{translate:`${direction*65}vw 0`,opacity:0},{translate:'0 0',opacity:1}],{duration:720,easing:'cubic-bezier(.22,.8,.2,1)'}));
 }
}
initialized=true;
}
function restoreDestination(){navigate(data[location.hash.slice(1)]?location.hash.slice(1):'main',{historyMode:'none'});}
addEventListener('popstate',restoreDestination);
addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(next!==view)restoreDestination();});
document.querySelectorAll('#browse-events,.browse-events').forEach(button=>button.addEventListener('click',()=>navigate('events')));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));document.querySelector('header a').addEventListener('click',event=>{event.preventDefault();navigate('main');});
function coords(e){pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);}
renderer.domElement.style.touchAction='none';
renderer.domElement.addEventListener('wheel',event=>{
 if(view!=='events'||posterDialog.open)return;event.preventDefault();
 resumeSphereRotation();
 const unit=event.deltaMode===1?16:event.deltaMode===2?innerHeight:1;
 sphereYaw+=Math.max(-160,Math.min(160,(event.deltaY+event.deltaX)*unit))*.003;
},{passive:false});
renderer.domElement.addEventListener('pointerdown',event=>{
 if(view!=='events'||posterDialog.open)return;
 resumeSphereRotation();
 dragged=false;drag={x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY};
 renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove',event=>{
 coords(event);
 if(drag){
  if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>6)dragged=true;
  sphereYaw+=(event.clientX-drag.x)*.007;
  spherePitch=THREE.MathUtils.clamp(spherePitch+(event.clientY-drag.y)*.005,-.8,.8);
  drag.x=event.clientX;drag.y=event.clientY;
 }
 ray.setFromCamera(pointer,camera);
 const hits=ray.intersectObjects(view==='events'?posterMeshes:selectable);
 renderer.domElement.style.cursor=drag?'grabbing':view==='events'?'grab':hits.length?'pointer':'default';
});
renderer.domElement.addEventListener('pointerup',()=>{drag=null;});
renderer.domElement.addEventListener('pointercancel',()=>{drag=null;dragged=true;});
renderer.domElement.addEventListener('click',event=>{
 coords(event);ray.setFromCamera(pointer,camera);
 if(view==='main'){
  const hit=ray.intersectObjects(selectable)[0];if(hit)navigate(hit.object.userData.view);
 }
});

navigate(data[location.hash.slice(1)]?location.hash.slice(1):'main',{historyMode:'replace'});loading.remove();let last=performance.now(),eventZoom=0;
renderer.setAnimationLoop(now=>{if(introPreviewPaused || document.hidden){mainVideo.pause();last=now;return;}smoothScroll.raf(now);if(view==='main'&&!jellyVideoFailed){if(!reduced&&mainVideo.paused)syncJellyVideo();currentX=targetX;last=now;return;}const dt=Math.min(50,now-last);last=now;currentX+=(targetX-currentX)*(1-Math.exp(-dt/260));const mobile=innerWidth<700;eventZoom+=((view==='events'?1:0)-eventZoom)*(reduced?1:1-Math.exp(-dt/300));camera.position.set(currentX+(mobile?1.9:0)+(!reduced?pointer.x*.14:0),mobile?2.3:1.3,(mobile?12:10)-eventZoom*(mobile?1.7:1.8));camera.lookAt(currentX+(mobile?1.9:1.1),mobile?1.4:0,0);floor.visible=view!=='main'&&view!=='officers';
key.intensity=view==='events'?0:4;
ambient.intensity=view==='events'?.4:1;

if(!reduced)key.position.x=Math.sin(now*.0003)*4;
const swimTime=reduced?0:now*.00012;
aquarium.visible=currentX<17.8;
aquarium.position.set(mobile?3.8:5.2,mobile?1.3:.65,-.7);
aquarium.scale.setScalar(mobile?2:2.35);
aquarium.rotation.set(.12+.08*Math.sin(swimTime*.6),swimTime*.6,-.38+.06*Math.sin(swimTime*.45));
smallJellyPivot.visible=currentX<17.8;
smallJellyPivot.position.set(mobile?-.05:-2.7,mobile?-.9:-1.6,.2);
smallJellyPivot.scale.setScalar(mobile?.7:.95);
smallJellyPivot.rotation.set(-.12,swimTime*.45+.8,.42+.06*Math.sin(swimTime*.5));
posterSphere.scale.setScalar(mobile?.86:1);
for(const orb of officerOrbs){
 const t=reduced?0:now*.0003;
 orb.group.position.y=orb.baseY+Math.sin(t+orb.phase)*.06;
 orb.group.rotation.y=t*.5;
}
const lightTime=reduced?0:now*.00028;
eventViolet.position.set(2+Math.cos(lightTime)*3,1.8+Math.sin(lightTime)*.6,3);
eventBlue.position.set(2-Math.cos(lightTime)*3,-.5,2+Math.sin(lightTime)*1.2);
eventPink.position.set(2,3,-1.5);
sphereHalo.material.opacity=.4+.1*Math.sin(lightTime);
if(view==='events'&&!posterDialog.open){
 if(!reduced&&!drag&&selectedPoster===null)sphereYaw+=dt*.000035;
 const blend=reduced?1:1-Math.exp(-dt/120);
 if(selectedPoster!==null){
  const center=posterSphere.getWorldPosition(new THREE.Vector3());
  const facing=camera.position.clone().sub(center).normalize();
  const home=posterMeshes[selectedPoster].userData.home.clone().normalize();
  const current=home.clone().applyQuaternion(posterSphere.quaternion);
  const correction=new THREE.Quaternion().setFromUnitVectors(current,facing);
  const target=correction.multiply(posterSphere.quaternion.clone());
  posterSphere.quaternion.slerp(target,blend);
 }else{
  posterSphere.rotation.y+=(sphereYaw-posterSphere.rotation.y)*blend;
  posterSphere.rotation.x+=(spherePitch-posterSphere.rotation.x)*blend;
 }
 // Evaluate focus from the unexpanded sphere, avoiding feedback as cards lift.
 for(const poster of posterMeshes)poster.position.copy(poster.userData.home);
 scene.updateMatrixWorld(true);
 const sphereCenter=posterSphere.getWorldPosition(new THREE.Vector3());
 const facing=camera.position.clone().sub(sphereCenter).normalize();
 let frontPoster=null,bestScore=-Infinity;
 for(const poster of posterMeshes){
  const direction=poster.getWorldPosition(new THREE.Vector3()).sub(sphereCenter).normalize();
  const score=direction.dot(facing);
  if(score>bestScore){bestScore=score;frontPoster=poster;}
 }
 frontPosterIndex=posterMeshes.indexOf(frontPoster);
 const localFacing=facing.clone().transformDirection(posterSphere.matrixWorld.clone().invert());
 for(const poster of posterMeshes){
  const focused=poster===frontPoster;
  const popTarget=focused?1:0;
  poster.userData.pop+=(popTarget-poster.userData.pop)*(reduced?1:1-Math.exp(-dt/180));
  const pop=poster.userData.pop;
  poster.position.addScaledVector(localFacing,pop*.6);
  poster.scale.setScalar(1+pop*.28);
  poster.lookAt(camera.position);
  const world=poster.getWorldPosition(new THREE.Vector3());
  const depth=THREE.MathUtils.clamp((world.z+2.35)/4.7,0,1);
  poster.material.opacity=1;
  poster.material.emissiveIntensity=.035+.045*pop;
  poster.material.color.setScalar(.72);
  poster.material.envMapIntensity=0;
  poster.material.metalness=0;
  poster.material.roughness=1;
 }

}
renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.autoClear=true;
renderer.render(scene,camera);
if(view==='officers'){
 renderer.autoClear=false;renderer.clearDepth();renderer.setScissorTest(true);
 for(const planet of officerOrbs){
  const rect=planet.viewport.getBoundingClientRect();
  if(rect.bottom<0||rect.top>innerHeight)continue;
  planet.camera.aspect=rect.width/rect.height;planet.camera.updateProjectionMatrix();
  renderer.setViewport(rect.left,innerHeight-rect.bottom,rect.width,rect.height);
  renderer.setScissor(Math.max(0,rect.left),Math.max(0,innerHeight-rect.bottom),Math.min(rect.right,innerWidth)-Math.max(0,rect.left),Math.min(rect.bottom,innerHeight)-Math.max(0,rect.top));
  renderer.render(planet.scene,planet.camera);
 }
 renderer.setScissorTest(false);renderer.autoClear=true;
}
});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});addEventListener('pagehide',()=>{smoothScroll.destroy();renderer.setAnimationLoop(null);renderer.dispose();});
}catch(error){console.error(error);loading.textContent='The 3D preview could not load. Try refreshing.';}
