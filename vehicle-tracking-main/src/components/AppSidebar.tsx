import { NavLink, useLocation } from "react-router-dom";
import { Upload, Crosshair, Play, BarChart3 } from "lucide-react";
import { useProjectStore } from "@/lib/project-store";
import { cn } from "@/lib/utils";

const steps = [
  { path: "/", label: "Project Setup", icon: Upload, step: 0 },
  { path: "/counter-lines", label: "Counter Lines", icon: Crosshair, step: 1 },
  { path: "/detection", label: "Detection", icon: Play, step: 2 },
  { path: "/results", label: "Results", icon: BarChart3, step: 3 },
];

export function AppSidebar() {
  const currentStep = useProjectStore((s) => s.currentStep);
  const location = useLocation();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          OD
        </div>
        <div>
          <h1 className="text-sm font-semibold text-sidebar-foreground">ODOT</h1>
          <p className="text-xs text-sidebar-foreground/60">Vehicle Detection</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {steps.map((s, i) => {
          const isActive = location.pathname === s.path;
          const isCompleted = currentStep > s.step;
          const isAccessible = currentStep >= s.step;
          const Icon = s.icon;

          return (
            <NavLink
              key={s.path}
              to={isAccessible ? s.path : "#"}
              onClick={(e) => !isAccessible && e.preventDefault()}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-primary"
                  : isAccessible
                  ? "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/30 cursor-not-allowed"
              )}
            >
              {/* Step indicator */}
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCompleted
                    ? "border-primary bg-primary/20 text-primary"
                    : isAccessible
                    ? "border-sidebar-foreground/30 text-sidebar-foreground/60"
                    : "border-sidebar-foreground/15 text-sidebar-foreground/20"
                )}
              >
                {isCompleted ? "✓" : i + 1}
              </div>
              <span>{s.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="text-[10px] text-sidebar-foreground/40 leading-relaxed">
          University of Toledo
          <br />
          ODOT Vehicle Detection
        </p>
      </div>
    </aside>
  );
}
