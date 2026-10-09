import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [campuses, setCampuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async (u: User | null) => {
      setUser(u);
      if (u) {
        const [{ data }, { data: ca }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", u.id),
          supabase.from("campus_admins").select("campus").eq("user_id", u.id),
        ]);
        setIsAdmin(!!data?.some((r) => r.role === "admin"));
        setCampuses((ca ?? []).map((c) => c.campus));
      } else { setIsAdmin(false); setCampuses([]); }
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setTimeout(() => load(s?.user ?? null), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, isAdmin, campuses, isStaff: isAdmin || campuses.length > 0, loading };
}
