// C:\Users\Frédéric-CharlesBois\projects\Powerdialer\functions\api\airtable\update-result.ts
// ✅ FINAL TEST VERSION: Hardcoded Airtable Token + Direct Update
// Path: functions/api/airtable/update-result-direct.ts

interface UpdateResultPayload {
  recordId: string;
  activityName: string;
  result: string;
  notes: string;
  agent: string;
  meetingNotes?: string;
  meetingDatetime?: string;
  statut?: string;
}

interface Env {
  AIRTABLE_TOKEN: string;
  AIRTABLE_BASE: string;
  AIRTABLE_TABLE: string;
}

const OUTCOME_MAP = new Map(Object.entries({
  "Boite_Vocale": "recVhLI35Yc5CeZ6k",
  "Pas_Joignable": "reci10aDNnoaNqpy",
}))

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }

  let payload: UpdateResultPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }

  const {
    recordId,
    activityName,
    result,
    notes,
    agent,
    meetingNotes,
    meetingDatetime,
  } = payload;

  if (!recordId || !activityName || !result || !agent) {
    return new Response(JSON.stringify({ error: "Missing required fields." }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }
  const resultId = OUTCOME_MAP.get(result)
  if (!resultId) {
    const valid = [...OUTCOME_MAP.keys()].map((s) => `'${s}'`).join(', ');
    return new Response(JSON.stringify({ error: `Invalid result '${result}'. Expected one of: ${valid}` }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }

  const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE}/${encodeURIComponent(
    env.AIRTABLE_TABLE
  )}/${recordId}`;

  const airtablePayload = {
    fields: {
      "Resultat de l'Activite": [resultId],
      "Notes Rencontres": meetingNotes ?? "", // CONFIRMED
      // "Notes (Appel)": notes ?? "", // BAD
      // "Date Realisee": new Date().toISOString(), // UNNECESSARY
      "Date et Heure Rencontre": meetingDatetime ?? undefined, // CONFIRMED
      "Statut de l'Activite": "Fait", // CONFIRMED
      // "Updated By": agent, // BAD
      // "Updated At": new Date().toISOString(), // BAD
    },
  };

  try {
    const airtableRes = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${env.AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(airtablePayload),
    });

    const airtableJson = await airtableRes.json();

    if (!airtableRes.ok) {
      console.error("❌ Airtable update failed", airtableJson);
      return new Response(
        JSON.stringify({ success: false, error: airtableJson, input: airtablePayload }),
        { status: 500, headers: { "content-type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify({ success: true, data: airtableJson }), {
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("❌ Exception during Airtable update:", err);
    return new Response(
      JSON.stringify({ error: "Unhandled exception", message: err.message }),
      { status: 500, headers: { "content-type": "application/json", ...corsHeaders } }
    );
  }
};