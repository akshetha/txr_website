import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(1);renderer.setSize(1920,1080);renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#030308');scene.fog=new THREE.FogExp2('#030308',.035);
const camera=new THREE.PerspectiveCamera(42,1920/1080,.1,100);camera.position.set(0,1.3,10);camera.lookAt(1.1,0,0);
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room).texture;room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0x8f89d5,0x080610,1));
const key=new THREE.DirectionalLight(0xbca3ff,4);key.position.set(0,5,4);scene.add(key);
const pink=new THREE.PointLight(0xb02bff,35,20);pink.position.set(-3,2,2);scene.add(pink);
const large=new THREE.Group(),small=new THREE.Group();large.position.set(5.2,.65,-.7);large.scale.setScalar(2.35);small.position.set(-2.7,-1.6,.2);small.scale.setScalar(.95);scene.add(large,small);
const status=document.getElementById('status');
new GLTFLoader().load('./assets/models/glass-jellyfish.glb',gltf=>{
 const model=gltf.scene;
 model.traverse(object=>{if(!object.isMesh)return;const material=object.material.clone();material.color.set(0x9162c7);material.roughness=.1;material.transmission=.86;material.envMapIntensity=.75;material.clearcoat=1;material.emissive.set(0x542383);material.emissiveIntensity=.05;material.attenuationColor?.set(0x9665d2);object.material=material;});
 model.position.sub(new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3()));large.add(model);small.add(model.clone(true));
 const stream=renderer.domElement.captureStream(30),chunks=[];
 const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:12000000});
 recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
 recorder.onstop=async()=>{const response=await fetch('/capture',{method:'POST',body:new Blob(chunks,{type:'video/webm'})});status.textContent=response.ok?'Jellyfish video saved':'Save failed';stream.getTracks().forEach(track=>track.stop());};
 let start=null;
 renderer.setAnimationLoop(now=>{
  if(start===null){start=now;recorder.start();status.textContent='Recording jellyfish loop…';}
  const t=Math.min(1,(now-start)/24000),phase=t*Math.PI*2;
  key.position.x=Math.sin(phase)*4;
  large.rotation.set(.12+.08*Math.sin(phase),phase,-.38+.06*Math.sin(phase));
  small.rotation.set(-.12,phase+.8,.42+.06*Math.sin(phase));
  renderer.render(scene,camera);
  if(t===1){renderer.setAnimationLoop(null);recorder.stop();}
 });
},undefined,error=>{status.textContent='Capture failed';console.error(error);});
