"use client";
// Singleton FaceLandmarker loop. Camera frames never leave the browser.
import type { FaceLandmarker as FL } from "@mediapipe/tasks-vision";
import { Calibration, defaultCalibration, loadCalibration } from "./calibration";
import { OneEuro } from "./oneEuro";
import { Pose, poseFromLandmarks, poseFromMatrix, poseFromNose } from "./pose";

export type HeadFrame = {
  t: number;
  face: boolean;
  raw: Pose | null; // unsmoothed pose
  smooth: { yaw: number; pitch: number } | null;
  /** cursor in screen fractions (0..1), calibrated + smoothed */
  nx: number;
  ny: number;
  /** unsmoothed screen fractions, for gestures */
  rx: number;
  ry: number;
  landmarks?: { x: number; y: number }[];
};

type Listener = (f: HeadFrame) => void;

const WASM = "/mediapipe/wasm";
const MODEL = "/mediapipe/face_landmarker.task";

class FaceTracker {
  private landmarker: FL | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private lastVideoTime = -1;
  private listeners = new Set<Listener>();
  private fx = new OneEuro(1.0, 0.01);
  private fy = new OneEuro(1.0, 0.01);
  private starting: Promise<void> | null = null;
  calibration: Calibration | null = null;
  sensitivity = 1;
  invertX = false;
  invertY = false;
  source: "matrix" | "landmarks" | "nose" = "nose";
  /** "nose" = nose-tip pointer (default), "pose" = head rotation */
  pointer: "nose" | "pose" = "nose";
  running = false;
  error: string | null = null;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getVideo() {
    return this.video;
  }

  async start(): Promise<void> {
    if (this.running) return;
    if (this.starting) return this.starting;
    this.starting = (async () => {
      this.error = null;
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      if (!this.landmarker) {
        const fileset = await FilesetResolver.forVisionTasks(WASM);
        const opts = (delegate: "GPU" | "CPU") => ({
          baseOptions: { modelAssetPath: MODEL, delegate },
          runningMode: "VIDEO" as const,
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: false,
        });
        try {
          this.landmarker = await FaceLandmarker.createFromOptions(fileset, opts("GPU"));
        } catch {
          this.landmarker = await FaceLandmarker.createFromOptions(fileset, opts("CPU"));
        }
      }
      if (!this.video) {
        const v = document.createElement("video");
        v.playsInline = true;
        v.muted = true;
        v.width = 640;
        v.height = 480;
        v.style.display = "none";
        document.body.appendChild(v);
        this.video = v;
      }
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      this.video.srcObject = this.stream;
      await this.video.play();
      this.calibration = loadCalibration();
      this.running = true;
      this.loop();
    })();
    try {
      await this.starting;
    } catch (e: any) {
      this.error = e?.name === "NotAllowedError" ? "Camera permission was denied." : String(e?.message || e);
      throw e;
    } finally {
      this.starting = null;
    }
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }

  setCalibration(c: Calibration | null) {
    this.calibration = c;
    this.fx.reset();
    this.fy.reset();
  }

  private toScreen(yaw: number, pitch: number) {
    const c = this.calibration && this.calibration.source === this.source ? this.calibration : defaultCalibration(this.source);
    const sx = (this.invertX ? -1 : 1) * this.sensitivity;
    const sy = (this.invertY ? -1 : 1) * this.sensitivity;
    return {
      x: 0.5 + (yaw - c.yaw0) * c.gainX * sx,
      y: 0.5 + (pitch - c.pitch0) * c.gainY * sy,
    };
  }

  private loop = () => {
    if (!this.running || !this.video || !this.landmarker) return;
    const t = performance.now();
    if (this.video.currentTime !== this.lastVideoTime && this.video.readyState >= 2) {
      this.lastVideoTime = this.video.currentTime;
      let frame: HeadFrame = { t, face: false, raw: null, smooth: null, nx: 0.5, ny: 0.5, rx: 0.5, ry: 0.5 };
      try {
        const res = this.landmarker.detectForVideo(this.video, t);
        const lm = res.faceLandmarks?.[0];
        if (lm) {
          let pose = this.pointer === "nose" ? poseFromNose(lm as any) : poseFromMatrix(res.facialTransformationMatrixes?.[0] as any);
          if (!pose) pose = poseFromLandmarks(lm as any);
          if (pose) {
            if (pose.source !== this.source) {
              this.source = pose.source;
              this.fx.reset();
              this.fy.reset();
            }
            const yaw = this.fx.filter(pose.yaw, t);
            const pitch = this.fy.filter(pose.pitch, t);
            const s = this.toScreen(yaw, pitch);
            const r = this.toScreen(pose.yaw, pose.pitch);
            frame = { t, face: true, raw: pose, smooth: { yaw, pitch }, nx: s.x, ny: s.y, rx: r.x, ry: r.y, landmarks: lm as any };
          }
        }
      } catch {
        /* skip frame */
      }
      this.listeners.forEach((l) => l(frame));
    }
    this.raf = requestAnimationFrame(this.loop);
  };
}

export const faceTracker = typeof window !== "undefined" ? new FaceTracker() : (null as unknown as FaceTracker);
