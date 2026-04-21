import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, X, Film, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useProjectStore } from "@/lib/project-store";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { DEMO_MODE, demoUploadVideo } from "@/lib/demo-mode";

export default function ProjectSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    videoCount, setVideoCount,
    videos, addVideo, updateVideo, removeVideo, clearVideos,
    setCurrentStep, setVideoConfigs,
  } = useProjectStore();

  const [inputCount, setInputCount] = useState(String(videoCount));
  const [countSubmitted, setCountSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSubmitCount = () => {
    const n = parseInt(inputCount, 10);
    if (!n || n < 1 || n > 20) {
      toast({ title: "Invalid input", description: "Enter a number between 1 and 20.", variant: "destructive" });
      return;
    }
    setVideoCount(n);
    clearVideos();
    setCountSubmitted(true);
  };

  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        /\.(mp4|avi|mov)$/i.test(f.name)
      );
      addFiles(files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [videos, videoCount]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    const remaining = videoCount - videos.length;
    const toAdd = files.slice(0, remaining);
    for (const file of toAdd) {
      const id = crypto.randomUUID();
      addVideo({
        id,
        file,
        name: file.name,
        uploadProgress: 0,
        uploaded: false,
      });
    }
  };

  const handleUploadAll = async () => {
    setUploading(true);
    try {
      for (const v of videos.filter((v) => !v.uploaded)) {
        try {
          const uploadFn = DEMO_MODE ? demoUploadVideo : api.uploadVideo.bind(api);
          const result = await uploadFn(v.file, (pct) => {
            updateVideo(v.id, { uploadProgress: pct });
          });
          updateVideo(v.id, {
            uploaded: true,
            uploadProgress: 100,
            thumbnailUrl: result.thumbnailUrl,
            backendVideoId: result.videoId,
          });
        } catch (err: any) {
          toast({ title: "Upload failed", description: err?.message || `Failed to upload ${v.name}`, variant: "destructive" });
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const handleProceed = () => {
    // Initialize video configs
    setVideoConfigs(
      videos.map((v) => ({
        videoId: (v as any).backendVideoId,
        fileName: v.name,
        lines: [],
        roadwayInfo: null,
      }))
    );
    setCurrentStep(1);
    navigate("/counter-lines");
  };

  const allUploaded = videos.length === videoCount && videos.every((v) => v.uploaded);
  const hasVideos = videos.length > 0;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Project Setup</h1>
        <p className="text-muted-foreground mt-1">
          Configure the number of videos and upload your files to begin.
        </p>
      </div>

      {/* Video Count */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Number of Videos</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="video-count">Enter number of videos to process</Label>
            <Input
              id="video-count"
              type="number"
              min={1}
              max={20}
              value={inputCount}
              onChange={(e) => setInputCount(e.target.value)}
              className="w-24"
              disabled={countSubmitted}
            />
          </div>
          {!countSubmitted ? (
            <Button onClick={handleSubmitCount}>Submit</Button>
          ) : (
            <Button variant="outline" onClick={() => { setCountSubmitted(false); clearVideos(); }}>
              Change
            </Button>
          )}
        </CardContent>
      </Card>

      {/* File Upload */}
      {countSubmitted && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Videos ({videos.length}/{videoCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {videos.length < videoCount && (
              <div
                onDrop={handleFileDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-border rounded-lg p-10 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  Drag & drop video files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  MP4, AVI, MOV — {videoCount - videos.length} more needed
                </p>
                <input
                  id="file-input"
                  type="file"
                  accept=".mp4,.avi,.mov"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            )}

            {/* File list */}
            {videos.length > 0 && (
              <div className="space-y-2">
                {videos.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <Film className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.name}</p>
                      {v.uploadProgress > 0 && !v.uploaded && (
                        <Progress value={v.uploadProgress} className="h-1.5 mt-1" />
                      )}
                      {v.uploaded && (
                        <p className="text-xs text-primary mt-0.5">Uploaded ✓</p>
                      )}
                    </div>
                    {!v.uploaded && (
                      <Button size="icon" variant="ghost" onClick={() => removeVideo(v.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {hasVideos && !allUploaded && (
                <Button onClick={handleUploadAll} disabled={uploading}>
                  {uploading ? "Uploading…" : "Upload All"}
                </Button>
              )}
              {allUploaded && (
                <Button onClick={handleProceed}>
                  Proceed to Counter Lines →
                </Button>
              )}
            </div>

            {!allUploaded && videos.length === videoCount && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>Upload all videos before proceeding.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
