/// <reference types="@cloudflare/workers-types" />
import type { KVNamespace } from "@cloudflare/workers-types";

interface Env {
  OUTCOMES_KV: KVNamespace;
}

const validOutcomes = ["Boite_Vocale", "Pas_Joignable"] as const;

interface CallOutcomePayload {
  outcome: "Boite_Vocale" | "Pas_Joignable";
  number: string;
  activity: string;
  activityName: string;
  callId: string;
  agent: string;
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  // --- CORS -----------------------------------------------------------
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  } as const;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }

  // --- Parse + validate payload --------------------------------------
  let payload: CallOutcomePayload;
  try {
    payload = await request.json();
  } catch (_) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON in request body" }),
      {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders },
      }
    );
  }

  const { outcome, callId, agent, activityName } = payload;

  if (!outcome || !callId || !agent) {
    return new Response(
      JSON.stringify({
        error: "Missing required fields: outcome, callId, agent",
      }),
      {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders },
      }
    );
  }

  // --- Validate outcome --------------------------------------
  if (!validOutcomes.includes(outcome)) {
    return new Response(
      JSON.stringify({
        error: `Invalid outcome. Must be one of: ${validOutcomes.join(", ")}`,
      }),
      {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders },
      }
    );
  }

  // --- CRITICAL: Store outcome in KV for frontend polling ---
  try {
    // Store with 5 minute TTL to auto-cleanup
    await env.OUTCOMES_KV.put(callId, outcome, { expirationTtl: 300 });
    console.log(`[call-outcome] Stored outcome in KV: ${callId} = ${outcome}`);
  } catch (error) {
    console.error("[call-outcome] KV write failed:", error);
    console.error("[call-outcome] env.OUTCOMES_KV:", env.OUTCOMES_KV);
    return new Response(
      JSON.stringify({
        error: "Failed to store outcome",
        details: (error as Error).message,
      }),
      {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders },
      }
    );
  }

  // --- Update Airtable (existing code) ---
  try {
    const res = await fetch("https://texion.app/api/airtable/update-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activityName: activityName,
        result: outcome === "Boite_Vocale" ? "Répondeur" : outcome,
        notes: "",
        agent: agent,
        meetingNotes: "",
        meetingDatetime: "",
        statut: "Fait",
      }),
    });

    if (!res.ok) {
      const resBody = await res.text();
      console.error("[call-outcome] Airtable update failed:", resBody);
      return new Response(resBody, {
        status: res.status,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    } else {
      console.log("[call-outcome] Airtable updated ✔", outcome);
    }
  } catch (error) {
    console.error("[call-outcome] Airtable update error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to update Airtable",
        details: (error as Error).message,
      }),
      {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders },
      }
    );
  }

  // --- Success response ----------------------------------------------
  return new Response(
    JSON.stringify({
      success: true,
      message: "Call outcome recorded successfully",
      callId,
      outcome,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders },
    }
  );
};
