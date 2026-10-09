import { Link } from "@tanstack/react-router";
import { Calendar, MapPin, Package } from "lucide-react";
import { format } from "date-fns";
import { usePhotoUrl, type Item } from "@/lib/items";
import { StatusBadge, TypeBadge } from "./Badges";

export function ItemCard({ item }: { item: Item }) {
  const url = usePhotoUrl(item.photo_url);
  return (
    <Link
      to="/items/$id"
      params={{ id: item.id }}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-card transition hover:-translate-y-0.5"
    >
      <div className="relative aspect-[4/3] bg-surface">
        {url ? (
          <img src={url} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Package className="h-12 w-12" />
          </div>
        )}
        <div className="absolute left-3 top-3"><TypeBadge type={item.type} /></div>
        <div className="absolute right-3 top-3"><StatusBadge status={item.status} /></div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">{item.category}</span>
        <h3 className="line-clamp-1 text-lg font-bold group-hover:text-secondary">{item.title}</h3>
        <div className="mt-auto space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0" />{item.campus}{item.location && ` · ${item.location}`}</p>
          <p className="flex items-center gap-1.5"><Calendar className="h-4 w-4 shrink-0" />{format(new Date(item.item_date), "d MMM yyyy")}</p>
        </div>
      </div>
    </Link>
  );
}
