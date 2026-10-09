import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "@/assets/cput-logo.png.asset.json";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return setUnread(0);
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false)
      .then(({ count }) => setUnread(count ?? 0));
  }, [user]);

  const links = [
    { to: "/items", label: "Browse Items" },
    { to: "/report", label: "Report Item" },
    ...(user ? [{ to: "/dashboard", label: "My Dashboard" }] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Admin" }] : []),
  ] as const;

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="h-1 bg-gold" />
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src={logo.url} alt="CPUT logo" className="h-14 w-auto shrink-0" />
          <div className="hidden border-l pl-3 sm:block">
            <p className="font-display text-sm font-bold leading-tight text-primary">Lost &amp; Found</p>
            <p className="text-xs text-muted-foreground">Campus Security Services</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="rounded-md px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface hover:text-primary"
              activeProps={{ className: "text-primary bg-surface" }}>{l.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/dashboard" className="relative rounded-full p-2 text-primary hover:bg-surface" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-xs font-bold text-gold-foreground">{unread}</span>}
              </Link>
              <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={signOut}>Sign out</Button>
            </>
          ) : (
            <Button asChild size="sm" className="hidden sm:inline-flex"><Link to="/auth">Sign in</Link></Button>
          )}
          <button className="rounded-md p-2 text-primary lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t bg-background px-4 py-3 lg:hidden">
          {links.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 font-semibold hover:bg-surface">{l.label}</Link>
          ))}
          {user ? (
            <button onClick={signOut} className="block w-full rounded-md px-3 py-2.5 text-left font-semibold text-destructive hover:bg-surface">Sign out</button>
          ) : (
            <Link to="/auth" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 font-semibold text-secondary hover:bg-surface">Sign in / Register</Link>
          )}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="font-display text-lg font-bold">CPUT Lost &amp; Found</p>
          <p className="mt-2 text-sm opacity-80">Helping students and staff reunite with their belongings across all six campuses.</p>
        </div>
        <div>
          <p className="font-semibold text-gold">Campuses</p>
          <p className="mt-2 text-sm opacity-80">Bellville · District Six · Mowbray · Granger Bay · Wellington · Athlone</p>
        </div>
        <div>
          <p className="font-semibold text-gold">Collecting an item?</p>
          <p className="mt-2 text-sm opacity-80">Bring your student or staff card to the campus security office once your claim is approved.</p>
        </div>
      </div>
      <div className="border-t border-primary-foreground/15 py-4 text-center text-xs opacity-70">© {new Date().getFullYear()} Cape Peninsula University of Technology · creating futures</div>
    </footer>
  );
}
