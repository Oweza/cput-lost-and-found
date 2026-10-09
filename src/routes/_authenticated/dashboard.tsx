import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ItemCard } from "@/components/ItemCard";
import { StatusBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My Dashboard — CPUT Lost & Found" },
      { name: "description", content: "Your reports, potential matches, claims and notifications." },
      { property: "og:title", content: "My Dashboard — CPUT Lost & Found" },
      { property: "og:description", content: "Your reports, potential matches, claims and notifications." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user!.id;
      const [profile, items, claims, notes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("items").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("claims").select("*, items(title)").eq("claimant_id", uid).order("created_at", { ascending: false }),
        supabase.from("notifications").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(50),
      ]);
      const mine = items.data ?? [];
      const lost = mine.filter((i) => i.type === "lost" && i.status === "active");
      let matches: typeof mine = [];
      if (lost.length) {
        const { data: found } = await supabase.from("items").select("*").eq("type", "found").eq("status", "active")
          .in("category", [...new Set(lost.map((l) => l.category))]).neq("user_id", uid).limit(60);
        matches = (found ?? []).filter((f) => lost.some((l) => l.category === f.category && l.campus === f.campus));
      }
      return { profile: profile.data, items: mine, claims: claims.data ?? [], notes: notes.data ?? [], matches };
    },
  });

  const markAll = async () => {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const raiseDispute = async (itemId: string, claimId: string) => {
    const reason = prompt("Explain why you are disputing this decision (at least 10 characters):")?.trim();
    if (!reason) return;
    if (reason.length < 10) { toast.error("Please give more detail (at least 10 characters)."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("disputes").insert({ item_id: itemId, claim_id: claimId, raised_by: user!.id, reason: reason.slice(0, 2000) });
    if (error) { toast.error(error.message); return; }
    toast.success("Dispute sent to campus security.");
  };

  const unread = data?.notes.filter((n) => !n.read).length ?? 0;
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="text-3xl font-bold">{data?.profile?.full_name || "My dashboard"}</h1>
        </div>
        <Button asChild><Link to="/report">Report an item</Link></Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[["My reports", data?.items.length], ["Potential matches", data?.matches.length], ["My claims", data?.claims.length], ["Unread alerts", unread]].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border-l-4 border-gold bg-surface p-5">
            <p className="text-sm text-muted-foreground">{l}</p><p className="font-display text-3xl font-bold text-primary">{v ?? "–"}</p>
          </div>
        ))}
      </div>
      <Tabs defaultValue={unread ? "notifications" : "reports"} className="mt-8">
        <TabsList className="flex-wrap">
          <TabsTrigger value="reports">My reports</TabsTrigger>
          <TabsTrigger value="matches">Potential matches</TabsTrigger>
          <TabsTrigger value="claims">My claims</TabsTrigger>
          <TabsTrigger value="notifications">Notifications {unread > 0 && `(${unread})`}</TabsTrigger>
        </TabsList>
        <TabsContent value="reports">
          {data?.items.length ? <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{data.items.map((i) => <ItemCard key={i.id} item={i} />)}</div>
            : <Empty text="You haven't reported anything yet." />}
        </TabsContent>
        <TabsContent value="matches">
          <p className="mt-2 text-sm text-muted-foreground">Found items in the same category and campus as your active lost reports.</p>
          {data?.matches.length ? <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{data.matches.map((i) => <ItemCard key={i.id} item={i} />)}</div>
            : <Empty text="No potential matches right now. We'll notify you when one appears." />}
        </TabsContent>
        <TabsContent value="claims">
          {data?.claims.length ? (
            <ul className="mt-4 divide-y rounded-xl border">
              {data.claims.map((c) => (
                <li key={c.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Link to="/items/$id" params={{ id: c.item_id }} className="min-w-0 truncate font-semibold text-primary hover:underline">{(c as { items?: { title: string } }).items?.title ?? "Item"}</Link>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.status} />
                      {c.status !== "pending" && <Button size="sm" variant="ghost" onClick={() => raiseDispute(c.item_id, c.id)}>Dispute</Button>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty text="You haven't claimed any items." />}
        </TabsContent>
        <TabsContent value="notifications">
          {unread > 0 && <Button variant="outline" size="sm" className="mt-2" onClick={markAll}><CheckCheck className="h-4 w-4" />Mark all read</Button>}
          {data?.notes.length ? (
            <ul className="mt-4 space-y-2">
              {data.notes.map((n) => (
                <li key={n.id} className={`flex gap-3 rounded-xl p-4 ${n.read ? "bg-background border" : "bg-accent"}`}>
                  <Bell className={`mt-0.5 h-5 w-5 shrink-0 ${n.read ? "text-muted-foreground" : "text-secondary"}`} />
                  <div className="min-w-0">
                    <p className="text-sm">{n.message}</p>
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                      {n.item_id && <Link to="/items/$id" params={{ id: n.item_id }} className="font-semibold text-secondary hover:underline">View item</Link>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty text="No notifications yet." />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-4 rounded-xl bg-surface p-8 text-center text-muted-foreground">{text}</p>;
}
