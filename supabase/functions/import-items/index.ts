// import-items — fetches items from Power Automate then writes to DB using service role key (bypasses RLS)
// Deploy: supabase functions deploy import-items
// Secret:  supabase secrets set PA_ITEMS_URL="https://..."

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

  const PA_URL = Deno.env.get("PA_ITEMS_URL");
  if (!PA_URL) {
    return new Response(JSON.stringify({ error: "PA_ITEMS_URL secret not configured." }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.text();
    const { sessionId, entity } = body ? JSON.parse(body) : {};

    // 1. Fetch from Power Automate
    const paResp = await fetch(PA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, entity }),
    });
    const raw = await paResp.text();
    if (!raw) throw new Error("Power Automate returned no data.");

    const data = JSON.parse(raw);
    const arr: any[] = Array.isArray(data) ? data : (data.items || data.value || []);
    if (!arr.length) throw new Error("No items returned from SAP.");

    const toInsert = arr.map((i: any) => ({
      id: i.ItemInternalId || i.id || ("SAP-" + Math.random().toString(36).slice(2)),
      code: i.item_code || i.code || "",
      name: i.item_name || i.name || "",
      group: i.item_group || i.grp || "",
      batch: i.batch_serial_num || i.batch || null,
      uom: i.uom || "PCS",
      bin_location: i.item_location || i.warehouse || i.bin || null,
      sap_qty: +(i.sap_qty !== undefined ? i.sap_qty : (i.sap || 0)),
      count_qty: null,
      pair_id: null,
      dropped: false,
      session_id: sessionId || null,
      entity: i.entity || null,
      wh_code: i.wh_code || null,
      expiry_date: i.expiry_date ? i.expiry_date.split("T")[0] : null,
      category: i.category || null,
      new_item: i.new_item || "No",
      variance: +(i.variance_d2 || 0),
      cost: +(i.cost || 0),
      is_delete: !!i.is_delete,
    }));

    // 2. Write to DB with service role key — bypasses RLS
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    if (sessionId) {
      const { error: delErr } = await admin.from("items").delete().eq("session_id", sessionId);
      if (delErr) throw new Error("Failed to delete existing items: " + delErr.message);
    }

    // Insert in chunks of 500
    const chunks: any[][] = [];
    for (let i = 0; i < toInsert.length; i += 500) chunks.push(toInsert.slice(i, i + 500));
    for (let idx = 0; idx < chunks.length; idx++) {
      const { error: insErr } = await admin.from("items").insert(chunks[idx]);
      if (insErr) throw new Error(`Failed to insert items (batch ${idx + 1}): ` + insErr.message);
    }

    return new Response(JSON.stringify({ count: toInsert.length, items: toInsert }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
