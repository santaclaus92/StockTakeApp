// import-bins — fetches bins from Power Automate then writes to DB using service role key (bypasses RLS)
// Deploy: supabase functions deploy import-bins
// Secret:  supabase secrets set PA_BINS_URL="https://..."

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const PA_URL = Deno.env.get("PA_BINS_URL");
  if (!PA_URL) {
    return new Response(JSON.stringify({ error: "PA_BINS_URL secret not configured." }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.text();

    // 1. Fetch from Power Automate
    const paResp = await fetch(PA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body || "{}",
    });
    const raw = await paResp.text();
    if (!raw) throw new Error("Power Automate returned no data.");

    const data = JSON.parse(raw);
    const arr: any[] = Array.isArray(data) ? data : (data.value || []);

    // Deduplicate by bin_location
    const map: Record<string, string> = {};
    arr.forEach((item: any) => {
      if (item.bin_location) map[item.bin_location] = item.location_assigned || item.bin_location;
    });
    const bins = Object.keys(map).sort().map((k) => ({ id: k, name: map[k] }));
    if (!bins.length) throw new Error("No bins returned.");

    // 2. Write to DB with service role key — bypasses RLS
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { error: upsertErr } = await admin.from("warehouses").upsert(bins, { onConflict: "id" });
    if (upsertErr) throw new Error("Failed to upsert bins: " + upsertErr.message);

    return new Response(JSON.stringify({ count: bins.length, bins }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
