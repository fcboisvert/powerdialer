interface UpdateResultPayload {
  activityName: string;
  result: string;
  notes: string;
  agent: string;
  meetingNotes?: string;
  meetingDatetime?: string;
}

export const onRequest: PagesFunction<{ 
  RESULTS_KV: KVNamespace,
  MAKE_AIRTABLE_WEBHOOK?: string,
  AIRTABLE_API_KEY?: string,
  AIRTABLE_BASE_ID?: string,
  AIRTABLE_TABLE_NAME?: string
}> = async (ctx) => {
  const { request, env } = ctx;
  const kv = env.RESULTS_KV;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 405, headers: { "content-type": "application/json", ...corsHeaders } }
    );
  }

  let payload: UpdateResultPayload;

  try {
    payload = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON in request body" }),
      { status: 400, headers: { "content-type": "application/json", ...corsHeaders } }
    );
  }

  const { activityName, result, notes, agent, meetingNotes, meetingDatetime } = payload;

  if (!activityName || !result || !agent) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: activityName, result, agent" }),
      { status: 400, headers: { "content-type": "application/json", ...corsHeaders } }
    );
  }

  const validResults = [
    "S_O", "Rencontre_Expl._Planifiee", "Rencontre_Besoin_Planifiee",
    "Visite_Planifiee", "Offre_Planifiee", "Touchbase_Planifiee",
    "Relancer_Dans_X", "Info_Par_Courriel", "Boite_Vocale",
    "Pas_Joignable", "Pas_Interesse", "Demande_Lien_Booking",
    "Me_Refere_Interne", "Me_Refere_Externe"
  ];

  if (!validResults.includes(result)) {
    return new Response(
      JSON.stringify({ error: `Invalid result. Must be one of: ${validResults.join(", ")}` }),
      { status: 400, headers: { "content-type": "application/json", ...corsHeaders } }
    );
  }

  const updateData = {
    activityName,
    result,
    notes,
    agent,
    meetingNotes: meetingNotes ?? "",
    meetingDatetime: meetingDatetime ?? "",
    timestamp: new Date().toISOString(),
    status: "processing"
  };

  try {
    await kv.put(
      `update_${Date.now()}_${agent}`,
      JSON.stringify(updateData),
      { expirationTtl: 3600 }
    );
  } catch (e) {
    console.warn("KV store failed but continuing:", e);
  }

  // ───── OPTION 1: MAKE.COM ─────
  if (env.MAKE_AIRTABLE_WEBHOOK) {
    try {
      const makeResponse = await fetch(env.MAKE_AIRTABLE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!makeResponse.ok) throw new Error(`Make.com failed: ${makeResponse.statusText}`);
      const resultText = await makeResponse.text();

      return new Response(
        JSON.stringify({ success: true, method: "make_webhook", result: resultText }),
        { status: 200, headers: { "content-type": "application/json", ...corsHeaders } }
      );

    } catch (err) {
      console.error("Make.com error:", err);
      await kv.put(`failed_update_${Date.now()}`, JSON.stringify({ ...updateData, error: err.message }), { expirationTtl: 86400 });

      return new Response(
        JSON.stringify({ error: "Failed to update via Make.com", details: err.message }),
        { status: 500, headers: { "content-type": "application/json", ...corsHeaders } }
      );
    }
  }

  // ───── OPTION 2: Airtable Direct (Fallback) ─────
  if (env.AIRTABLE_API_KEY && env.AIRTABLE_BASE_ID && env.AIRTABLE_TABLE_NAME) {
    try {
      const airtableResponse = await fetch(
        `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_NAME}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            records: [
              {
                fields: {
                  "Résultat (Appel)": result,
                  "Notes": notes,
                  "Notes Rencontres": meetingNotes ?? "",
                  "Date et Heure Rencontre": meetingDatetime ?? "",
                  "Updated By": agent,
                  "Updated At": new Date().toISOString()
                }
              }
            ]
          }),
        }
      );

      if (!airtableResponse.ok) {
        throw new Error(`Airtable API failed: ${airtableResponse.status}`);
      }

      return new Response(
        JSON.stringify({ success: true, method: "airtable_direct", data: updateData }),
        { status: 200, headers: { "content-type": "application/json", ...corsHeaders } }
      );
    } catch (err) {
      console.error("Airtable API error:", err);
      return new Response(
        JSON.stringify({ error: "Airtable direct update failed", details: err.message }),
        { status: 500, headers: { "content-type": "application/json", ...corsHeaders } }
      );
    }
  }

  // ───── No update method available ─────
  return new Response(
    JSON.stringify({ success: false, message: "No update method configured", stored: true, data: updateData }),
    { status: 200, headers: { "content-type": "application/json", ...corsHeaders } }
  );
};
