// import-users — fetches users from Power Automate then writes to DB using service role key (bypasses RLS)
// Deploy: supabase functions deploy import-users
// Secret:  supabase secrets set PA_USERS_URL="https://..."

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

  const PA_URL = Deno.env.get("PA_USERS_URL");
  if (!PA_URL) {
    return new Response(JSON.stringify({ error: "PA_USERS_URL secret not configured." }), {
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
    const arr: any[] = Array.isArray(data) ? data : (data.users || data.value || []);
    if (!arr.length) throw new Error("No users returned from Power Automate.");

    const toInsert = arr.map((u: any) => {
      const ini = ((u.given_name || "")[0] || "") + ((u.surname || "")[0] || "");
      return {
        id: u.id,
        name: u.display_name || u.full_name || `${u.given_name || ""} ${u.surname || ""}`.trim(),
        display_name: u.display_name || null,
        email: u.email_address || null,
        department: u.department || null,
        company_name: u.company_name || null,
        job_title: u.job_title || null,
        country: u.country || null,
        account_enabled: typeof u.account_enabled === "boolean" ? u.account_enabled : true,
        initials: ini.toUpperCase() || null,
      };
    });

    // 2. Write to DB with service role key — bypasses RLS, no JWT needed
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { error: delErr } = await admin.from("users").delete().neq("id", "");
    if (delErr) throw new Error("Failed to clear users: " + delErr.message);

    const { error: insErr } = await admin.from("users").insert(toInsert);
    if (insErr) throw new Error("Failed to insert users: " + insErr.message);

    return new Response(JSON.stringify({ count: toInsert.length, users: toInsert }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
