const $ = (id) => document.getElementById(id);
const enable = $('enable'), disable = $('disable'), status = $('status');
const video = $('preview'), cursor = $('cursor');
let hoveredTarget = null, pendingSelection = null;
function clickableAt(x, y) {
  const target = document.elementFromPoint(x, y)?.closest('a[href], button, input, select, textarea, [role="button"], [tabindex]');
  if (target && !target.matches(':disabled, [aria-disabled="true"]')) return target;
  // Camera controls need a forgiving hand target, including just outside the panel.
  for (const button of [disable, enable]) {
    if (button.hidden || button.disabled || !button.getClientRects().length) continue;
    const rect = button.getBoundingClientRect();
    if (x >= rect.left - 18 && x <= rect.right + 18 && y >= rect.top - 18 && y <= rect.bottom + 18) return button;
  }
  return null;
}
function setHovered(target) {
  if (hoveredTarget === target) return;
  hoveredTarget?.classList.remove('hand-hover');
  hoveredTarget = target;
  hoveredTarget?.classList.add('hand-hover');
}
let stream, worker, active = false, busy = false, generation = 0, timer;
let pointerOffset = { x: 0, y: 0 };
let rebasePending = false, releaseUntil = 0;
let point, gesture, closed = false, candidate = false, candidateSince = 0;
let stableSince = 0, lastSeen = 0, lastUpdate = 0, lastVideoTime = -1, armed = false;
let suspended = false;
let missingSince = null, mouseGraceUntil = 0, mouseTravel = 0, mouseWindow = 0;
let trackingPaused = true, previousRaw = null, pendingJump = null;
const debugTracking = new URLSearchParams(location.search).has('handDebug');
let inferenceStarted = 0, metricsStarted = 0, metricsFrames = 0, metricsTotal = 0;
let filteredAnchor = null, pinchRatio = null;
let renderedPoint = null, renderTime = 0, animation;
// Render between camera results rather than stepping at the inference frame rate.
function renderCursor(time) {
  const target = gesture ? gesture.point : pendingSelection ? pendingSelection.point : point;
  if (target && active && !suspended && !document.hidden) {
    if (!renderedPoint) renderedPoint = { ...target };
    const dt = Math.min(50, time - renderTime || 16.7);
    const alpha = 1 - Math.exp(-dt / 18);
    renderedPoint.x += (target.x - renderedPoint.x) * alpha;
    renderedPoint.y += (target.y - renderedPoint.y) * alpha;
    if (!trackingPaused && gesture?.scrolling && closed && candidate && time - lastSeen < 180) {
      const remaining = gesture.scrollTarget - window.scrollY;
      window.scrollBy({ top: remaining * (1 - Math.exp(-dt / 55)), behavior: 'instant' });
    }
    cursor.style.transform = `translate3d(${renderedPoint.x}px, ${renderedPoint.y}px, 0)`;
    setHovered(gesture || trackingPaused ? null : clickableAt(renderedPoint.x, renderedPoint.y));
  } else renderedPoint = null;
  renderTime = time;
  animation = requestAnimationFrame(renderCursor);
}
animation = requestAnimationFrame(renderCursor);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v) => Math.max(0, Math.min(1, v));
function cancel(resetFilters = true) {
  if (gesture) {
    // Dropouts/outliers must not expose the cursor target accumulated in a drag.
    point = { ...(renderedPoint || gesture.point) };
    rebasePending = true;
  }
  if (resetFilters) { filteredAnchor = null; pinchRatio = null; previousRaw = null; pendingJump = null; }
  trackingPaused = true; pendingSelection = null;
  gesture = null; closed = false; candidate = false; candidateSince = 0; armed = false;
  cursor.classList.remove('pinched', 'scrolling'); setHovered(null);
}
function stop(message = 'Camera off. Mouse and touch work normally.') {
  generation++; active = false;
  if (video.requestVideoFrameCallback) video.cancelVideoFrameCallback(timer);
  else cancelAnimationFrame(timer); worker?.terminate(); worker = null;
  stream?.getTracks().forEach((track) => track.stop()); stream = null;
  video.srcObject = null; video.hidden = true; cursor.style.display = 'none';
  enable.hidden = false; enable.disabled = false; enable.textContent = 'Enable hand control'; disable.hidden = true;
  cancel(); point = null; renderedPoint = null; stableSince = 0; lastSeen = 0; lastUpdate = 0; lastVideoTime = -1;
  pointerOffset = { x: 0, y: 0 }; rebasePending = false; releaseUntil = 0;
  missingSince = null; mouseTravel = 0;
  busy = false; suspended = false; status.textContent = message;
}
function scheduleFrame(session) {
  if (!active || session !== generation) return;
  const callback = () => frame(session);
  timer = video.requestVideoFrameCallback
    ? video.requestVideoFrameCallback(callback)
    : requestAnimationFrame(callback);
}
async function frame(session) {
  if (!active || session !== generation || busy) return;
  if (document.hidden || suspended || video.readyState < 2 || video.currentTime === lastVideoTime) {
    scheduleFrame(session);
    return;
  }
  lastVideoTime = video.currentTime; busy = true;
  try {
    const bitmap = await createImageBitmap(video);
    if (session !== generation) { bitmap.close(); return; }
    inferenceStarted = performance.now();
    worker.postMessage({ type: 'frame', frame: bitmap, time: inferenceStarted }, [bitmap]);
    // The result schedules the next frame: no inference queue or fixed delay.
  } catch {
    if (session === generation) stop('Camera frame unavailable. Try enabling again.');
  }
}
function recordTiming() {
  if (!debugTracking) return;
  const now = performance.now();
  if (!metricsStarted) metricsStarted = now;
  metricsFrames++; metricsTotal += now - inferenceStarted;
  if (now - metricsStarted >= 2000) {
    console.debug(`Hand tracking: ${(metricsFrames * 1000 / (now - metricsStarted)).toFixed(1)} FPS, ${(metricsTotal / metricsFrames).toFixed(1)} ms inference`);
    metricsStarted = now; metricsFrames = 0; metricsTotal = 0;
  }
}
function update(landmarks, time) {
  if (suspended) return;
  if (!landmarks) {
    // Cancel actions immediately, but hold position across a short dropout.
    cancel(false);
    if (missingSince === null) missingSince = time;
    if (time - missingSince > 450) {
      cancel(); point = null; renderedPoint = null; stableSince = 0;
      cursor.style.display = 'none';
    }
    status.textContent = 'Hold one open hand in view.';
    return;
  }
  const recovering = trackingPaused;
  missingSince = null;
  if (!point) {
    cancel(); point = null; renderedPoint = null; stableSince = time;
  } else if (recovering) {
    // Preserve the cursor/filter position and require an open hand to rearm.
    stableSince = time - 200;
  }
  trackingPaused = false;
  const tip = landmarks[8];
  const palm = { x: (landmarks[5].x + landmarks[17].x) / 2, y: (landmarks[5].y + landmarks[17].y) / 2 };
  const rawAnchor = { x: (1 - palm.x) * innerWidth / 0.7, y: palm.y * innerHeight / 0.7 };
  // A fingertip changes position as a pinch opens, even with a still hand.
  // Use the same stable palm reference for pointing and scrolling.
  const cameraPoint = { x: clamp((1 - palm.x - 0.15) / 0.7) * innerWidth, y: clamp((palm.y - 0.15) / 0.7) * innerHeight };
  const settling = time < releaseUntil;
  if ((rebasePending || settling) && point) {
    const held = renderedPoint || point;
    pointerOffset = { x: held.x - cameraPoint.x, y: held.y - cameraPoint.y };
    point = { ...held };
    previousRaw = null; pendingJump = null; rebasePending = false;
  }
  const raw = {
    x: Math.max(0, Math.min(innerWidth - 1, cameraPoint.x + pointerOffset.x)),
    y: Math.max(0, Math.min(innerHeight - 1, cameraPoint.y + pointerOffset.y)),
  };
  const dt = Math.max(1, Math.min(100, time - lastUpdate || 33));
  // Reject an isolated jump; accept a consistent new position on the next frame.
  const jumpLimit = Math.max(90, Math.hypot(innerWidth, innerHeight) * 0.12);
  if (previousRaw && Math.hypot(raw.x - previousRaw.x, raw.y - previousRaw.y) > jumpLimit) {
    if (!pendingJump || Math.hypot(raw.x - pendingJump.x, raw.y - pendingJump.y) > jumpLimit / 2) {
      pendingJump = raw;
      cancel(false);
      return;
    }
  }
  pendingJump = null; previousRaw = raw;
  lastSeen = time; lastUpdate = time;
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
    const smoothingMs = 110 - 80 * responsiveness;
    const alpha = (1 - Math.exp(-dt / smoothingMs)) * (1 - deadZone / travel);
    point = { x: point.x + (raw.x - point.x) * alpha, y: point.y + (raw.y - point.y) * alpha };
  }
  const rawRatio = distance(landmarks[4], tip) / Math.max(0.01, distance(landmarks[5], landmarks[17]));
  pinchRatio = pinchRatio === null ? rawRatio : pinchRatio + (rawRatio - pinchRatio) * (1 - Math.exp(-dt / 45));
  const ratio = pinchRatio;
  if (time - stableSince < 350) return;
  cursor.style.display = 'block';
  if (!closed && !settling && ratio > 0.55) armed = true;
  const next = closed ? ratio < 0.55 : ratio < 0.32;
  if (next !== candidate) {
    candidate = next; candidateSince = time;
    if (next && !closed && armed && !settling) {
      const selectedPoint = renderedPoint || point;
      pendingSelection = { point: { ...selectedPoint }, target: clickableAt(selectedPoint.x, selectedPoint.y) };
    } else if (!next) pendingSelection = null;
  }
  if (next !== closed && time - candidateSince >= (next ? 65 : 100)) {
    closed = next;
    if (closed && armed && !settling) {
      const selectedPoint = pendingSelection?.point || renderedPoint || point;
      gesture = { start: { ...anchor }, lastY: anchor.y, point: { ...selectedPoint }, target: pendingSelection?.target || clickableAt(selectedPoint.x, selectedPoint.y), scrolling: false, scrollTarget: window.scrollY, intentSince: null, moved: false };
      pendingSelection = null;
      cursor.classList.add('pinched');
    } else if (!closed) {
      if (gesture && !gesture.moved && !gesture.scrolling && gesture.target?.isConnected && clickableAt(gesture.point.x, gesture.point.y) === gesture.target) {
        gesture.target.focus({ preventScroll: true });
        const session = generation;
        gesture.target.click();
        if (generation !== session) return; // Turning off must not continue the old update.
      }
      if (gesture) {
        // Rebase pointing at the held cursor, not at the hand's scroll endpoint.
        const held = renderedPoint || gesture.point;
        pointerOffset = { x: held.x - cameraPoint.x, y: held.y - cameraPoint.y };
        point = { ...held };
        previousRaw = { ...held };
        pendingJump = null;
        releaseUntil = time + 160;
        armed = false;
      }
      gesture = null; cursor.classList.remove('pinched', 'scrolling');
    }
  }
  if (gesture && candidate && !gesture.target?.closest('#controls')) {
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
  if (active && suspended) { mouseGraceUntil = performance.now() + 700; mouseTravel = 0; suspended = false; cancel(); stableSince = performance.now(); enable.hidden = true; status.textContent = 'Hold one open hand in view.'; return; }
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
        active = true; mouseGraceUntil = performance.now() + 700; enable.hidden = true; enable.disabled = false;
        status.textContent = 'Hold one open hand in view.'; frame(session);
      } else if (data.type === 'result') {
        busy = false; recordTiming(); update(data.landmarks, data.time); scheduleFrame(session);
      }
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
  status.textContent = '';
}
function handleMouseMovement(event) {
  if (!event.isTrusted || (event.pointerType && event.pointerType !== 'mouse') || !active || suspended) return;
  const now = performance.now();
  if (now < mouseGraceUntil) return;
  if (now - mouseWindow > 180) { mouseWindow = now; mouseTravel = 0; }
  mouseTravel += Math.hypot(event.movementX || 0, event.movementY || 0);
  if (mouseTravel >= 18) { mouseTravel = 0; takeover(); }
}
window.addEventListener('pointermove', handleMouseMovement);
window.addEventListener('pointerdown', (event) => { if (event.isTrusted && !event.target.closest('#controls')) takeover(); });
document.addEventListener('visibilitychange', () => { cancel(); stableSince = 0; cursor.style.display = 'none'; });
window.addEventListener('pagehide', () => { stop(); cancelAnimationFrame(animation); });
window.addEventListener('pageshow', (event) => { if (event.persisted) animation = requestAnimationFrame(renderCursor); });
