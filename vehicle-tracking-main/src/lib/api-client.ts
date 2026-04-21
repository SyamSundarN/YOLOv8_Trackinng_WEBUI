/**
 * Dev: empty = same origin + vite.config proxy → FastAPI.
 * Prod: set VITE_API_URL at build time if API is on another host.
 */
const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? "" : "http://127.0.0.1:8000");

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const base = API_BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // =========================
  // Upload video
  // =========================
  uploadVideo(
    file: File,
    onProgress?: (pct: number) => void
  ): Promise<{ videoId: string; fileName: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE_URL}/api/upload`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () =>
        reject(
          new Error(
            "Cannot reach backend server. Make sure FastAPI is running."
          )
        );

      const fd = new FormData();
      fd.append("file", file);
      xhr.send(fd);
    });
  },

  // =========================
  // Get first frame (image only)
  // =========================
  getFirstFrame(videoId: string): string {
    // IMPORTANT: backend returns image directly, not JSON
    return `${API_BASE_URL}/api/videos/${videoId}/frame`;
  },

  // =========================
  // Start detection
  // =========================
  startProcessing(
    videoId: string,
    lines: {
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      name: string;
    }[],
    roadwayInfo?: {
      locationId: string;
      timeInterval: number;
      orientation: "N/S" | "E/W";
      locationDescription: string;
      dateOfRecording: string;
      timeOfRecording: string;
    } | null
  ): Promise<{ jobId: string }> {
    return request("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, lines, roadwayInfo }),
    });
  },

  getProcessStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    currentFrame: number;
    totalFrames: number;
    fps: number;
    classCounts: Record<string, number>;
    errorMessage?: string | null;
  }> {
    return request(`/api/process/${jobId}`);
  },

  streamUrl(jobId: string): string {
    return `${API_BASE_URL}/api/stream/${jobId}`;
  },

  /** Refreshed snapshot URL for <img src> live preview (append cacheBust each tick). */
  latestFrameUrl(jobId: string, cacheBust: number): string {
    return `${API_BASE_URL}/api/process/${jobId}/latest.jpg?t=${cacheBust}`;
  },

  // =========================
  // Get results (after complete)
  // =========================
  getResults(jobId: string): Promise<Record<string, any>> {
    return request(`/api/results/${jobId}`);
  },

  // =========================
  // Download Excel
  // =========================
  async downloadResults(jobId: string): Promise<Blob> {
    const res = await fetch(
      `${API_BASE_URL}/api/results/${jobId}/excel`
    );

    if (!res.ok) throw new Error("Download failed");

    return res.blob();
  },
};
