
# ODOT Vehicle Detection & Counting — Web Frontend

A modern React web application that replicates your PyQt5 desktop app's full workflow, designed to connect to your self-hosted Python/FastAPI backend.

## Design & Theme
- **Dark mode** by default (easy on the eyes for video review)
- **ODOT green (#009969)** as the primary accent color throughout
- Clean, professional layout with sidebar navigation
- Responsive design (desktop-first, usable on tablets)

## Pages & Features

### 1. Project Setup Page (Home)
- Enter number of videos to process
- Drag-and-drop file upload zone (MP4, AVI) — sends files to your backend API
- Upload progress indicators
- List of uploaded videos with thumbnails (extracted from first frame)

### 2. Counter Line Drawing Page
- Displays the first frame of each uploaded video on an HTML5 Canvas
- Users click to draw counting lines directly on the frame (replicating your PyQt5 line-drawing UX)
- Line naming dialog after each line is drawn
- Color-coded lines with labels displayed on canvas
- "Next Video" / "Exit" navigation for multi-video workflows
- **Roadway Information Form** — Location ID, time interval, orientation (N/S or E/W), location description, date/time of recording (matching your LocationInfoDialog)

### 3. Detection & Monitoring Page
- "Start Detection" button that triggers processing via API call
- Real-time progress view: shows current frame, FPS, and processing percentage
- Live video feed with bounding boxes and counting lines rendered as canvas overlays
- Per-line running totals displayed on the video (matching your desktop display)
- Detection class breakdown (13 vehicle classes)
- Status indicators (processing, complete, error)

### 4. Results Dashboard
- Summary statistics per counting line and per vehicle class
- Time-interval breakdown table (matching your Excel output format)
- Total counts across all lines
- Export button to download the generated Excel traffic count report from the backend
- Option to view/download annotated output video

### 5. Sidebar Navigation
- Project Setup → Counter Lines → Detection → Results
- Step-by-step workflow indicator showing progress through the pipeline

## API Integration Layer
- API client module configured to connect to your FastAPI backend URL (configurable)
- Endpoints for: file upload, frame extraction, line coordinate submission, start processing, status polling, results download
- Error handling with user-friendly toast notifications
- WebSocket support placeholder for real-time frame streaming

## Key UX Details
- Canvas-based line drawing with click-to-place start/end points (faithful to your desktop UX)
- Form validation on all inputs (video count, roadway info)
- Loading skeletons and progress bars during processing
- Confirmation dialogs before destructive actions
