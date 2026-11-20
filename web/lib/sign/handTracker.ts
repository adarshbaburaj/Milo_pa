"use client";
// Singleton HandLandmarker loop (1 hand, VIDEO). Frames stay on-device.
import type { HandLandmarker as HL } from "@mediapipe/tasks-vision";
import { handFeatures, LM } from "./features";

export type HandFrame = { t: number; hand: boolean; v: number[] | null; landmarks?: LM[] };
type Listener = (f: HandFrame) => void;

class HandTracker {
  private lm: HL | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private last = -1;
  private listeners = new Set<Listener>();
  running = false;
  error: string | null = null;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  getVideo() {
    return this.video;
  }

  async start() {
    if (this.running) return;
    try {
      const { HandLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      if (!this.lm) {
        const fs = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        const opts = (delegate: "GPU" | "CPU") => ({
          baseOptions: { modelAssetPath: "/mediapipe/hand_landmarker.task", delegate },
          runningMode: "VIDEO" as const,
          numHands: 1,
        });
        try {
          this.lm = await HandLandmarker.createFromOptions(fs, opts("GPU"));
        } catch {
          this.lm = await HandLandmarker.createFromOptions(fs, opts("CPU"));
        }
      }
      if (!this.video) {
        const v = document.createElement("video");
        v.playsInline = true;
        v.muted = true;
        v.style.display = "none";
        document.body.appendChild(v);
        this.video = v;
      }
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      this.video.srcObject = this.stream;
      await this.video.play();
      this.running = true;
      this.loop();
    } catch (e: any) {
      this.error = e?.name === "NotAllowedError" ? "Camera permission was denied." : String(e?.message || e);
      throw e;
    }
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private loop = () => {
    if (!this.running || !this.video || !this.lm) return;
    const t = performance.now();
    if (this.video.currentTime !== this.last && this.video.readyState >= 2) {
      this.last = this.video.currentTime;
      let f: HandFrame = { t, hand: false, v: null };
      try {
        const r = this.lm.detectForVideo(this.video, t);
        const lms = r.landmarks?.[0] as LM[] | undefined;
        if (lms) {
          const hd = (r.handedness?.[0]?.[0]?.categoryName as string) || "Right";
          f = { t, hand: true, v: handFeatures(lms, hd), landmarks: lms };
        }
      } catch {}
      this.listeners.forEach((l) => l(f));
    }
    this.raf = requestAnimationFrame(this.loop);
  };
}

export const handTracker = typeof window !== "undefined" ? new HandTracker() : (null as unknown as HandTracker);
