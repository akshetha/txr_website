const $ = (id) => document.getElementById(id);
const enable = $('enable'), disable = $('disable'), status = $('status');
const video = $('preview'), cursor = $('cursor'), box = $('box');
let count = 0;
box.addEventListener('click', () => {
  box.textContent = `Clicked! · ${++count}`;
  box.classList.add('clicked');
});
let stream, worker, active = false, busy = false, generation = 0, timer;
let point, gesture, closed = false, candidate = false, candidateSince = 0;
let stableSince = 0, lastSeen = 0, lastUpdate = 0, lastVideoTime = -1, armed = false;
let suspended = false;
let filteredAnchor = null, pinchRatio = null;
let renderedPoint = null, renderTime = 0, animation;
// Render between camera results rather than stepping at the inference frame rate.
function renderCursor(time) {
  const target = gesture ? gesture.point : point;
  if (target && active && !suspended && !document.hidden) {
    if (!renderedPoint) renderedPoint = { ...target };
    const dt = Math.min(50, time - renderTime || 16.7);
    const alpha = 1 - Math.exp(-dt / 32);
    renderedPoint.x += (target.x - renderedPoint.x) * alpha;
    renderedPoint.y += (target.y - renderedPoint.y) * alpha;
    if (gesture?.scrolling && closed && candidate && time - lastSeen < 180) {
      const remaining = gesture.scrollTarget - window.scrollY;
      window.scrollBy({ top: remaining * (1 - Math.exp(-dt / 55)), behavior: 'instant' });
    }
    cursor.style.transform = `translate3d(${renderedPoint.x}px, ${renderedPoint.y}px, 0)`;
    box.classList.toggle('target', !gesture && document.elementFromPoint(renderedPoint.x, renderedPoint.y) === box);
  } else renderedPoint = null;
  renderTime = time;
  animation = requestAnimationFrame(renderCursor);
}
animation = requestAnimationFrame(renderCursor);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v) => Math.max(0, Math.min(1, v));
function cancel() {
  filteredAnchor = null; pinchRatio = null;
  gesture = null; closed = false; candidate = false; candidateSince = 0; armed = false;
  cursor.classList.remove('pinched', 'scrolling'); box.classList.remove('target');
}
function stop(message = 'Camera off. Mouse and touch work normally.') {
  generation++; active = false; clearTimeout(timer); worker?.terminate(); worker = null;
  stream?.getTracks().forEach((track) => track.stop()); stream = null;
  video.srcObject = null; video.hidden = true; cursor.style.display = 'none';
  enable.hidden = false; enable.disabled = false; enable.textContent = 'Enable hand control'; disable.hidden = true;
  cancel(); point = null; renderedPoint = null; stableSince = 0; lastSeen = 0; lastUpdate = 0; lastVideoTime = -1;
  busy = false; suspended = false; status.textContent = message;
}
async function frame(session) {
  if (!active || session !== generation) return;
  if (!document.hidden && !busy && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime; busy = true;
    try {
      const bitmap = await createImageBitmap(video);
      if (session !== generation) { bitmap.close(); return; }
      worker.postMessage({ type: 'frame', frame: bitmap, time: performance.now() }, [bitmap]);
    } catch { if (session === generation) stop('Camera frame unavailable. Try enabling again.'); return; }
  }
  timer = setTimeout(() => frame(session), 40);
}
function update(landmarks, time) {
  if (!landmarks || suspended) {
    cancel(); point = null; renderedPoint = null; stableSince = 0; cursor.style.display = 'none';
    if (!suspended) status.textContent = 'Hold one open hand in view.';
    return;
  }
  if (time - lastSeen > 250) { cancel(); point = null; renderedPoint = null; stableSince = time; }
  lastSeen = time;
  const tip = landmarks[8];
  const palm = { x: (landmarks[5].x + landmarks[17].x) / 2, y: (landmarks[5].y + landmarks[17].y) / 2 };
  const rawAnchor = { x: (1 - palm.x) * innerWidth / 0.7, y: palm.y * innerHeight / 0.7 };
  const raw = { x: clamp((1 - tip.x - 0.15) / 0.7) * innerWidth, y: clamp((tip.y - 0.15) / 0.7) * innerHeight };
  const dt = Math.min(100, time - lastUpdate || 40); lastUpdate = time;
  if (!filteredAnchor) filteredAnchor = { ...rawAnchor };
  const anchorAlpha = 1 - Math.exp(-dt / 85);
  // Clamp implausible one-frame jumps before smoothing the palm position.
  const maxStep = 1.5 * dt;
  filteredAnchor.x += Math.max(-maxStep, Math.min(maxStep, rawAnchor.x - filteredAnchor.x)) * anchorAlpha;
  filteredAnchor.y += Math.max(-maxStep, Math.min(maxStep, rawAnchor.y - filteredAnchor.y)) * anchorAlpha;
  const anchor = filteredAnchor;
  if (!point) point = raw;
  const travel = Math.hypot(raw.x - point.x, raw.y - point.y);
  // Suppress fingertip tremor; smoothly reduce filtering for intentional travel.
  const deadZone = 3;
  if (travel > deadZone) {
    const speed = travel / dt;
    const responsiveness = Math.min(1, speed / 1.2);
    const smoothingMs = 130 - 85 * responsiveness;
    const alpha = (1 - Math.exp(-dt / smoothingMs)) * (1 - deadZone / travel);
    point = { x: point.x + (raw.x - point.x) * alpha, y: point.y + (raw.y - point.y) * alpha };
  }
  const rawRatio = distance(landmarks[4], tip) / Math.max(0.01, distance(landmarks[5], landmarks[17]));
  pinchRatio = pinchRatio === null ? rawRatio : pinchRatio + (rawRatio - pinchRatio) * (1 - Math.exp(-dt / 45));
  const ratio = pinchRatio;
  if (time - stableSince < 350) return;
  cursor.style.display = 'block';
  if (!closed && ratio > 0.55) armed = true;
  const next = closed ? ratio < 0.55 : ratio < 0.32;
  if (next !== candidate) { candidate = next; candidateSince = time; }
  if (next !== closed && time - candidateSince >= (next ? 65 : 100)) {
    closed = next;
    if (closed && armed) {
      const selectedPoint = renderedPoint || point;
      gesture = { start: { ...anchor }, lastY: anchor.y, point: { ...selectedPoint }, target: document.elementFromPoint(selectedPoint.x, selectedPoint.y), scrolling: false, scrollTarget: window.scrollY, intentSince: null, moved: false };
      cursor.classList.add('pinched');
    } else if (!closed) {
      if (gesture && !gesture.moved && !gesture.scrolling && gesture.target === box && document.elementFromPoint(gesture.point.x, gesture.point.y) === box) box.click();
      gesture = null; cursor.classList.remove('pinched', 'scrolling');
    }
  }
  if (gesture && candidate) {
    const dx = anchor.x - gesture.start.x;
    const dy = anchor.y - gesture.start.y;
    if (Math.hypot(dx, dy) > 22) gesture.moved = true;
    if (!gesture.scrolling) {
      const verticalIntent = Math.abs(dy) > 26 && Math.abs(dy) > Math.abs(dx) * 1.2;
      if (!verticalIntent) gesture.intentSince = null;
      else if (gesture.intentSince === null) gesture.intentSince = time;
      else if (time - gesture.intentSince >= 80) {
        gesture.scrolling = true;
        gesture.lastY = anchor.y;
        gesture.scrollTarget = window.scrollY;
        cursor.classList.add('scrolling');
      }
    } else {
      // Accumulate meaningful motion; ignore tremor without losing slow travel.
      const delta = gesture.lastY - anchor.y;
      if (Math.abs(delta) > 3) {
        const movement = delta - Math.sign(delta) * 3;
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
        gesture.scrollTarget = Math.max(0, Math.min(maxScroll, gesture.scrollTarget + movement * 1.35));
        gesture.lastY = anchor.y + Math.sign(delta) * 3;
      }
    }
  }
  status.textContent = gesture?.scrolling ? 'Scrolling · release to stop' : closed ? 'Pinched · release to click, move to scroll' : armed ? 'Hand ready' : 'Open your hand to begin';
}
enable.addEventListener('click', async () => {
  if (active && suspended) { suspended = false; cancel(); stableSince = performance.now(); enable.hidden = true; status.textContent = 'Hold one open hand in view.'; return; }
  const session = ++generation;
  enable.disabled = true; disable.hidden = false; status.textContent = 'Allow camera access to try hand control…';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Use HTTPS or localhost to access the camera.');
    const acquired = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: 'user' }, audio: false });
    if (session !== generation) { acquired.getTracks().forEach((track) => track.stop()); return; }
    stream = acquired; video.srcObject = stream; await video.play();
    if (session !== generation) return;
    video.hidden = false; status.textContent = 'Loading hand tracking…';
    worker = new Worker('./hand-worker.js');
    worker.onerror = (event) => {
      console.error('Hand tracking worker:', event.message);
      if (session === generation) stop(`Hand tracking could not load: ${event.message || 'check your connection and retry'}`);
    };
    worker.onmessage = ({ data }) => {
      if (session !== generation) return;
      if (data.type === 'ready') {
        active = true; enable.hidden = true; enable.disabled = false;
        status.textContent = 'Hold one open hand in view.'; frame(session);
      } else if (data.type === 'result') { busy = false; update(data.landmarks, data.time); }
      else if (data.type === 'error') {
        console.error('Hand tracking:', data.message);
        stop(`Hand tracking failed: ${data.message}`);
      }
    };
    worker.postMessage({ type: 'init' });
  } catch (error) {
    if (session === generation) stop(error.name === 'NotAllowedError' ? 'Camera permission denied. You can still use your mouse.' : error.name === 'NotFoundError' ? 'No camera found. You can still use your mouse.' : error.message);
  }
});
disable.addEventListener('click', () => stop());
function takeover() {
  if (!active || suspended) return;
  suspended = true; cancel(); cursor.style.display = 'none'; enable.hidden = false; enable.textContent = 'Resume hand control';
  status.textContent = 'Mouse/touch control · resume when ready';
}
window.addEventListener('pointermove', (event) => { if (event.isTrusted && (event.movementX || event.movementY)) takeover(); });
window.addEventListener('pointerdown', (event) => { if (event.isTrusted && !event.target.closest('#controls')) takeover(); });
document.addEventListener('visibilitychange', () => { cancel(); stableSince = 0; cursor.style.display = 'none'; });
window.addEventListener('pagehide', () => { stop(); cancelAnimationFrame(animation); });
window.addEventListener('pageshow', (event) => { if (event.persisted) animation = requestAnimationFrame(renderCursor); });
