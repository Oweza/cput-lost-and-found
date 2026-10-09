import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CAMPUSES, CATEGORIES, uploadPhoto } from "@/lib/items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/report")({
  validateSearch: z.object({ type: z.enum(["lost", "found"]).optional() }),
  head: () => ({
    meta: [
      { title: "Report an Item — CPUT Lost & Found" },
      { name: "description", content: "Report a lost or found item on any CPUT campus." },
      { property: "og:title", content: "Report an Item — CPUT Lost & Found" },
      { property: "og:description", content: "Report a lost or found item on any CPUT campus." },
    ],
  }),
  component: Report,
});

const schema = z.object({
  title: z.string().trim().min(2, "Enter an item name").max(120),
  category: z.string().min(1, "Choose a category"),
  description: z.string().trim().max(2000),
  item_date: z.string().min(1, "Choose a date"),
  campus: z.string().min(1, "Choose a campus"),
  location: z.string().trim().max(150),
});
const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function Report() {
  const search = Route.useSearch();
  const [type, setType] = useState<"lost" | "found">(search.type ?? "lost");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(f));
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid input"); return; }
    const file = f.get("photo") as File | null;
    if (file && file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5MB"); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again");
      const photo_url = file && file.size > 0 ? await uploadPhoto(user.id, file) : null;
      const { data, error } = await supabase.from("items").insert({ ...parsed.data, type, photo_url, user_id: user.id }).select("id").single();
      if (error) throw error;
      toast.success("Report submitted!");
      navigate({ to: "/items/$id", params: { id: data.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold">Report an item</h1>
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-surface p-1">
        {(["lost", "found"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)}
            className={cn("rounded-lg py-2.5 font-semibold capitalize", type === t ? "bg-primary text-primary-foreground" : "text-foreground")}>
            I {t} an item
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border bg-card p-6 shadow-card">
        <div><Label htmlFor="title">Item name</Label><Input id="title" name="title" required maxLength={120} placeholder="e.g. Black Samsung phone" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="category">Category</Label>
            <select id="category" name="category" className={sel} required defaultValue=""><option value="" disabled>Select…</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><Label htmlFor="item_date">Date {type}</Label><Input id="item_date" name="item_date" type="date" required max={new Date().toISOString().slice(0, 10)} /></div>
          <div><Label htmlFor="campus">Campus</Label>
            <select id="campus" name="campus" className={sel} required defaultValue=""><option value="" disabled>Select…</option>{CAMPUSES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><Label htmlFor="location">Location on campus</Label><Input id="location" name="location" maxLength={150} placeholder="e.g. Library, 2nd floor" /></div>
        </div>
        <div><Label htmlFor="description">Description</Label><Textarea id="description" name="description" rows={4} maxLength={2000} placeholder={type === "found" ? "Describe the item, but keep identifying details private for verification." : "Colour, brand, distinguishing marks…"} /></div>
        <div><Label htmlFor="photo">Photo (optional, max 5MB)</Label><Input id="photo" name="photo" type="file" accept="image/*" /></div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Submitting…" : `Submit ${type} report`}</Button>
      </form>
    </div>
  );
}
