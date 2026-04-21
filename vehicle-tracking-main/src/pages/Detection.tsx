import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useProjectStore } from "@/lib/project-store";
import { api } from "@/lib/api-client";
import { VEHICLE_CLASSES } from "@/lib/types";

export default function Detection() {
  const navigate = useNavigate();
  const { detectionStatus, setDetectionStatus, setCurrentStep, videoConfigs } =
    useProjectStore();

  const [classCounts, setClassCounts] = useState<number[]>(
    new Array(13).fill(0)
  );
  /** Bumps so <img> reloads JPEG snapshots from the API while running. */
  const [livePreviewTick, setLivePreviewTick] = useState(0);

  const isIdle = detectionStatus.status === "idle";
  const isProcessing = detectionStatus.status === "processing";
  const isComplete = detectionStatus.status === "complete";
  const isError = detectionStatus.status === "error";

  const handleStart = async () => {
    try {
      setDetectionStatus({ status: "processing", progress: 0 });

      const firstVideo = videoConfigs[0];

      if (!firstVideo) {
        setDetectionStatus({
          status: "error",
          errorMessage: "No video found.",
        });
        return;
      }

      if (!firstVideo.lines || firstVideo.lines.length === 0) {
        setDetectionStatus({
          status: "error",
          errorMessage: "No lines defined.",
        });
        return;
      }

      const { jobId } = await api.startProcessing(
        firstVideo.videoId,
        firstVideo.lines,
        firstVideo.roadwayInfo
      );

      setLivePreviewTick(0);
      setDetectionStatus({
        jobId,
        status: "processing",
        progress: 0,
      });
    } catch (err: any) {
      setDetectionStatus({
        status: "error",
        errorMessage: err?.message || "Failed to start processing.",
      });
    }
  };



  const handleViewResults = () => {
    setCurrentStep(3);
    navigate("/results");
  };

  useEffect(() => {
    if (detectionStatus.status !== "processing" || !detectionStatus.jobId) {
      return;
    }
    const jobId = detectionStatus.jobId;
    let cancelled = false;

    const tick = async () => {
      try {
        const s = await api.getProcessStatus(jobId);
        if (cancelled) return;

        if (s.classCounts) {
          setClassCounts(
            VEHICLE_CLASSES.map(
              (_, i) => Number(s.classCounts[`Class-${i + 1}`]) || 0
            )
          );
        }

        if (s.status === "error") {
          setDetectionStatus({
            jobId,
            status: "error",
            errorMessage:
              s.errorMessage ||
              "Detection failed on the server. Check the API terminal for details.",
            currentFrame: s.currentFrame,
            totalFrames: s.totalFrames,
            fps: s.fps,
          });
          return;
        }

        if (s.status === "complete") {
          setDetectionStatus({
            jobId,
            status: "complete",
            progress: 100,
            currentFrame: s.currentFrame,
            totalFrames: s.totalFrames,
            fps: s.fps,
          });
        } else {
          setDetectionStatus({
            progress: s.progress,
            currentFrame: s.currentFrame,
            totalFrames: s.totalFrames,
            fps: s.fps,
          });
        }
      } catch (err: any) {
        if (cancelled) return;
        setDetectionStatus({
          status: "error",
          errorMessage: err?.message || "Status poll failed.",
        });
      }
    };

    tick();
    const id = window.setInterval(tick, 500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [detectionStatus.status, detectionStatus.jobId, setDetectionStatus]);

  useEffect(() => {
    if (
      (!isProcessing && !isComplete && !isError) ||
      !detectionStatus.jobId
    ) {
      return;
    }
    const id = window.setInterval(
      () => setLivePreviewTick((n) => n + 1),
      120
    );
    return () => clearInterval(id);
  }, [isProcessing, isComplete, isError, detectionStatus.jobId]);

  const totalLines = videoConfigs.reduce((a, c) => a + c.lines.length, 0);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Detection & Monitoring
        </h1>
        <p className="text-muted-foreground mt-1">
          Process {videoConfigs.length} video(s) with {totalLines} counting
          line(s).
        </p>
      </div>

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Processing Control</span>
            <Badge
              variant={
                isProcessing
                  ? "default"
                  : isComplete
                  ? "secondary"
                  : isError
                  ? "destructive"
                  : "outline"
              }
            >
              {detectionStatus.status.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {isIdle && (
            <Button onClick={handleStart} size="lg" className="gap-2">
              <Play className="h-5 w-5" /> Start Detection
            </Button>
          )}

          {isProcessing && (
            <>
              <Progress value={detectionStatus.progress} className="h-3" />

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Current Frame</p>
                  <p className="text-lg font-semibold font-mono">
                    {detectionStatus.currentFrame?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Frames</p>
                  <p className="text-lg font-semibold font-mono">
                    {detectionStatus.totalFrames?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">FPS</p>
                  <p className="text-lg font-semibold font-mono">
                    {detectionStatus.fps?.toFixed(1)}
                  </p>
                </div>
              </div>
            </>
          )}

          {isComplete && (
            <div className="space-y-4">
              <p className="text-primary font-semibold">
                ✓ Detection complete!
              </p>
              <Button onClick={handleViewResults} size="lg">
                View Results →
              </Button>
            </div>
          )}

          {isError && (
            <div className="space-y-3">
              <p className="text-destructive">
                Error: {detectionStatus.errorMessage || "Processing failed."}
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  setDetectionStatus({ status: "idle", progress: 0 })
                }
              >
                Retry
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 🔥 LIVE VIDEO STREAM */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Live Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="aspect-video rounded-lg bg-muted/30 border overflow-hidden flex items-center justify-center">
            {detectionStatus.jobId &&
            (isProcessing || isComplete || isError) ? (
              <img
                key={detectionStatus.jobId}
                src={api.latestFrameUrl(
                  detectionStatus.jobId,
                  livePreviewTick
                )}
                alt="Live detection feed"
                className="w-full h-full object-contain bg-muted/20"
              />
            ) : (
              <p className="text-sm text-muted-foreground px-4 text-center">
                Start detection to view the live annotated feed from the server.
              </p>
            )}
          </div>
        </CardContent>
      </Card>


      {/* Vehicle Classes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Vehicle Class Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {VEHICLE_CLASSES.map((cls, i) => (
              <div
                key={cls}
                className="flex items-center justify-between rounded-lg border p-2.5"
              >
                <span className="text-sm">{cls}</span>
                <span className="font-mono text-sm font-semibold text-primary">
                  {classCounts[i]}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
