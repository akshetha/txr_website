const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
let scheduled = 0;
const element = () => ({ addEventListener() {}, classList: { add() {}, remove() {} }, style: {}, getClientRects() { return []; } });
const context = vm.createContext({
  console, Math, URLSearchParams, location: { search: '' }, performance: { now: () => 1000 },
  innerWidth: 1200, innerHeight: 800, assert,
  requestAnimationFrame: () => ++scheduled, cancelAnimationFrame() {},
  createImageBitmap: async () => ({ close() {} }),
  document: { hidden: false, documentElement: { scrollHeight: 2400 },
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    elementFromPoint() { return null; }, addEventListener() {} },
  window: { scrollY: 100, addEventListener() {}, scrollBy({ top }) { this.scrollY += top; } },
});
const source = fs.readFileSync(new URL('../hand-control.js', `file://${__filename}`), 'utf8');
(async () => {
  await vm.runInContext(source + `
(async () => {
  const hand = Array.from({length:21}, () => ({x:0.5,y:0.5}));
  hand[5]={x:0.4,y:0.5}; hand[17]={x:0.6,y:0.5};
  hand[8]={x:0.5,y:0.3}; hand[4]={x:0.7,y:0.3};
  active=true;
  for (let t=1000;t<=1400;t+=40) update(hand,t); renderCursor(1400);
  assert.equal(armed,true);
  const held=point;
  gesture={point:{...point},scrolling:true,scrollTarget:500};
  update(null,1440);
  assert.equal(gesture,null, 'Dropout cancels gesture');
  assert.equal(point.y,held.y, 'Brief dropout holds cursor');
  const scrollBefore=window.scrollY;renderCursor(1450);
  assert.equal(window.scrollY,scrollBefore, 'Dropout stops scrolling');
  update(hand,1480);
  assert.equal(armed,false, 'Recovery must rearm');
  assert.equal(trackingPaused,false);
  const beforeJump={...point};
  const jump=hand.map(p=>({...p})); jump[5].x=0.05;jump[17].x=0.15;
  update(jump,1520);
  assert.equal(point.x,beforeJump.x, 'Isolated jump ignored');
  update(hand,1560);
  assert.equal(point.x,beforeJump.x, 'Return from outlier does not jump');
  update(jump,1600);update(jump,1640);
  assert.ok(point.x>beforeJump.x, 'Consistent movement accepted');
  update(null,1900);update(null,2360);
  assert.equal(point,null, 'Long dropout clears cursor');
  // Releasing a scroll must keep the cursor where it was held.
  lastSeen=2000;lastUpdate=2000;stableSince=1000;trackingPaused=false;
  closed=true;candidate=false;candidateSince=1900;pinchRatio=1;
  point={x:600,y:100};renderedPoint={x:600,y:400};previousRaw=null;
  gesture={point:{x:600,y:400},scrolling:true,moved:true};
  update(hand,2040);
  assert.equal(gesture,null);
  assert.equal(point.y,400, 'Release preserves held cursor');
  const opening=hand.map(p=>({...p})); opening[8].y=0.1;
  update(opening,2080);
  assert.equal(point.y,400, 'Opening index finger does not move cursor');
  for (let t=2120;t<=2240;t+=40) update(opening,t);
  assert.equal(point.y,400, 'Cursor stays held through release settling');
  const shifted=opening.map(p=>({...p}));shifted[5].y+=0.02;shifted[17].y+=0.02;
  update(shifted,2280);
  assert.ok(point.y>400, 'Movement resumes relative to release');
  // A dropout during scrolling must not reveal the hidden target.
  releaseUntil=0;renderedPoint={x:600,y:400};point={x:600,y:50};
  gesture={point:{x:600,y:400},scrolling:true,moved:true};
  update(null,2320);
  assert.equal(point.y,400, 'Dropout freezes visible cursor, not hidden target');
  update(shifted,2360);
  assert.equal(point.y,400, 'Recovery rebases cursor instead of jumping');
  disable.hidden=false;disable.disabled=false;disable.isConnected=true;
  disable.getClientRects=()=>[{}];
  disable.getBoundingClientRect=()=>({left:900,right:1100,top:700,bottom:740});
  disable.closest=()=>({});disable.matches=()=>false;disable.focus=()=>{};
  assert.equal(clickableAt(950,687),disable,'Camera off has forgiving pinch hit area');
  assert.equal(clickableAt(950,670),null,'Hit tolerance stays bounded');
  let stoppedTracks=0;
  stream={getTracks:()=>[{stop(){stoppedTracks++;}}]};
  disable.click=()=>stop();
  lastSeen=2400;lastUpdate=2400;stableSince=1000;trackingPaused=false;
  closed=true;candidate=false;candidateSince=2200;pinchRatio=1;
  previousRaw=null;releaseUntil=0;
  gesture={point:{x:950,y:687},target:disable,moved:false,scrolling:false};
  update(hand,2440);
  assert.equal(active,false,'Pinch release turns camera off');
  assert.equal(stoppedTracks,1,'Camera tracks stopped');
  assert.equal(status.textContent,'Camera off. Mouse and touch work normally.','Shutdown message preserved');
  active=true;
  point={x:600,y:400};previousRaw=null;lastSeen=3000;lastUpdate=3000;
  stableSince=1000;trackingPaused=false;armed=true;missingSince=null;
  update(hand,3400);
  assert.equal(armed,true,'Slow valid inference must not reset gesture readiness');
  mouseGraceUntil=0;mouseWindow=1000;mouseTravel=0;
  handleMouseMovement({isTrusted:true,pointerType:'mouse',movementX:1,movementY:0});
  assert.equal(suspended,false,'Tiny mouse jitter must not pause hand tracking');
  handleMouseMovement({isTrusted:true,pointerType:'mouse',movementX:20,movementY:0});
  assert.equal(suspended,true,'Deliberate mouse movement still takes over');
  suspended=false;
  let sent=0, queued=0;
  video.readyState=2;video.currentTime=1;
  video.requestVideoFrameCallback=()=>++queued;
  worker={postMessage(){sent++;}};busy=false;
  await frame(generation);
  assert.equal(sent,1);
  assert.equal(queued,0, 'Wait for result before requesting another frame');
  await frame(generation);
  assert.equal(sent,1, 'Never queue concurrent inference');
  busy=false;scheduleFrame(generation);
  assert.equal(queued,1, 'Result can request fresh frame immediately');
})()
`, context);
  console.log('Passed: dropout hold/cancellation/recovery, jump rejection, sustained movement, pinch release, scroll dropout recovery, one-frame scheduling.');
})().catch(error => { console.error(error); process.exitCode = 1; });
