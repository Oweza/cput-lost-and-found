import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CAMPUSES } from "@/lib/items";
import { StatusBadge, TypeBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — CPUT Lost & Found" },
      { name: "description", content: "Campus security: manage reports, verify claims and update item statuses." },
      { property: "og:title", content: "Admin Dashboard — CPUT Lost & Found" },
      { property: "og:description", content: "Campus security: manage reports, verify claims and update item statuses." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const [campus, setCampus] = useState("");

  const { data } = useQuery({
    queryKey: ["admin"],
    enabled: isAdmin,
    queryFn: async () => {
      const [items, claims] = await Promise.all([
        supabase.from("items").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("claims").select("*, items(title, campus, status)").order("created_at", { ascending: false }),
      ]);
      const ids = [...new Set((claims.data ?? []).map((c) => c.claimant_id))];
      const profiles = ids.length ? (await supabase.from("profiles").select("*").in("id", ids)).data ?? [] : [];
      return { items: items.data ?? [], claims: claims.data ?? [], profiles };
    },
  });

  if (loading) return null;
  if (!isAdmin) return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <ShieldAlert className="mx-auto h-12 w-12 text-gold" />
      <h1 className="mt-4 text-2xl font-bold">Campus security only</h1>
      <p className="mt-2 text-muted-foreground">This area is for authorised campus security staff.</p>
    </div>
  );

  const setStatus = async (id: string, status: "active" | "claimed" | "expired") => {
    const { error } = await supabase.from("items").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["admin"] });
  };
  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("claims").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Claim ${status}`);
    qc.invalidateQueries({ queryKey: ["admin"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    await supabase.from("items").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin"] });
  };

  const items = (data?.items ?? []).filter((i) => !campus || i.campus === campus);
  const claims = (data?.claims ?? []) as Array<NonNullable<typeof data>["claims"][number] & { items: { title: string; campus: string } | null }>;
  const pending = claims.filter((c) => c.status === "pending" && (!campus || c.items?.campus === campus));
  const stat = (s: string) => (data?.items ?? []).filter((i) => i.status === s).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">Campus security dashboard</h1>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={campus} onChange={(e) => setCampus(e.target.value)}>
          <option value="">All campuses</option>{CAMPUSES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[["Pending claims", pending.length], ["Active", stat("active")], ["Claimed", stat("claimed")], ["Expired", stat("expired")]].map(([l, v]) => (
          <div key={l} className="rounded-xl border-l-4 border-gold bg-surface p-5"><p className="text-sm text-muted-foreground">{l}</p><p className="font-display text-3xl font-bold text-primary">{v}</p></div>
        ))}
      </div>
      <Tabs defaultValue="claims" className="mt-8">
        <TabsList><TabsTrigger value="claims">Ownership claims</TabsTrigger><TabsTrigger value="reports">All reports</TabsTrigger></TabsList>
        <TabsContent value="claims">
          {pending.length ? (
            <div className="mt-4 space-y-3">
              {pending.map((c) => {
                const p = data?.profiles.find((x) => x.id === c.claimant_id);
                return (
                  <div key={c.id} className="rounded-xl border p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link to="/items/$id" params={{ id: c.item_id }} className="font-bold text-primary hover:underline">{c.items?.title}</Link>
                      <span className="text-xs text-muted-foreground">{c.items?.campus} · {format(new Date(c.created_at), "d MMM yyyy HH:mm")}</span>
                    </div>
                    <p className="mt-1 text-sm">Claimant: <strong>{p?.full_name || "Unknown"}</strong>{p?.student_number && ` (${p.student_number})`}{c.contact && ` · ${c.contact}`}</p>
                    <p className="mt-3 whitespace-pre-line rounded-lg bg-surface p-3 text-sm">{c.proof}</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => decide(c.id, "approved")}>Approve & mark claimed</Button>
                      <Button size="sm" variant="outline" onClick={() => decide(c.id, "rejected")}>Reject</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="mt-4 rounded-xl bg-surface p-8 text-center text-muted-foreground">No pending claims.</p>}
        </TabsContent>
        <TabsContent value="reports">
          <div className="mt-4 overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left"><tr>{["Item", "Type", "Campus", "Date", "Status", ""].map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {items.map((i) => (
                  <tr key={i.id}>
                    <td className="p-3"><Link to="/items/$id" params={{ id: i.id }} className="font-semibold text-primary hover:underline">{i.title}</Link><div className="text-xs text-muted-foreground">{i.category}</div></td>
                    <td className="p-3"><TypeBadge type={i.type} /></td>
                    <td className="p-3">{i.campus}</td>
                    <td className="p-3 whitespace-nowrap">{format(new Date(i.item_date), "d MMM yyyy")}</td>
                    <td className="p-3">
                      <select className="h-8 rounded border border-input bg-background px-2" value={i.status} onChange={(e) => setStatus(i.id, e.target.value as never)}>
                        <option value="active">Active</option><option value="claimed">Claimed</option><option value="expired">Expired</option>
                      </select>
                    </td>
                    <td className="p-3"><Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(i.id)}>Delete</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && <p className="p-6 text-center text-muted-foreground">No reports.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
