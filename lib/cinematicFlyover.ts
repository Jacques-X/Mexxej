// Cinematic Flyover — records a hype video of the trip by
// screen-capturing the tab while the 3D camera sweeps each stop.
//
// Flow:
//   1. Ask browser for screen capture via getDisplayMedia
//   2. Pipe the stream into a MediaRecorder
//   3. Fly to each itinerary stop in day/order sequence
//   4. At each stop perform a 5-second orbital pan
//   5. Stop recording and download the result as .webm

import type { Map3DHandle } from "@/components/Map3D";
import type { TripLocation, CameraPosition } from "@/types/trip";

const STOP_DWELL_MS = 5000;
const FLY_DURATION_MS = 3500;
const ORBIT_DURATION_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function locationToCamera(loc: TripLocation, range = 900): CameraPosition {
  return {
    center: { lat: loc.latitude, lng: loc.longitude, altitude: 200 },
    tilt: 70,
    heading: 0,
    range,
  };
}

// ── Main export ───────────────────────────────────────────────
export async function startCinematicFlyover(
  map: Map3DHandle,
  locations: TripLocation[]
): Promise<void> {
  if (locations.length === 0) {
    alert("Add at least one location before recording a flyover.");
    return;
  }

  // ── 1. Request screen capture ────────────────────────────
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: 30,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
  } catch {
    // User cancelled or permission denied
    return;
  }

  // ── 2. Set up MediaRecorder ───────────────────────────────
  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingDone = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start(200); // collect chunks every 200 ms

  // ── 3. Sort locations by day → order ──────────────────────
  const sorted = [...locations].sort(
    (a, b) => a.day_number - b.day_number || a.order_index - b.order_index
  );

  // ── 4. Sweep through each stop ────────────────────────────
  for (let i = 0; i < sorted.length; i++) {
    const loc = sorted[i];
    const camera = locationToCamera(loc);

    // Fly to the stop
    map.flyCameraTo(camera, FLY_DURATION_MS);
    await map.waitForAnimationEnd();

    // Brief dwell so the viewer can read the scene
    await sleep(500);

    // Slow orbital pan around the stop
    map.flyCameraAround(camera, ORBIT_DURATION_MS, 0.6);
    await sleep(ORBIT_DURATION_MS + 500);
  }

  // Grand finale: pull back to a high overview of all stops
  const bounds = getBounds(sorted);
  map.flyCameraTo(
    {
      center: { lat: bounds.centerLat, lng: bounds.centerLng, altitude: 500 },
      tilt: 45,
      heading: 0,
      range: bounds.span * 111_000 * 1.5, // approx metres
    },
    FLY_DURATION_MS
  );
  await sleep(STOP_DWELL_MS);

  // ── 5. Stop recording and download ───────────────────────
  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());
  await recordingDone;

  const ext = mimeType.includes("mp4") ? "mp4" : "webm";
  const blob = new Blob(chunks, { type: mimeType });
  downloadBlob(blob, `mexxej-flyover-${Date.now()}.${ext}`);
}

// ── Helpers ───────────────────────────────────────────────────

function getSupportedMimeType(): string {
  const candidates = [
    "video/mp4;codecs=avc1",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function getBounds(locs: TripLocation[]): {
  centerLat: number;
  centerLng: number;
  span: number;
} {
  const lats = locs.map((l) => l.latitude);
  const lngs = locs.map((l) => l.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    centerLat: (minLat + maxLat) / 2,
    centerLng: (minLng + maxLng) / 2,
    span: Math.max(maxLat - minLat, maxLng - minLng),
  };
}
