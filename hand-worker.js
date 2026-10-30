let tracker;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      // Classic worker permits the WASM loader's importScripts call.
      const { FilesetResolver, HandLandmarker } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/+esm');
      const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
      tracker = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' },
        runningMode: 'VIDEO', numHands: 1,
        minHandDetectionConfidence: 0.65, minHandPresenceConfidence: 0.65, minTrackingConfidence: 0.65,
      });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame') {
      try {
        const result = tracker.detectForVideo(data.frame, data.time);
        self.postMessage({ type: 'result', landmarks: result.landmarks[0] || null, time: data.time });
      } finally { data.frame.close(); }
    }
  } catch (error) { self.postMessage({ type: 'error', message: error.message || String(error) }); }
};
