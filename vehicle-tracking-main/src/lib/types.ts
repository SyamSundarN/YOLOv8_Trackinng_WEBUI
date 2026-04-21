export interface VideoFile {
  id: string;
  file: File;
  name: string;
  thumbnailUrl?: string;
  uploadProgress: number;
  uploaded: boolean;
  backendVideoId?: string;
}

export interface CounterLine {
  id: string;
  name: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
}

export interface RoadwayInfo {
  locationId: string;
  timeInterval: number;
  orientation: "N/S" | "E/W";
  locationDescription: string;
  dateOfRecording: string;
  timeOfRecording: string;
}

export interface VideoConfig {
  videoId: string;
  fileName: string;
  lines: CounterLine[];
  roadwayInfo: RoadwayInfo | null;
}

export interface DetectionStatus {
  jobId: string;
  status: "idle" | "processing" | "complete" | "error";
  progress: number;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  errorMessage?: string;
}

export interface VehicleClass {
  id: number;
  name: string;
  count: number;
}

export const VEHICLE_CLASSES: string[] = [
  "Class-1", "Class-2", "Class-3", "Class-4", "Class-5",
  "Class-6", "Class-7", "Class-8", "Class-9", "Class-10",
  "Class-11", "Class-12", "Class-13",
];

export const LINE_COLORS: string[] = [
  "#3B82F6", "#60A5FA", "#EC4899", "#86EFAC",
  "#F97316", "#EF4444", "#22C55E", "#3B82F6",
  "#EAB308", "#F59E0B",
];

export interface LineCount {
  lineName: string;
  classCounts: number[];
  total: number;
}

export interface TimeIntervalRow {
  time: string;
  date: string;
  lineCounts: LineCount[];
  grandTotal: number;
}

export interface ResultsSummary {
  videoName: string;
  intervalRows: TimeIntervalRow[];
  totalByClass: number[];
  grandTotal: number;
}
