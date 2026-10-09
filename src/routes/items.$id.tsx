import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Calendar, MapPin, Package, ShieldCheck, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePhotoUrl } from "@/lib/items";
import { useAuth } from "@/lib/auth";
import { StatusBadge, TypeBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/items/$id")({
  head: () => ({
    meta: [
      { title: "Item details — CPUT Lost & Found" },
      { name: "description", content: "View item details and request to claim it with proof of ownership." },
      { property: "og:title", content: "Item details — CPUT Lost & Found" },
      { property: "og:description", content: "View item details and request to claim it with proof of ownership." },
    ],
  }),
  component: ItemPage,
});

function ItemPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: item, isLoading } = useQuery({
    queryKey: ["item", id],
    queryFn: async () => (await supabase.from("items").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: myClaim } = useQuery({
    queryKey: ["myclaim", id, user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("claims").select("*").eq("item_id", id).eq("claimant_id", user!.id).maybeSingle()).data,
  });
  const url = usePhotoUrl(item?.photo_url);
  const [proof, setProof] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoading) return <p className="mx-auto max-w-5xl px-4 py-10 text-muted-foreground">Loading…</p>;
  if (!item) return <p className="mx-auto max-w-5xl px-4 py-10">Item not found.</p>;

  const submitClaim = async () => {
    if (proof.trim().length < 10) { toast.error("Please describe your proof of ownership (at least 10 characters)."); return; }
    setBusy(true);
    const { error } = await supabase.from("claims").insert({ item_id: id, claimant_id: user!.id, proof: proof.trim().slice(0, 2000), contact: contact.trim().slice(0, 100) });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Claim submitted. Campus security will review it.");
    qc.invalidateQueries({ queryKey: ["myclaim", id] });
  };

  const isOwner = user?.id === item.user_id;
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-2">
      <div className="overflow-hidden rounded-2xl bg-surface">
        {url ? <img src={url} alt={item.title} className="h-full max-h-[520px] w-full object-cover" /> :
          <div className="flex aspect-square items-center justify-center text-muted-foreground"><Package className="h-20 w-20" /></div>}
      </div>
      <div>
        <div className="flex gap-2"><TypeBadge type={item.type} /><StatusBadge status={item.status} /></div>
        <h1 className="mt-3 text-3xl font-bold">{item.title}</h1>
        <div className="mt-4 space-y-2 text-sm">
          <p className="flex items-center gap-2"><Tag className="h-4 w-4 text-secondary" />{item.category}</p>
          <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-secondary" />{item.campus}{item.location && ` · ${item.location}`}</p>
          <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-secondary" />{item.type === "lost" ? "Lost on" : "Found on"} {format(new Date(item.item_date), "d MMMM yyyy")}</p>
        </div>
        {item.description && <p className="mt-5 whitespace-pre-line leading-relaxed">{item.description}</p>}
        {item.status === "expired" && <p className="mt-5 rounded-xl bg-surface p-4 text-sm text-muted-foreground">This report was archived automatically after 30 days without being claimed.</p>}
        {user && !isOwner && item.status === "active" && (
          <Button asChild variant="outline" className="mt-5">
            <Link to="/messages" search={{ item: item.id, with: item.user_id }}>Message reporter</Link>
          </Button>
        )}

        {item.type === "found" && item.status === "active" && !isOwner && (
          <div className="mt-8 rounded-xl border bg-surface p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-gold" />Is this yours?</h2>
            {!user ? (
              <p className="mt-2 text-sm">
                <Link to="/auth" className="font-semibold text-secondary hover:underline">Sign in</Link> to request this item.
              </p>
            ) : myClaim ? (
              <p className="mt-2 flex items-center gap-2 text-sm">Your claim status: <StatusBadge status={myClaim.status} /></p>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-muted-foreground">Describe something only the owner would know (e.g. lock-screen image, contents, serial number, marks). Only campus security can see this.</p>
                <div><Label htmlFor="proof">Private proof of ownership</Label><Textarea id="proof" rows={4} maxLength={2000} value={proof} onChange={(e) => setProof(e.target.value)} className="bg-background" /></div>
                <div><Label htmlFor="contact">Phone number (optional)</Label><Input id="contact" maxLength={100} value={contact} onChange={(e) => setContact(e.target.value)} className="bg-background" /></div>
                <Button onClick={submitClaim} disabled={busy}>Submit claim</Button>
              </div>
            )}
          </div>
        )}
        {item.type === "lost" && item.status === "active" && !isOwner && (
          <div className="mt-8 rounded-xl border bg-surface p-5 text-sm">
            Found this item? Hand it in at the {item.campus} campus security office and{" "}
            <Link to="/report" search={{ type: "found" }} className="font-semibold text-secondary hover:underline">report it as found</Link>.
          </div>
        )}
      </div>
    </div>
  );
}
