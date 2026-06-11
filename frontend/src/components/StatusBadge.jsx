import React from "react";
import { cn } from "../lib/utils";

const TONES = {
    available: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/40",
    issued: "bg-primary/15 text-primary border-primary/40",
    returned: "bg-chart-5/15 text-chart-5 border-chart-5/40",
    archived: "bg-muted text-muted-foreground border-border",
    overdue: "bg-accent/15 text-accent border-accent/40",
    damaged: "bg-destructive/15 text-destructive border-destructive/40",
    default: "bg-muted text-muted-foreground border-border",
};

export default function StatusBadge({ status, className }) {
    const key = (status || "").toLowerCase();
    let tone = TONES.default;
    if (key === "available") tone = TONES.available;
    else if (key === "issued") tone = TONES.issued;
    else if (key === "returned") tone = TONES.returned;
    else if (key === "archived") tone = TONES.archived;
    else if (key === "damaged" || key === "missing swatches") tone = TONES.damaged;
    else if (key === "overdue") tone = TONES.overdue;
    return (
        <span
            data-testid={`status-${key}`}
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
                tone,
                className
            )}
        >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {status || "—"}
        </span>
    );
}
