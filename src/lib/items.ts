import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Item = Database["public"]["Tables"]["items"]["Row"];
export type Claim = Database["public"]["Tables"]["claims"]["Row"];

export const CAMPUSES = ["Bellville", "District Six", "Mowbray", "Granger Bay", "Wellington", "Athlone"];
export const CATEGORIES = [
  "Electronics", "Phones", "Laptops & Tablets", "Wallets & Purses", "ID & Cards",
  "Keys", "Bags", "Clothing", "Books & Stationery", "Jewellery & Watches", "Other",
];

export function usePhotoUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return setUrl(null);
    supabase.storage.from("item-photos").createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  return url;
}

export async function uploadPhoto(userId: string, file: File) {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("item-photos").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}
