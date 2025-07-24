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
  AIRTABLE_WRITE_TOKEN: string;
  AIRTABLE_BASE: string;
  AIRTABLE_TABLE: string;
}

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

  const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE}/${encodeURIComponent(
    env.AIRTABLE_TABLE
  )}/${recordId}`;

  const airtablePayload = {
    fields: {
      "Resultat de l'Activite": result,
      "Notes Rencontres": meetingNotes ?? "",
      "Notes (Appel)": notes ?? "",
      "Date et Heure Rencontre": meetingDatetime ?? "",
      "Statut de l'Activite": "Fait",
      "Updated By": agent,
      "Updated At": new Date().toISOString(),
    },
  };

  try {
    const airtableRes = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${env.AIRTABLE_WRITE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(airtablePayload),
    });

    const airtableJson = await airtableRes.json();

    if (!airtableRes.ok) {
      console.error("❌ Airtable update failed", airtableJson);
      return new Response(
        JSON.stringify({ success: false, error: airtableJson }),
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