/**
 * Demo mode: simulates backend responses so the full workflow
 * can be tested without a running FastAPI server.
 */

import { VEHICLE_CLASSES } from "./types";
import type { ResultsSummary, TimeIntervalRow, LineCount } from "./types";

export const DEMO_MODE = false; // Toggle to false when backend is ready

/** Simulate a delay */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Simulated upload — resolves after a fake progress animation */
export async function demoUploadVideo(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ videoId: string; thumbnailUrl: string }> {
  const videoId = crypto.randomUUID();
  const steps = [10, 25, 45, 60, 80, 95, 100];
  for (const pct of steps) {
    await wait(200 + Math.random() * 150);
    onProgress?.(pct);
  }
  return { videoId, thumbnailUrl: "" };
}

/** Simulated processing — calls onTick repeatedly then resolves */
export function demoStartProcessing(
  onTick: (status: {
    status: string;
    progress: number;
    currentFrame: number;
    totalFrames: number;
    fps: number;
  }) => void
): { jobId: string; stop: () => void } {
  const jobId = `demo-${Date.now()}`;
  const totalFrames = 5400;
  let frame = 0;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    frame += Math.floor(40 + Math.random() * 30);
    if (frame >= totalFrames) frame = totalFrames;
    const progress = Math.round((frame / totalFrames) * 100);
    onTick({
      status: frame >= totalFrames ? "complete" : "processing",
      progress,
      currentFrame: frame,
      totalFrames,
      fps: 28 + Math.random() * 5,
    });
    if (frame < totalFrames) {
      setTimeout(tick, 120);
    }
  };
  setTimeout(tick, 300);

  return { jobId, stop: () => { stopped = true; } };
}

/** Generate mock results based on configured lines */
export function demoGenerateResults(
  videoConfigs: { fileName: string; lines: { name: string }[]; roadwayInfo: any }[]
): ResultsSummary[] {
  return videoConfigs.map((vc) => {
    const intervalRows: TimeIntervalRow[] = [];
    const numIntervals = 6;
    const totalByClass = new Array(13).fill(0);
    let grandTotal = 0;

    for (let t = 0; t < numIntervals; t++) {
      const hour = 7 + Math.floor(t / 4);
      const minute = (t % 4) * 15;
      const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

      const lineCounts: LineCount[] = vc.lines.map((l) => {
        const classCounts = VEHICLE_CLASSES.map(() => Math.floor(Math.random() * 20));
        const total = classCounts.reduce((a, b) => a + b, 0);
        classCounts.forEach((c, i) => { totalByClass[i] += c; });
        grandTotal += total;
        return { lineName: l.name, classCounts, total };
      });

      intervalRows.push({
        time,
        date: vc.roadwayInfo?.dateOfRecording || "2026-01-15",
        lineCounts,
        grandTotal: lineCounts.reduce((a, c) => a + c.total, 0),
      });
    }

    return { videoName: vc.fileName, intervalRows, totalByClass, grandTotal };
  });
}

/** Generate a demo Excel blob (CSV stand-in) */
export function demoDownloadExcel(results: ResultsSummary[]): Blob {
  const header = ["Video", "Time", "Line", ...VEHICLE_CLASSES, "Total"];
  const rows: string[][] = [header];

  for (const r of results) {
    for (const row of r.intervalRows) {
      for (const lc of row.lineCounts) {
        rows.push([
          r.videoName,
          row.time,
          lc.lineName,
          ...lc.classCounts.map(String),
          String(lc.total),
        ]);
      }
    }
  }

  const csv = rows.map((r) => r.join(",")).join("\n");
  return new Blob([csv], { type: "text/csv" });
}
