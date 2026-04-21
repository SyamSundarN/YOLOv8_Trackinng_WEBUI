import csv
import os
import threading
import time
import uuid
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional

import cv2
import numpy as np
from openpyxl import Workbook
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Absolute paths so uploads still resolve after Hydra/tracking changes cwd during /api/process
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = str(BASE_DIR / "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
JOB_CONFIG_DIR = BASE_DIR / "job_configs"
JOB_CONFIG_DIR.mkdir(exist_ok=True)
FORCE_SIMPLE_DETECTION = os.getenv("USE_SIMPLE_DETECTION", "").lower() in {
    "1",
    "true",
    "yes",
}

# In-memory job storage (single dict — do not reassign elsewhere)
JOBS: Dict[str, Dict] = {}


def _find_tracking_model() -> Optional[Path]:
    preferred = BASE_DIR / "20230420_best_weight.pt"
    if preferred.exists():
        return preferred

    candidates = sorted(BASE_DIR.glob("*.pt"))
    if candidates:
        return candidates[0]

    return None


def _should_use_tracking() -> bool:
    return _find_tracking_model() is not None


def _run_yolo_with_cwd_restore(
    video_path: str,
    job_id: str,
    jobs_dict: Dict[str, Dict],
    config_path: str,
):
    """Hydra/tracking may chdir; restore afterward so other routes keep valid relative paths."""
    from tracking import run_yolo  # defer import — tracking bootstrap is heavy

    previous = os.getcwd()
    try:
        run_yolo(video_path, job_id, jobs_dict, config_path)
    finally:
        try:
            os.chdir(previous)
        except OSError:
            pass


def _processing_thread_entry(
    video_path: str,
    job_id: str,
    jobs_dict: Dict[str, Dict],
    config_path: str,
):
    try:
        if FORCE_SIMPLE_DETECTION:
            run_detection(job_id, video_path)
        elif _should_use_tracking():
            _run_yolo_with_cwd_restore(video_path, job_id, jobs_dict, config_path)
        else:
            raise RuntimeError(
                "Detection model weights not found. Add 20230420_best_weight.pt "
                "(or another .pt file) to the backend folder, or set "
                "USE_SIMPLE_DETECTION=1 for preview-only mode."
            )
    except Exception as e:
        if job_id in jobs_dict:
            jobs_dict[job_id]["status"] = "error"
            jobs_dict[job_id]["errorMessage"] = str(e) or type(e).__name__


# =========================
# UPLOAD VIDEO
# =========================

@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    video_id = str(uuid.uuid4())
    file_path = os.path.abspath(os.path.join(UPLOAD_DIR, f"{video_id}.mp4"))

    with open(file_path, "wb") as f:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail="Upload failed")

    return {
        "videoId": video_id,
        "fileName": file.filename
    }


# =========================
# GET FIRST FRAME
# =========================

@app.get("/api/videos/{video_id}/frame")
def get_first_frame(video_id: str):
    video_path = os.path.abspath(os.path.join(UPLOAD_DIR, f"{video_id}.mp4"))

    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video not found")

    cap = cv2.VideoCapture(video_path)
    try:
        success, frame = cap.read()
    finally:
        cap.release()

    if not success:
        raise HTTPException(status_code=500, detail="Could not read frame")

    frame_path = os.path.abspath(os.path.join(UPLOAD_DIR, f"{video_id}_frame.jpg"))
    cv2.imwrite(frame_path, frame)

    return FileResponse(frame_path, media_type="image/jpeg")


# =========================
# PROCESS (NO BODY EXPECTED)
# =========================

class Line(BaseModel):
    startX: float
    startY: float
    endX: float
    endY: float
    name: str


class RoadwayInfo(BaseModel):
    locationId: str = ""
    timeInterval: int = 15
    orientation: str = "N/S"
    locationDescription: str = ""
    dateOfRecording: str = ""
    timeOfRecording: str = ""


class ProcessRequest(BaseModel):
    videoId: str
    lines: List[Line]
    roadwayInfo: Optional[RoadwayInfo] = None


def _normalize_time_hhmm(raw_value: str) -> str:
    digits = "".join(ch for ch in str(raw_value or "") if ch.isdigit())
    if not digits:
        return "0000"
    return digits[-4:].zfill(4)


def _write_job_config(
    job_id: str,
    video_path: str,
    lines: List[Line],
    roadway_info: Optional[RoadwayInfo],
) -> str:
    roadway = roadway_info or RoadwayInfo()
    config_path = JOB_CONFIG_DIR / f"{job_id}.csv"
    recording_date = roadway.dateOfRecording or date.today().isoformat()
    recording_time = _normalize_time_hhmm(roadway.timeOfRecording)
    time_interval = max(int(roadway.timeInterval or 15), 1)

    with config_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.writer(csv_file)
        for index, line in enumerate(lines, start=1):
            writer.writerow(
                [
                    int(round(line.startX)),
                    int(round(line.startY)),
                    int(round(line.endX)),
                    int(round(line.endY)),
                    line.name or f"Line {index}",
                    roadway.locationId or Path(video_path).stem,
                    time_interval,
                    roadway.orientation or "N/S",
                    roadway.locationDescription or "",
                    recording_date,
                    recording_time,
                ]
            )

    return str(config_path.resolve())


@app.post("/api/process")
def start_process(req: ProcessRequest):

    video_path = os.path.join(UPLOAD_DIR, f"{req.videoId}.mp4")
    video_path = os.path.abspath(video_path)

    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video not found")
    if not req.lines:
        raise HTTPException(status_code=400, detail="At least one counting line is required")
    if not FORCE_SIMPLE_DETECTION and not _should_use_tracking():
        raise HTTPException(
            status_code=503,
            detail=(
                "Detection model weights not found. Add 20230420_best_weight.pt "
                "(or another .pt file) to the backend folder, or set "
                "USE_SIMPLE_DETECTION=1 for preview-only mode."
            ),
        )

    job_id = str(uuid.uuid4())
    config_path = _write_job_config(job_id, video_path, req.lines, req.roadwayInfo)

    JOBS[job_id] = {
        "status": "processing",
        "progress": 0,
        "currentFrame": 0,
        "totalFrames": 0,
        "fps": 0,
        "classCounts": {f"Class-{i}": 0 for i in range(1, 14)},
        "latestFrame": None,
        "errorMessage": None,
        "configPath": config_path,
        "sourceVideoId": req.videoId,
        "engine": "simple" if FORCE_SIMPLE_DETECTION else "tracking",
    }

    # First decoded frame for live preview before YOLO thread updates (avoids broken <img>).
    cap = cv2.VideoCapture(video_path)
    try:
        ok, frame = cap.read()
        if ok and frame is not None:
            JOBS[job_id]["latestFrame"] = frame.copy()
            JOBS[job_id]["totalFrames"] = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            JOBS[job_id]["fps"] = float(cap.get(cv2.CAP_PROP_FPS)) or 0.0
    finally:
        cap.release()

    thread = threading.Thread(
        target=_processing_thread_entry,
        args=(video_path, job_id, JOBS, config_path),
        daemon=True
    )
    thread.start()

    return {"jobId": job_id}

def run_detection(job_id: str, video_path: str):

    cap = cv2.VideoCapture(video_path)

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)

    JOBS[job_id]["totalFrames"] = total_frames
    JOBS[job_id]["fps"] = fps

    frame_number = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_number += 1

        # 🔥 SIMULATED DETECTION (replace later with YOLO)
        cv2.putText(
            frame,
            f"Frame: {frame_number}",
            (30, 50),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            2
        )

        # fake class increment
        JOBS[job_id]["classCounts"]["Class-1"] += np.random.randint(0, 2)

        progress = int((frame_number / total_frames) * 100)

        JOBS[job_id]["progress"] = progress
        JOBS[job_id]["currentFrame"] = frame_number
        JOBS[job_id]["latestFrame"] = frame

        time.sleep(0.02)  # simulate compute delay

    cap.release()
    JOBS[job_id]["results"] = {
        "Total": JOBS[job_id]["classCounts"]
    }
    JOBS[job_id]["status"] = "complete"
    JOBS[job_id]["progress"] = 100

@app.get("/api/process/{job_id}")
def get_status(job_id: str):

    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")

    job = JOBS[job_id]

    return {
        "status": job["status"],
        "progress": job["progress"],
        "currentFrame": job["currentFrame"],
        "totalFrames": job["totalFrames"],
        "fps": job["fps"],
        "classCounts": job["classCounts"],
        "errorMessage": job.get("errorMessage"),
    }


@app.get("/api/process/{job_id}/latest.jpg")
def get_latest_frame_jpeg(job_id: str):
    """Single-frame snapshot for live preview (reliable in browsers; MJPEG multipart often is not)."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    job = JOBS[job_id]
    frame = job.get("latestFrame")
    if frame is None:
        source_video_id = job.get("sourceVideoId")
        if source_video_id:
            fallback_path = os.path.abspath(
                os.path.join(UPLOAD_DIR, f"{source_video_id}_frame.jpg")
            )
            if os.path.exists(fallback_path):
                return FileResponse(fallback_path, media_type="image/jpeg")
        raise HTTPException(status_code=404, detail="No frame yet")
    ok, buf = cv2.imencode(
        ".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85]
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Frame encode failed")
    return Response(
        content=buf.tobytes(),
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store, no-cache"},
    )


def generate_stream(job_id):
    while True:
        if job_id not in JOBS:
            break

        frame = JOBS[job_id]["latestFrame"]
        if frame is None:
            time.sleep(0.05)
            continue

        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()

        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
        )

        if JOBS[job_id]["status"] == "complete":
            break

        time.sleep(0.03)

@app.get("/api/stream/{job_id}")
def stream_video(job_id: str):
    return StreamingResponse(
        generate_stream(job_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

# =========================
# GET RESULTS
# =========================

@app.get("/api/results/{job_id}")
def get_results(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")

    job = JOBS[job_id]
    if job.get("status") != "complete" or "results" not in job:
        raise HTTPException(
            status_code=409,
            detail="Results not ready yet; job still processing or failed.",
        )

    return job["results"]


# =========================
# DOWNLOAD EXCEL
# =========================

@app.get("/api/results/{job_id}/excel")
def download_excel(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")

    job = JOBS[job_id]
    if job.get("status") != "complete" or "results" not in job:
        raise HTTPException(
            status_code=409,
            detail="Results not ready yet; job still processing or failed.",
        )

    results = job["results"]

    wb = Workbook()
    ws = wb.active
    ws.title = "Total Counts"

    ws.append(["Line", "Class-1", "Class-2", "Class-3", "Class-4"])

    for line_name, counts in results.items():
        ws.append([
            line_name,
            counts["Class-1"],
            counts["Class-2"],
            counts["Class-3"],
            counts["Class-4"],
        ])

    file_path = os.path.abspath(os.path.join(UPLOAD_DIR, f"{job_id}_results.xlsx"))
    wb.save(file_path)

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="traffic_counts.xlsx"
    )
