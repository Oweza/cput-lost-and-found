import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const search = z.object({ item: z.string().optional(), with: z.string().optional() });

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Messages — CPUT Lost & Found" },
      { name: "description", content: "Chat privately about lost and found items without sharing personal contact details." },
      { property: "og:title", content: "Messages — CPUT Lost & Found" },
      { property: "og:description", content: "Chat privately about lost and found items without sharing personal contact details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Messages,
});

type Msg = { id: string; item_id: string; sender_id: string; recipient_id: string; body: string; read: boolean; created_at: string; items: { title: string; user_id: string } | null };

function Messages() {
  const { user } = useAuth();
  const sp = Route.useSearch();
  const nav = Route.useNavigate();
  const qc = useQueryClient();
  const uid = user?.id;
  const { data: msgs = [] } = useQuery({
    queryKey: ["messages", uid],
    enabled: !!uid,
    refetchInterval: 5000,
    queryFn: async () => ((await supabase.from("messages").select("*, items(title, user_id)").order("created_at")).data ?? []) as Msg[],
  });

  const threads = useMemo(() => {
    const map = new Map<string, { item: string; other: string; title: string; last: Msg; unread: number; ownerIsOther: boolean }>();
    for (const m of msgs) {
      const other = m.sender_id === uid ? m.recipient_id : m.sender_id;
      const k = `${m.item_id}|${other}`;
      const t = map.get(k) ?? { item: m.item_id, other, title: m.items?.title ?? "Item", last: m, unread: 0, ownerIsOther: m.items?.user_id === other };
      t.last = m;
      if (m.recipient_id === uid && !m.read) t.unread++;
      map.set(k, t);
    }
    return [...map.values()].sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
  }, [msgs, uid]);

  const active = sp.item && sp.with ? { item: sp.item, other: sp.with } : threads[0] ? { item: threads[0].item, other: threads[0].other } : null;
  const convo = active ? msgs.filter((m) => m.item_id === active.item && (m.sender_id === active.other || m.recipient_id === active.other)) : [];
  const { data: itemInfo } = useQuery({
    queryKey: ["item-title", active?.item],
    enabled: !!active,
    queryFn: async () => (await supabase.from("items").select("title,user_id").eq("id", active!.item).maybeSingle()).data,
  });

  useEffect(() => {
    const ids = convo.filter((m) => m.recipient_id === uid && !m.read).map((m) => m.id);
    if (ids.length) supabase.from("messages").update({ read: true }).in("id", ids).then(() => qc.invalidateQueries({ queryKey: ["messages"] }));
  }, [convo.length, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const [body, setBody] = useState("");
  const send = async () => {
    if (!active || !body.trim()) return;
    const { error } = await supabase.from("messages").insert({ item_id: active.item, sender_id: uid!, recipient_id: active.other, body: body.trim().slice(0, 2000) });
    if (error) { toast.error("Message could not be sent."); return; }
    setBody("");
    qc.invalidateQueries({ queryKey: ["messages"] });
  };

  const label = (other: string, ownerId?: string) => (ownerId === other ? "Item reporter" : "Interested student");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Messages</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your name, email and phone number are never shown to the other person.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-[300px_1fr]">
        <ul className="divide-y rounded-xl border">
          {threads.length === 0 && !active && <li className="p-6 text-sm text-muted-foreground">No conversations yet. Open an item and tap "Message reporter".</li>}
          {threads.map((t) => {
            const sel = active?.item === t.item && active.other === t.other;
            return (
              <li key={t.item + t.other}>
                <button onClick={() => nav({ search: { item: t.item, with: t.other } })} className={`w-full p-4 text-left hover:bg-surface ${sel ? "bg-surface" : ""}`}>
                  <div className="flex justify-between gap-2"><p className="truncate font-semibold text-primary">{t.title}</p>{t.unread > 0 && <span className="rounded-full bg-gold px-2 text-xs font-bold text-gold-foreground">{t.unread}</span>}</div>
                  <p className="text-xs text-muted-foreground">{t.ownerIsOther ? "Item reporter" : "Interested student"}</p>
                  <p className="mt-1 truncate text-sm">{t.last.body}</p>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex min-h-[420px] flex-col rounded-xl border">
          {active ? (
            <>
              <div className="border-b p-4">
                <Link to="/items/$id" params={{ id: active.item }} className="font-semibold text-primary hover:underline">{itemInfo?.title ?? "Item"}</Link>
                <p className="text-xs text-muted-foreground">Chatting with: {label(active.other, itemInfo?.user_id)}</p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {convo.length === 0 && <p className="flex items-center gap-2 text-sm text-muted-foreground"><MessageSquare className="h-4 w-4" />Start the conversation.</p>}
                {convo.map((m) => (
                  <div key={m.id} className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${m.sender_id === uid ? "ml-auto bg-primary text-primary-foreground" : "bg-surface"}`}>
                    <p className="whitespace-pre-line">{m.body}</p>
                    <p className="mt-1 text-[10px] opacity-70">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 border-t p-3">
                <Textarea rows={2} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" className="bg-background" />
                <Button onClick={send} disabled={!body.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
              </div>
            </>
          ) : <p className="m-auto text-sm text-muted-foreground">Select a conversation.</p>}
        </div>
      </div>
    </div>
  );
}
