import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProjectStore } from "@/lib/project-store";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { VEHICLE_CLASSES } from "@/lib/types";
import type { ResultsSummary } from "@/lib/types";
import { DEMO_MODE, demoGenerateResults, demoDownloadExcel } from "@/lib/demo-mode";

export default function Results() {
  const { toast } = useToast();
  const { detectionStatus, videoConfigs } = useProjectStore();
  const [results, setResults] = useState<ResultsSummary[]>([]);

  useEffect(() => {
    if (DEMO_MODE) {
      setResults(demoGenerateResults(videoConfigs));
    }
  }, [videoConfigs]);

  const handleDownloadExcel = async () => {
    try {
      const blob = DEMO_MODE
        ? demoDownloadExcel(results)
        : await api.downloadResults(detectionStatus.jobId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = DEMO_MODE ? "traffic_counts_demo.csv" : "traffic_counts.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: DEMO_MODE ? "Demo CSV exported." : "Excel report downloaded." });
    } catch {
      toast({
        title: "Download failed",
        description: "Could not download the report.",
        variant: "destructive",
      });
    }
  };

  const allLines = videoConfigs.flatMap((vc) =>
    vc.lines.map((l) => ({ ...l, videoName: vc.fileName }))
  );

  const grandTotal = results.reduce((a, r) => a + r.grandTotal, 0);
  const totalByClass = new Array(13).fill(0);
  results.forEach((r) => r.totalByClass.forEach((c, i) => { totalByClass[i] += c; }));

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Results Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {DEMO_MODE && <span className="text-primary font-medium">[DEMO] </span>}
            Summary of detection counts across all videos and counting lines.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={handleDownloadExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Export {DEMO_MODE ? "CSV" : "Excel"}
          </Button>
          <Button variant="outline" className="gap-2">
            <Video className="h-4 w-4" /> Download Video
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Videos Processed</p>
            <p className="text-3xl font-bold text-primary">{videoConfigs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Counting Lines</p>
            <p className="text-3xl font-bold text-primary">{allLines.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Grand Total</p>
            <p className="text-3xl font-bold text-primary">{grandTotal.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="text-3xl font-bold text-primary">
              {DEMO_MODE ? "Demo" : detectionStatus.status === "complete" ? "Done" : "Pending"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Line Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Counts by Line & Vehicle Class</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10">Line</TableHead>
                  <TableHead className="sticky left-0 bg-card z-10">Video</TableHead>
                  {VEHICLE_CLASSES.map((cls) => (
                    <TableHead key={cls} className="text-center text-xs whitespace-nowrap">
                      {cls}
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center text-muted-foreground py-8">
                      No counting lines configured. Go back and draw lines first.
                    </TableCell>
                  </TableRow>
                ) : (
                  allLines.map((line, idx) => {
                    // Sum counts for this line across all intervals
                    const lineTotals = new Array(13).fill(0);
                    let lineTotal = 0;
                    results.forEach((r) => {
                      r.intervalRows.forEach((row) => {
                        const lc = row.lineCounts.find((c) => c.lineName === line.name);
                        if (lc) {
                          lc.classCounts.forEach((c, i) => { lineTotals[i] += c; });
                          lineTotal += lc.total;
                        }
                      });
                    });

                    return (
                      <TableRow key={line.id}>
                        <TableCell className="font-medium sticky left-0 bg-card">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: line.color }}
                            />
                            {line.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {line.videoName}
                        </TableCell>
                        {lineTotals.map((count, i) => (
                          <TableCell key={i} className="text-center font-mono text-sm">
                            {count}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-mono font-bold">{lineTotal}</TableCell>
                      </TableRow>
                    );
                  })
                )}
                {/* Totals row */}
                {allLines.length > 0 && (
                  <TableRow className="border-t-2">
                    <TableCell className="font-bold sticky left-0 bg-card" colSpan={2}>
                      Total
                    </TableCell>
                    {totalByClass.map((c, i) => (
                      <TableCell key={i} className="text-center font-mono font-bold text-primary">
                        {c}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-mono font-bold text-primary">
                      {grandTotal}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Time Interval Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Time Interval Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {results.length > 0 && results[0].intervalRows.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Date</TableHead>
                    {results[0].intervalRows[0].lineCounts.map((lc) => (
                      <TableHead key={lc.lineName} className="text-center">{lc.lineName}</TableHead>
                    ))}
                    <TableHead className="text-center font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results[0].intervalRows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono">{row.time}</TableCell>
                      <TableCell className="text-muted-foreground">{row.date}</TableCell>
                      {row.lineCounts.map((lc) => (
                        <TableCell key={lc.lineName} className="text-center font-mono">
                          {lc.total}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-mono font-bold">{row.grandTotal}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Download className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p>No interval data available yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
