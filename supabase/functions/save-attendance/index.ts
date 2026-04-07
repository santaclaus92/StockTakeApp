// save-attendance — reads and upserts attendance records using service role key (bypasses RLS)
// GET  ?session_id=XXX  → returns all attendees for that session
// POST {session_id, user_id, user_name, attended}        → plain upsert (manual add / toggle)
// POST {session_id, user_id, user_name, scan: true}      → QR scan: auto-fills check_in/lunch_out/lunch_in/check_out
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
      const { session_id, user_id, user_name, attended, scan } = body;

      if (!session_id || !user_id || !user_name) {
        return new Response(JSON.stringify({ error: "Missing required fields: session_id, user_id, user_name" }), {
          status: 400, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      const admin = makeAdmin();

      // ── QR scan path: determine which time slot to fill ────────────────
      if (scan === true) {
        const { data: existing } = await admin
          .from("session_attendees")
          .select("check_in, lunch_out, lunch_in, check_out")
          .eq("session_id", session_id)
          .eq("user_id", user_id)
          .maybeSingle();

        const now = new Date();
        const MIN = 60000;

        let slot: string;
        let update: Record<string, string | boolean> = { attended: true };

        if (!existing || !existing.check_in) {
          slot = "check_in";
          update.check_in = now.toISOString();
        } else if (!existing.lunch_out) {
          const diff = now.getTime() - new Date(existing.check_in).getTime();
          if (diff < 60 * MIN) {
            const wait = Math.ceil((60 * MIN - diff) / MIN);
            return new Response(JSON.stringify({ error: `Too early for lunch out. Wait ${wait} more minute${wait !== 1 ? "s" : ""}.` }), {
              status: 422, headers: { ...CORS, "Content-Type": "application/json" },
            });
          }
          slot = "lunch_out";
          update.lunch_out = now.toISOString();
        } else if (!existing.lunch_in) {
          const diff = now.getTime() - new Date(existing.lunch_out).getTime();
          if (diff < 30 * MIN) {
            const wait = Math.ceil((30 * MIN - diff) / MIN);
            return new Response(JSON.stringify({ error: `Too early to check in from lunch. Wait ${wait} more minute${wait !== 1 ? "s" : ""}.` }), {
              status: 422, headers: { ...CORS, "Content-Type": "application/json" },
            });
          }
          slot = "lunch_in";
          update.lunch_in = now.toISOString();
        } else if (!existing.check_out) {
          const diff = now.getTime() - new Date(existing.lunch_in).getTime();
          if (diff < 60 * MIN) {
            const wait = Math.ceil((60 * MIN - diff) / MIN);
            return new Response(JSON.stringify({ error: `Too early for end-of-day check out. Wait ${wait} more minute${wait !== 1 ? "s" : ""}.` }), {
              status: 422, headers: { ...CORS, "Content-Type": "application/json" },
            });
          }
          slot = "check_out";
          update.check_out = now.toISOString();
        } else {
          return new Response(JSON.stringify({ error: "All time slots already recorded for today." }), {
            status: 422, headers: { ...CORS, "Content-Type": "application/json" },
          });
        }

        const { error } = await admin
          .from("session_attendees")
          .upsert({ session_id, user_id, user_name, ...update }, { onConflict: "session_id,user_id" });

        if (error) throw new Error(error.message);

        return new Response(JSON.stringify({ ok: true, slot }), {
          status: 200, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      // ── Plain upsert path (manual add / toggle) ────────────────────────
      const { error } = await admin
        .from("session_attendees")
        .upsert(
          { session_id, user_id, user_name, attended: attended !== false },
          { onConflict: "session_id,user_id" }
        );

      if (error) throw new Error(error.message);

      // Record check_in timestamp the first time a user is marked present
      let checkInRecorded: string | null = null;
      if (attended !== false) {
        const now = new Date().toISOString();
        const { data: updated } = await admin
          .from("session_attendees")
          .update({ check_in: now })
          .eq("session_id", session_id)
          .eq("user_id", user_id)
          .is("check_in", null)
          .select("check_in")
          .maybeSingle();
        checkInRecorded = updated ? now : null;
      }

      return new Response(JSON.stringify({ ok: true, check_in: checkInRecorded }), {
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
