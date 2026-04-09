// import-users — fetches users from Power Automate then syncs to DB using service role key (bypasses RLS)
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

  try {
    let arr: any[] = [];

    if (PA_URL) {
      // Pull mode: edge function calls Power Automate
      const body = await req.text();
      const paResp = await fetch(PA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body || "{}",
      });
      const raw = await paResp.text();
      if (!raw) throw new Error("Power Automate returned no data.");
      const data = JSON.parse(raw);
      arr = Array.isArray(data) ? data : (data.data || data.users || data.value || data.rows || []);
    } else {
      // Push mode: Power Automate posted users directly in request body
      const data = await req.json();
      arr = Array.isArray(data) ? data : (data.data || data.users || data.value || data.rows || []);
    }

    if (!arr.length) throw new Error("No users found in payload.");

    const incoming = arr.map((u: any) => {
      const ini = ((u.given_name || "")[0] || "") + ((u.surname || "")[0] || "");
      const email = (u.email_address || u.email || "").trim().toLowerCase() || null;
      return {
        id: u.id,
        name: u.display_name || u.full_name || `${u.given_name || ""} ${u.surname || ""}`.trim(),
        display_name: u.display_name || null,
        email,
        department: u.department || null,
        company_name: u.company_name || null,
        job_title: u.job_title || null,
        country: u.country || null,
        account_enabled: typeof u.account_enabled === "boolean" ? u.account_enabled : true,
        initials: ini.toUpperCase() || null,
      };
    });

    // Deduplicate by email then id
    const seenEmails = new Set<string>();
    const seenIds = new Set<string>();
    const incomingUsers: any[] = [];
    for (const u of incoming) {
      if (seenIds.has(u.id)) continue;
      if (u.email && seenEmails.has(u.email)) continue;
      incomingUsers.push(u);
      seenIds.add(u.id);
      if (u.email) seenEmails.add(u.email);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Fetch all existing users
    const { data: existingRows, error: fetchErr } = await admin
      .from("users")
      .select("id, email, role");
    if (fetchErr) throw new Error("Failed to fetch existing users: " + fetchErr.message);

    const existingById = new Map<string, any>();
    const existingByEmail = new Map<string, any>();
    for (const row of existingRows ?? []) {
      existingById.set(row.id, row);
      if (row.email) existingByEmail.set(row.email.trim().toLowerCase(), row);
    }

    // Add users not already in DB
    const toInsert = incomingUsers
      .filter((u) => !existingById.has(u.id) && !(u.email && existingByEmail.has(u.email)))
      .map((u) => ({ ...u, role: "User" }));

    // Remove existing users not in the import
    const incomingIds = new Set(incomingUsers.map((u) => u.id));
    const incomingEmails = new Set(incomingUsers.map((u) => u.email).filter(Boolean));
    const toDeleteIds = (existingRows ?? [])
      .filter((row) => !incomingIds.has(row.id) && !(row.email && incomingEmails.has(row.email.trim().toLowerCase())))
      .map((row) => row.id);

    if (toInsert.length > 0) {
      const { error: insErr } = await admin.from("users").insert(toInsert);
      if (insErr) throw new Error("Failed to insert users: " + insErr.message);
    }

    if (toDeleteIds.length > 0) {
      const { error: delErr } = await admin.from("users").delete().in("id", toDeleteIds);
      if (delErr) throw new Error("Failed to delete users: " + delErr.message);
    }

    return new Response(JSON.stringify({ imported: toInsert.length, removed: toDeleteIds.length, total: incomingUsers.length }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
