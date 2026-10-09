import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Search, ShieldCheck, Upload, MapPin, ArrowRight } from "lucide-react";
import hero from "@/assets/hero-campus.jpg";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CAMPUSES } from "@/lib/items";
import { ItemCard } from "@/components/ItemCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CPUT Lost & Found System — Report & Recover Belongings" },
      { name: "description", content: "Report lost or found items and recover your belongings across all six CPUT campuses." },
      { property: "og:title", content: "CPUT Lost & Found System" },
      { property: "og:description", content: "Report lost or found items and recover your belongings across all six CPUT campuses." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: recent = [] } = useQuery({
    queryKey: ["items", "recent"],
    queryFn: async () => {
      const { data } = await supabase.from("items").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(4);
      return data ?? [];
    },
  });

  return (
    <>
      <section className="relative overflow-hidden">
        <img src={hero} alt="CPUT campus" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-28">
          <span className="inline-block rounded-full bg-gold px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold-foreground">Campus Security Services</span>
          <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-tight text-primary-foreground md:text-6xl">Lost something on campus?</h1>
          <p className="mt-4 max-w-xl text-lg text-primary-foreground/90">Report, search and recover belongings across all six CPUT campuses — fast, safe and verified by campus security.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Link to="/report" search={{ type: "lost" }}>I lost something</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary-foreground bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary">
              <Link to="/report" search={{ type: "found" }}>I found something</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Upload, t: "Report", d: "Post a lost or found item with a photo in under a minute." },
            { icon: Search, t: "Search", d: "Filter by keyword, category, date and campus." },
            { icon: Bell, t: "Get matched", d: "We notify you when a found item matches your report." },
            { icon: ShieldCheck, t: "Claim safely", d: "Security verifies private proof of ownership." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-xl bg-card p-6 shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-gold"><Icon className="h-5 w-5" /></div>
              <h3 className="mt-4 text-lg font-bold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Recently reported</h2>
            <p className="text-muted-foreground">The latest active items across campuses.</p>
          </div>
          <Link to="/items" className="flex shrink-0 items-center gap-1 font-semibold text-secondary hover:underline">View all <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {recent.length ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{recent.map((i) => <ItemCard key={i.id} item={i} />)}</div>
        ) : (
          <p className="mt-6 rounded-xl bg-surface p-8 text-center text-muted-foreground">No items reported yet. Be the first to help a fellow student.</p>
        )}
      </section>

      <section className="bg-primary">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <h2 className="text-2xl font-bold text-primary-foreground md:text-3xl">Six campuses, one system</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAMPUSES.map((c) => (
              <Link key={c} to="/items" search={{ campus: c }} className="flex items-center gap-3 rounded-lg border border-primary-foreground/20 p-4 font-semibold text-primary-foreground hover:bg-primary-foreground/10">
                <MapPin className="h-5 w-5 text-gold" />{c}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
