import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CAMPUSES, CATEGORIES } from "@/lib/items";
import { ItemCard } from "@/components/ItemCard";
import { Input } from "@/components/ui/input";

const searchSchema = z.object({
  q: z.string().optional(),
  type: z.enum(["lost", "found"]).optional(),
  category: z.string().optional(),
  campus: z.string().optional(),
  from: z.string().optional(),
  status: z.enum(["active", "claimed", "expired"]).optional(),
});

export const Route = createFileRoute("/items/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Browse Lost & Found Items — CPUT" },
      { name: "description", content: "Search lost and found items by keyword, category, date and campus." },
      { property: "og:title", content: "Browse Lost & Found Items — CPUT" },
      { property: "og:description", content: "Search lost and found items by keyword, category, date and campus." },
    ],
  }),
  component: Browse,
});

const sel = "h-10 rounded-md border border-input bg-background px-3 text-sm";

function Browse() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/items/" });
  const set = (patch: Partial<typeof s>) => navigate({ search: (p) => ({ ...p, ...patch }), replace: true });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["items", s],
    queryFn: async () => {
      let q = supabase.from("items").select("*").order("created_at", { ascending: false }).limit(100);
      q = q.eq("status", s.status ?? "active");
      if (s.type) q = q.eq("type", s.type);
      if (s.category) q = q.eq("category", s.category);
      if (s.campus) q = q.eq("campus", s.campus);
      if (s.from) q = q.gte("item_date", s.from);
      if (s.q) {
        const term = s.q.replace(/[%,()]/g, " ").trim();
        if (term) q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%,location.ilike.%${term}%`);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-bold">Browse items</h1>
      <div className="mt-6 grid gap-3 rounded-xl bg-surface p-4 md:grid-cols-[2fr_repeat(5,1fr)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="bg-background pl-9" placeholder="Search keyword…" defaultValue={s.q} maxLength={80}
            onChange={(e) => set({ q: e.target.value || undefined })} />
        </div>
        <select className={sel} value={s.type ?? ""} onChange={(e) => set({ type: (e.target.value || undefined) as never })}>
          <option value="">Lost & found</option><option value="lost">Lost</option><option value="found">Found</option>
        </select>
        <select className={sel} value={s.category ?? ""} onChange={(e) => set({ category: e.target.value || undefined })}>
          <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className={sel} value={s.campus ?? ""} onChange={(e) => set({ campus: e.target.value || undefined })}>
          <option value="">All campuses</option>{CAMPUSES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className={sel} value={s.status ?? "active"} onChange={(e) => set({ status: e.target.value as never })}>
          <option value="active">Active</option><option value="claimed">Claimed</option><option value="expired">Expired</option>
        </select>
        <Input type="date" className="bg-background" value={s.from ?? ""} title="From date" onChange={(e) => set({ from: e.target.value || undefined })} />
      </div>
      {isLoading ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : items.length ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{items.map((i) => <ItemCard key={i.id} item={i} />)}</div>
      ) : (
        <p className="mt-8 rounded-xl bg-surface p-10 text-center text-muted-foreground">No items match your filters.</p>
      )}
    </div>
  );
}
