import {createSmoothScroll} from './smooth-scroll.js?v=2';
const stage=document.getElementById('stage'),site=document.getElementById('site');
const loading=document.getElementById('loading'),flash=document.getElementById('flash');
const welcome=document.getElementById('welcome'),text=document.getElementById('welcome-text'),caret=document.getElementById('welcome-caret');
const video=document.createElement('video');
video.muted=true;video.playsInline=true;video.preload='auto';video.disablePictureInPicture=true;
video.setAttribute('aria-hidden','true');video.id='headset-video';
video.src='./assets/video/headset-intro.mp4';stage.prepend(video);
const aura=document.createElement('div');aura.id='aura';aura.style.zIndex='1';aura.style.mixBlendMode='screen';stage.append(aura);
const smoothScroll=createSmoothScroll(()=>!automatic);
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
let ready=false,automatic=false,requested=false,finished=false,raf,failed=false;
function finish(){if(finished)return;finished=true;cancelAnimationFrame(raf);video.pause();smoothScroll.destroy();window.skipIntro();}
function startPlayback(){
 if(!ready||automatic||finished)return;
 automatic=true;
 const remaining=Math.max(.1,video.duration-video.currentTime);
 video.playbackRate=Math.max(1,Math.min(8,remaining/1.9));
 const play=()=>video.play().catch(()=>{automatic=false;requested=false;});
 if(video.seeking)video.addEventListener('seeked',play,{once:true});else play();
}
addEventListener('click',()=>{requested=true;startPlayback();});
video.addEventListener('loadeddata',()=>{ready=true;loading.remove();if(requested)startPlayback();},{once:true});
video.addEventListener('ended',finish);
// Keep the existing live version as a fallback for browsers unable to decode the video.
video.addEventListener('error',()=>{
 if(failed||finished)return;failed=true;cancelAnimationFrame(raf);smoothScroll.destroy();video.remove();
 import('./headset-intro.js?v=24');
},{once:true});
function render(now){
 if(finished||failed)return;
 smoothScroll.raf(now);
 const scrollProgress=clamp(scrollY/(document.getElementById('intro').offsetHeight-innerHeight));
 const progress=automatic&&ready?clamp(video.currentTime/video.duration):scrollProgress;
 if(ready&&!automatic&&!video.seeking){
  const target=Math.min(video.duration-.025,progress*video.duration);
  if(Math.abs(video.currentTime-target)>.025)video.currentTime=target;
 }
 let copy='',opacity=0;
 if(progress>=.035&&progress<.13){const g=(progress-.035)/.095;copy='W';opacity=Math.max(0,Math.sin(g*Math.PI*7))*(.4+.6*g);}
 else if(progress>=.13){copy='Welcome'.slice(0,Math.min(7,1+Math.floor(clamp((progress-.13)/.39)*7)));opacity=1-smooth(.70,.82,progress);}
 if(text.textContent!==copy)text.textContent=copy;
 caret.hidden=progress<.13;welcome.style.opacity=String(opacity);
 const preview=site.querySelector('iframe');
 if(progress>.72&&!preview.hasAttribute('src'))preview.src=preview.dataset.src;
 const active=progress>.90;
 if(preview.dataset.active!==String(active)){preview.dataset.active=String(active);preview.contentWindow?.postMessage({type:'intro-preview',active},location.origin);}
 const illumination=smooth(.08,.84,progress),phase=now*.00012+progress*1.7;
 aura.style.transform=`translate(${Math.sin(phase)*4}%,${Math.cos(phase*.7)*3}%) rotate(${Math.sin(phase*.4)*12}deg)`;
 aura.style.opacity=String((.55+.45*illumination)*(1-smooth(.86,.95,progress)));
 flash.style.opacity=String(smooth(.83,.93,progress)*(1-smooth(.94,1,progress)));
 site.style.visibility=progress>.92?'visible':'hidden';
 video.style.opacity=String(1-smooth(.91,.95,progress));stage.style.background=progress>.93?'transparent':'#000';
 if(ready&&progress>.997){finish();return;}
 raf=requestAnimationFrame(render);
}
raf=requestAnimationFrame(render);
addEventListener('pagehide',()=>{finished=true;cancelAnimationFrame(raf);video.pause();smoothScroll.destroy();},{once:true});
