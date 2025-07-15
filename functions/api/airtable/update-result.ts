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

export const onRequest: PagesFunction = async ({ request }) => {
  const AIRTABLE_TOKEN = "atopuALLxIH5YDGA.01bf2115299311f8076434534c5b6856537e870b19db17db2b6fff1bfab7fa33";
  const AIRTABLE_BASE_ID = "apprTpOIFRuckIZJz";
  const AIRTABLE_TABLE_NAME = "Interaction / Activities";

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

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    AIRTABLE_TABLE_NAME
  )}/${recordId}`;

  const airtablePayload = {
    fields: {
      "Résultat (Appel)": result,
      "Notes Rencontres": meetingNotes ?? "",
      "Notes (Appel)": notes ?? "",
      "Date et Heure Rencontre": meetingDatetime ?? "",
      "Statut de l'Activité": "Fait",
      "Updated By": agent,
      "Updated At": new Date().toISOString(),
    },
  };

  try {
    const airtableRes = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
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
