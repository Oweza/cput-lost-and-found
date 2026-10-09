import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Download, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CAMPUSES } from "@/lib/items";
import { StatusBadge, TypeBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — CPUT Lost & Found" },
      { name: "description", content: "Campus security: manage reports, verify claims, users, disputes, settings and reports." },
      { property: "og:title", content: "Admin Dashboard — CPUT Lost & Found" },
      { property: "og:description", content: "Campus security: manage reports, verify claims, users, disputes, settings and reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

const sel = "h-10 rounded-md border border-input bg-background px-3 text-sm";

function Admin() {
  const { user, isAdmin, campuses, isStaff, loading } = useAuth();
  const qc = useQueryClient();
  const [campus, setCampus] = useState("");

  const { data } = useQuery({
    queryKey: ["admin", isAdmin, campuses.join()],
    enabled: isStaff,
    queryFn: async () => {
      const [items, claims] = await Promise.all([
        supabase.from("items").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("claims").select("*, items(title, campus, status)").order("created_at", { ascending: false }),
      ]);
      const ids = [...new Set((claims.data ?? []).map((c) => c.claimant_id))];
      const profiles = ids.length ? (await supabase.from("profiles").select("*").in("id", ids)).data ?? [] : [];
      return { items: items.data ?? [], claims: claims.data ?? [], profiles };
    },
  });

  if (loading) return null;
  if (!isStaff) return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <ShieldAlert className="mx-auto h-12 w-12 text-gold" />
      <h1 className="mt-4 text-2xl font-bold">Campus security only</h1>
      <p className="mt-2 text-muted-foreground">This area is for authorised campus administrators.</p>
    </div>
  );

  const allowed = isAdmin ? CAMPUSES : campuses;
  const inScope = (c?: string | null) => !!c && allowed.includes(c) && (!campus || c === campus);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });

  const setStatus = async (id: string, status: "active" | "claimed" | "expired") => {
    const { error } = await supabase.from("items").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status updated"); refresh();
  };
  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("claims").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Claim ${status}`); refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const items = (data?.items ?? []).filter((i) => inScope(i.campus));
  const claims = (data?.claims ?? []) as Array<NonNullable<typeof data>["claims"][number] & { items: { title: string; campus: string } | null }>;
  const pending = claims.filter((c) => c.status === "pending" && inScope(c.items?.campus));
  const stat = (s: string) => items.filter((i) => i.status === s).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{isAdmin ? "System administrator" : `Campus administrator · ${campuses.join(", ")}`}</p>
          <h1 className="text-3xl font-bold">Campus security dashboard</h1>
        </div>
        <select className={sel} value={campus} onChange={(e) => setCampus(e.target.value)}>
          <option value="">{isAdmin ? "All campuses" : "All my campuses"}</option>{allowed.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[["Pending claims", pending.length], ["Active", stat("active")], ["Claimed", stat("claimed")], ["Expired", stat("expired")]].map(([l, v]) => (
          <div key={l} className="rounded-xl border-l-4 border-gold bg-surface p-5"><p className="text-sm text-muted-foreground">{l}</p><p className="font-display text-3xl font-bold text-primary">{v}</p></div>
        ))}
      </div>
      <Tabs defaultValue="claims" className="mt-8">
        <TabsList className="flex-wrap">
          <TabsTrigger value="claims">Ownership claims</TabsTrigger>
          <TabsTrigger value="reports">Item reports</TabsTrigger>
          <TabsTrigger value="stats">Generate reports</TabsTrigger>
          {isAdmin && <><TabsTrigger value="users">User accounts</TabsTrigger><TabsTrigger value="disputes">Disputes</TabsTrigger><TabsTrigger value="settings">Settings</TabsTrigger></>}
        </TabsList>
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
          ) : <Empty text="No pending claims." />}
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
        <TabsContent value="stats"><StatsPanel items={items} claims={claims.filter((c) => inScope(c.items?.campus))} campuses={campus ? [campus] : allowed} /></TabsContent>
        {isAdmin && <>
          <TabsContent value="users"><UsersPanel selfId={user?.id} /></TabsContent>
          <TabsContent value="disputes"><DisputesPanel /></TabsContent>
          <TabsContent value="settings"><SettingsPanel /></TabsContent>
        </>}
      </Tabs>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-4 rounded-xl bg-surface p-8 text-center text-muted-foreground">{text}</p>;
}

type AnyItem = { id: string; title: string; type: string; category: string; campus: string; status: string; item_date: string; created_at: string };
function StatsPanel({ items, claims, campuses }: { items: AnyItem[]; claims: { status: string }[]; campuses: string[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const list = items.filter((i) => (!from || i.created_at >= from) && (!to || i.created_at.slice(0, 10) <= to));
  const recovered = list.filter((i) => i.status === "claimed").length;
  const csv = () => {
    const rows = [["Title", "Type", "Category", "Campus", "Status", "Item date", "Reported"], ...list.map((i) => [i.title, i.type, i.category, i.campus, i.status, i.item_date, i.created_at.slice(0, 10)])];
    const blob = new Blob([rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `lost-found-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };
  return (
    <div className="mt-4 space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <Button onClick={csv}><Download className="h-4 w-4" />Download CSV</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {[["Total reports", list.length], ["Lost", list.filter((i) => i.type === "lost").length], ["Found", list.filter((i) => i.type === "found").length], ["Recovery rate", list.length ? `${Math.round((recovered / list.length) * 100)}%` : "–"]].map(([l, v]) => (
          <div key={l} className="rounded-xl border bg-surface p-5"><p className="text-sm text-muted-foreground">{l}</p><p className="font-display text-2xl font-bold text-primary">{v}</p></div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left"><tr>{["Campus", "Lost", "Found", "Active", "Claimed", "Expired"].map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {campuses.map((c) => {
              const ci = list.filter((i) => i.campus === c);
              const n = (f: (i: AnyItem) => boolean) => ci.filter(f).length;
              return <tr key={c}><td className="p-3 font-semibold">{c}</td><td className="p-3">{n((i) => i.type === "lost")}</td><td className="p-3">{n((i) => i.type === "found")}</td><td className="p-3">{n((i) => i.status === "active")}</td><td className="p-3">{n((i) => i.status === "claimed")}</td><td className="p-3">{n((i) => i.status === "expired")}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">Claims: {claims.length} total · {claims.filter((c) => c.status === "approved").length} approved · {claims.filter((c) => c.status === "rejected").length} rejected · {claims.filter((c) => c.status === "pending").length} pending</p>
    </div>
  );
}

function UsersPanel({ selfId }: { selfId?: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});
  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [p, r, c] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
        supabase.from("campus_admins").select("*"),
      ]);
      return { profiles: p.data ?? [], roles: r.data ?? [], campus: c.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await p; if (error) return toast.error(error.message); toast.success(ok); refresh();
  };
  const list = (data?.profiles ?? []).filter((p) => !q || `${p.full_name} ${p.student_number ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mt-4 space-y-3">
      <Input placeholder="Search by name or student/staff number" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left"><tr>{["User", "Joined", "System admin", "Campus admin for", ""].map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {list.map((p) => {
              const admin = data?.roles.some((r) => r.user_id === p.id && r.role === "admin");
              const mine = data?.campus.filter((c) => c.user_id === p.id) ?? [];
              return (
                <tr key={p.id}>
                  <td className="p-3"><p className="font-semibold">{p.full_name || "Unnamed"}</p><p className="text-xs text-muted-foreground">{p.student_number || "—"}</p></td>
                  <td className="p-3 whitespace-nowrap">{format(new Date(p.created_at), "d MMM yyyy")}</td>
                  <td className="p-3"><Switch checked={!!admin} disabled={p.id === selfId} onCheckedChange={(v) => run(
                    v ? supabase.from("user_roles").insert({ user_id: p.id, role: "admin" }) : supabase.from("user_roles").delete().eq("user_id", p.id).eq("role", "admin"),
                    v ? "Made system admin" : "Admin access removed")} /></td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {mine.map((c) => (
                        <button key={c.id} onClick={() => run(supabase.from("campus_admins").delete().eq("id", c.id), "Campus removed")} className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold" title="Remove">{c.campus} ×</button>
                      ))}
                      {!mine.length && <span className="text-xs text-muted-foreground">None</span>}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <select className="h-8 rounded border border-input bg-background px-2" value={pick[p.id] ?? ""} onChange={(e) => setPick({ ...pick, [p.id]: e.target.value })}>
                        <option value="">Assign campus…</option>{CAMPUSES.filter((c) => !mine.some((m) => m.campus === c)).map((c) => <option key={c}>{c}</option>)}
                      </select>
                      <Button size="sm" variant="outline" disabled={!pick[p.id]} onClick={() => { run(supabase.from("campus_admins").insert({ user_id: p.id, campus: pick[p.id] }), "Campus assigned"); setPick({ ...pick, [p.id]: "" }); }}>Add</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!list.length && <p className="p-6 text-center text-muted-foreground">No users found.</p>}
      </div>
    </div>
  );
}

function DisputesPanel() {
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { data } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data: d } = await supabase.from("disputes").select("*, items(title, campus)").order("created_at", { ascending: false });
      const ids = [...new Set((d ?? []).map((x) => x.raised_by))];
      const profiles = ids.length ? (await supabase.from("profiles").select("id, full_name, student_number").in("id", ids)).data ?? [] : [];
      return { disputes: d ?? [], profiles };
    },
  });
  const resolve = async (id: string, status: "resolved" | "dismissed") => {
    const { error } = await supabase.from("disputes").update({ status, resolution: (notes[id] ?? "").trim().slice(0, 1000), resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Dispute ${status}`); qc.invalidateQueries({ queryKey: ["admin-disputes"] });
  };
  if (!data?.disputes.length) return <Empty text="No disputes have been raised." />;
  return (
    <div className="mt-4 space-y-3">
      {data.disputes.map((d) => {
        const p = data.profiles.find((x) => x.id === d.raised_by);
        const it = (d as { items?: { title: string; campus: string } }).items;
        return (
          <div key={d.id} className="rounded-xl border p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link to="/items/$id" params={{ id: d.item_id }} className="font-bold text-primary hover:underline">{it?.title ?? "Item"}</Link>
              <span className="text-xs text-muted-foreground">{it?.campus} · {format(new Date(d.created_at), "d MMM yyyy HH:mm")} · <span className="font-semibold uppercase">{d.status}</span></span>
            </div>
            <p className="mt-1 text-sm">Raised by <strong>{p?.full_name || "Unknown"}</strong>{p?.student_number && ` (${p.student_number})`}</p>
            <p className="mt-3 whitespace-pre-line rounded-lg bg-surface p-3 text-sm">{d.reason}</p>
            {d.status === "open" ? (
              <div className="mt-3 space-y-2">
                <Textarea rows={2} maxLength={1000} placeholder="Resolution note sent to the user" value={notes[d.id] ?? ""} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })} />
                <div className="flex gap-2"><Button size="sm" onClick={() => resolve(d.id, "resolved")}>Resolve</Button><Button size="sm" variant="outline" onClick={() => resolve(d.id, "dismissed")}>Dismiss</Button></div>
              </div>
            ) : d.resolution && <p className="mt-2 text-sm text-muted-foreground">Resolution: {d.resolution}</p>}
          </div>
        );
      })}
    </div>
  );
}

function SettingsPanel() {
  const { data, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [days, setDays] = useState(30);
  const [msg, setMsg] = useState(true);
  const [email, setEmail] = useState("");
  useEffect(() => { if (data) { setDays(data.expiry_days); setMsg(data.messaging_enabled); setEmail(data.support_email); } }, [data]);
  const save = async () => {
    if (days < 1 || days > 365) return toast.error("Archive period must be 1–365 days.");
    const { error } = await supabase.from("app_settings").upsert({ id: 1, expiry_days: days, messaging_enabled: msg, support_email: email.trim().slice(0, 255), updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Settings saved"); refetch();
  };
  return (
    <div className="mt-4 max-w-lg space-y-5 rounded-xl border p-6">
      <div><Label htmlFor="days">Auto-archive unclaimed reports after (days)</Label><Input id="days" type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} /></div>
      <div className="flex items-center justify-between"><Label htmlFor="msg">Allow in-app messaging between users</Label><Switch id="msg" checked={msg} onCheckedChange={setMsg} /></div>
      <div><Label htmlFor="email">Campus security contact email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="security@cput.ac.za" /></div>
      <Button onClick={save}>Save settings</Button>
    </div>
  );
}
