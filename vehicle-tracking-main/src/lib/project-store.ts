import { create } from "zustand";
import type { VideoFile, VideoConfig, DetectionStatus, ResultsSummary } from "./types";

interface ProjectState {
  // Step tracking
  currentStep: number;
  setCurrentStep: (step: number) => void;

  // Video files
  videoCount: number;
  setVideoCount: (n: number) => void;
  videos: VideoFile[];
  addVideo: (v: VideoFile) => void;
  updateVideo: (id: string, updates: Partial<VideoFile>) => void;
  removeVideo: (id: string) => void;
  clearVideos: () => void;

  // Video configs (lines + roadway info)
  videoConfigs: VideoConfig[];
  setVideoConfigs: (configs: VideoConfig[]) => void;
  updateVideoConfig: (videoId: string, updates: Partial<VideoConfig>) => void;

  // Detection
  detectionStatus: DetectionStatus;
  setDetectionStatus: (s: Partial<DetectionStatus>) => void;

  // Results
  results: ResultsSummary[];
  setResults: (r: ResultsSummary[]) => void;

  // Reset
  resetProject: () => void;
}

const initialDetection: DetectionStatus = {
  jobId: "",
  status: "idle",
  progress: 0,
  currentFrame: 0,
  totalFrames: 0,
  fps: 0,
};

export const useProjectStore = create<ProjectState>((set) => ({
  currentStep: 0,
  setCurrentStep: (step) => set({ currentStep: step }),

  videoCount: 1,
  setVideoCount: (n) => set({ videoCount: n }),
  videos: [],
  addVideo: (v) => set((s) => ({ videos: [...s.videos, v] })),
  updateVideo: (id, updates) =>
    set((s) => ({
      videos: s.videos.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    })),
  removeVideo: (id) => set((s) => ({ videos: s.videos.filter((v) => v.id !== id) })),
  clearVideos: () => set({ videos: [] }),

  videoConfigs: [],
  setVideoConfigs: (configs) => set({ videoConfigs: configs }),
  updateVideoConfig: (videoId, updates) =>
    set((s) => ({
      videoConfigs: s.videoConfigs.map((c) =>
        c.videoId === videoId ? { ...c, ...updates } : c
      ),
    })),

  detectionStatus: initialDetection,
  setDetectionStatus: (s) =>
    set((prev) => ({ detectionStatus: { ...prev.detectionStatus, ...s } })),

  results: [],
  setResults: (r) => set({ results: r }),

  resetProject: () =>
    set({
      currentStep: 0,
      videoCount: 1,
      videos: [],
      videoConfigs: [],
      detectionStatus: initialDetection,
      results: [],
    }),
}));
