# Headset intro video

`headset-intro.mp4` is the production 1920×1080 H.264 video. Short six-frame keyframe intervals and fast-start metadata support scroll seeking. `headset-intro.webm` is the source recording.

The live GLB animation remains in `headset-intro.js` as a decode-error fallback. The production page uses `headset-video.js`; welcome text, caret, aura, flash and navigation remain live DOM elements.

To record again: run `python3 scripts/capture-headset-video.py`, then open `http://localhost:8002/headset-capture.html`. Keep the recording tab foreground until “Video saved” appears. This overwrites the source WebM. Encode it with ffmpeg:

```
ffmpeg -y -i assets/video/headset-intro.webm -an -c:v libx264 -preset fast -crf 18 -g 6 -keyint_min 6 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart assets/video/headset-intro.mp4
```

The video has fixed landscape framing; narrow screens use a centered cover crop. Re-record the video after changing the model or its lighting/choreography.

## Main jellyfish

`jellyfish-loop.mp4` is a 1080p looping video with both jellyfish and baked glass lighting. `jellyfish-poster.jpg` provides its initial frame. Main pauses the scene renderer while the video is in use and pauses playback outside Main or while hidden. A video decode error activates the live GLB fallback.

Re-record with `python3 scripts/capture-jellyfish-video.py`, then open `http://localhost:8003/jellyfish-capture.html` and keep it foreground until saved. Encode the resulting WebM with H.264 CRF 18, yuv420p, and faststart.
