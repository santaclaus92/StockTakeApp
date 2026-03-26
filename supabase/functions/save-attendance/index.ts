// save-attendance — reads and upserts attendance records using service role key (bypasses RLS)
// GET  ?session_id=XXX  → returns all attendees for that session
// POST {session_id, user_id, user_name, attended} → upserts one record
// Deploy: supabase functions deploy save-attendance

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function makeAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // GET — fetch all attendees for a session
  if (req.method === "GET") {
    try {
      const url = new URL(req.url);
      const session_id = url.searchParams.get("session_id");
      if (!session_id) {
        return new Response(JSON.stringify({ error: "Missing session_id query param" }), {
          status: 400, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      const admin = makeAdmin();
      const { data, error } = await admin
        .from("session_attendees")
        .select("*")
        .eq("session_id", session_id)
        .order("user_name", { ascending: true });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ attendees: data }), {
        status: 200, headers: { ...CORS, "Content-Type": "application/json" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: msg }), {
        status: 502, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  // POST — upsert one attendance record
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { session_id, user_id, user_name, attended } = body;

      if (!session_id || !user_id || !user_name) {
        return new Response(JSON.stringify({ error: "Missing required fields: session_id, user_id, user_name" }), {
          status: 400, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      const admin = makeAdmin();
      const { error } = await admin
        .from("session_attendees")
        .upsert(
          { session_id, user_id, user_name, attended: attended !== false },
          { onConflict: "session_id,user_id" }
        );

      if (error) throw new Error(error.message);

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...CORS, "Content-Type": "application/json" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: msg }), {
        status: 502, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
