import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProjectStore } from "@/lib/project-store";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { LINE_COLORS, type CounterLine, type RoadwayInfo } from "@/lib/types";

export default function CounterLines() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { videoConfigs, updateVideoConfig, setCurrentStep } = useProjectStore();
  const [currentVideoIdx, setCurrentVideoIdx] = useState(0);
  const [numLines, setNumLines] = useState("1");
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingLines, setDrawingLines] = useState<CounterLine[]>([]);
  const [clickPoints, setClickPoints] = useState<{ x: number; y: number }[]>([]);
  const [lineNamingOpen, setLineNamingOpen] = useState(false);
  const [pendingLineName, setPendingLineName] = useState("");
  const [roadwayDialogOpen, setRoadwayDialogOpen] = useState(false);
  const [roadwayInfo, setRoadwayInfo] = useState<RoadwayInfo>({
    locationId: "",
    timeInterval: 15,
    orientation: "N/S",
    locationDescription: "",
    dateOfRecording: "",
    timeOfRecording: "",
  });
  const [maxLinesForSession, setMaxLinesForSession] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const currentConfig = videoConfigs[currentVideoIdx];
  console.log("DEBUG videoId:", currentConfig?.videoId);


  // Load a placeholder first frame (in real app this would come from API)
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas || !currentConfig?.videoId) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const frameUrl = api.getFirstFrame(currentConfig.videoId);

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = frameUrl;

  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    imgRef.current = img;

    redrawLines(ctx, drawingLines);
  };

  img.onerror = () => {
    // fallback if backend fails
    canvas.width = 800;
    canvas.height = 450;
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, 800, 450);
    ctx.fillStyle = "#555";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Failed to load first frame from backend",
      400,
      225
    );
  };
}, [currentVideoIdx, currentConfig, drawingLines]);


const redrawLines = (ctx: CanvasRenderingContext2D, lines: CounterLine[]) => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  if (imgRef.current) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0);
  }

  for (const line of lines) {
    ctx.beginPath();
    ctx.moveTo(line.startX, line.startY);
    ctx.lineTo(line.endX, line.endY);
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    const midX = (line.startX + line.endX) / 2;
    const midY = (line.startY + line.endY) / 2;
    ctx.fillStyle = line.color;
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(line.name, midX, midY - 10);
  }
};

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;


      const newPoints = [...clickPoints, { x, y }];
      setClickPoints(newPoints);

      // Draw point marker
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = LINE_COLORS[drawingLines.length % LINE_COLORS.length];
      ctx.fill();

      if (newPoints.length === 2) {
        // Two points collected — open naming dialog
        setLineNamingOpen(true);
        setPendingLineName(`Line ${drawingLines.length + 1}`);
      }
    },
    [isDrawing, clickPoints, drawingLines]
  );

  const handleNameLine = () => {
    if (!pendingLineName.trim()) return;
    const color = LINE_COLORS[drawingLines.length % LINE_COLORS.length];
    const newLine: CounterLine = {
      id: crypto.randomUUID(),
      name: pendingLineName.trim(),
      startX: clickPoints[0].x,
      startY: clickPoints[0].y,
      endX: clickPoints[1].x,
      endY: clickPoints[1].y,
      color,
    };

    const updated = [...drawingLines, newLine];
    setDrawingLines(updated);
    setClickPoints([]);
    setLineNamingOpen(false);

    if (updated.length >= maxLinesForSession) {
      setIsDrawing(false);
    }
  };

  const handleStartDrawing = () => {
    // Open roadway info dialog first
    setRoadwayDialogOpen(true);
  };

  const handleRoadwaySubmit = () => {
    if (roadwayInfo.timeInterval < 1) {
      toast({ title: "Invalid", description: "Time interval must be at least 1 minute.", variant: "destructive" });
      return;
    }
    setRoadwayDialogOpen(false);
    const n = Math.min(parseInt(numLines) || 1, 10);
    setMaxLinesForSession(n);
    setDrawingLines([]);
    setClickPoints([]);
    setIsDrawing(true);
    toast({ title: "Drawing Mode", description: `Click on the canvas to place ${n} line(s). Two clicks per line.` });
  };

  const handleSaveAndNext = () => {
    updateVideoConfig(currentConfig.videoId, {
      lines: drawingLines,
      roadwayInfo,
    });

    if (currentVideoIdx < videoConfigs.length - 1) {
      setCurrentVideoIdx((i) => i + 1);
      setDrawingLines([]);
      setClickPoints([]);
      setIsDrawing(false);
      setRoadwayInfo({
        locationId: "",
        timeInterval: 15,
        orientation: "N/S",
        locationDescription: "",
        dateOfRecording: "",
        timeOfRecording: "",
      });
    } else {
      setCurrentStep(2);
      navigate("/detection");
    }
  };

  const isLastVideo = currentVideoIdx === videoConfigs.length - 1;
  const hasLines = drawingLines.length > 0;

  if (!currentConfig) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No videos configured. Please go back to Project Setup.</p>
        <Button className="mt-4" onClick={() => navigate("/")}>
          Go to Setup
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Counter Lines</h1>
          <p className="text-muted-foreground mt-1">
            Video {currentVideoIdx + 1} of {videoConfigs.length}:{" "}
            <span className="text-foreground font-medium">{currentConfig.fileName}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Lines</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={numLines}
              onChange={(e) => setNumLines(e.target.value)}
              className="w-16 h-8 text-sm"
              disabled={isDrawing}
            />
          </div>
          <Button onClick={handleStartDrawing} disabled={isDrawing} className="mt-5">
            Draw Lines
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <canvas
            ref={canvasRef}
            className="w-full cursor-crosshair"
            style={{ maxHeight: "500px" }}
            onClick={handleCanvasClick}
          />
        </CardContent>
      </Card>

      {/* Line list */}
      {hasLines && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Drawn Lines ({drawingLines.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {drawingLines.map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-sm">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  <span>{l.name}</span>
                  <span className="text-muted-foreground text-xs">
                    ({l.startX},{l.startY}) → ({l.endX},{l.endY})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {isDrawing && (
          <p className="text-sm text-primary mr-auto animate-pulse">
            Click on the canvas to place line points…
          </p>
        )}
        <Button
          onClick={handleSaveAndNext}
          disabled={!hasLines || isDrawing}
        >
          {isLastVideo ? "Proceed to Detection →" : "Next Video →"}
        </Button>
      </div>

      {/* Line Naming Dialog */}
      <Dialog open={lineNamingOpen} onOpenChange={setLineNamingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name This Line</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Line Name</Label>
            <Input
              value={pendingLineName}
              onChange={(e) => setPendingLineName(e.target.value)}
              placeholder="e.g., NB Main St"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleNameLine()}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleNameLine}>Save Line</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roadway Info Dialog */}
      <Dialog open={roadwayDialogOpen} onOpenChange={setRoadwayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Roadway Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Location ID</Label>
              <Input
                value={roadwayInfo.locationId}
                onChange={(e) =>
                  setRoadwayInfo((r) => ({ ...r, locationId: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Time Interval (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={roadwayInfo.timeInterval}
                onChange={(e) =>
                  setRoadwayInfo((r) => ({
                    ...r,
                    timeInterval: parseInt(e.target.value) || 1,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Orientation</Label>
              <Select
                value={roadwayInfo.orientation}
                onValueChange={(v) =>
                  setRoadwayInfo((r) => ({
                    ...r,
                    orientation: v as "N/S" | "E/W",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="N/S">N/S</SelectItem>
                  <SelectItem value="E/W">E/W</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location Description</Label>
              <Textarea
                value={roadwayInfo.locationDescription}
                onChange={(e) =>
                  setRoadwayInfo((r) => ({
                    ...r,
                    locationDescription: e.target.value,
                  }))
                }
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date of Recording</Label>
                <Input
                  type="date"
                  value={roadwayInfo.dateOfRecording}
                  onChange={(e) =>
                    setRoadwayInfo((r) => ({
                      ...r,
                      dateOfRecording: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Time of Recording</Label>
                <Input
                  type="time"
                  value={roadwayInfo.timeOfRecording}
                  onChange={(e) =>
                    setRoadwayInfo((r) => ({
                      ...r,
                      timeOfRecording: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoadwayDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRoadwaySubmit}>Continue to Drawing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
