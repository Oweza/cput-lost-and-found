import { cn } from "@/lib/utils";

export function TypeBadge({ type }: { type: "lost" | "found" }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
      type === "lost" ? "bg-gold text-gold-foreground" : "bg-secondary text-secondary-foreground")}>
      {type}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
      status === "active" && "bg-success text-primary-foreground",
      status === "claimed" && "bg-primary text-primary-foreground",
      (status === "expired" || status === "rejected") && "bg-muted-foreground text-primary-foreground",
      status === "pending" && "bg-gold text-gold-foreground",
      status === "approved" && "bg-success text-primary-foreground")}>
      {status}
    </span>
  );
}
