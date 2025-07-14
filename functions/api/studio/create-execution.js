// Cloudflare Pages Function – create a Twilio Studio Flow execution
// ---------------------------------------------------------------
// Always use CC1 – Powerdialer Outbound
const FORCED_FLOW_SID = "FW236e663e008973ab36cbfcdc706b6d97";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*", // wildcard so every header passes pre‑flight
  "Access-Control-Max-Age": "86400",
};

/* ---------- OPTIONS (pre‑flight) ---------- */
export const onRequestOptions = () =>
  new Response(null, { status: 200, headers: corsHeaders });

/* ---------- POST ---------- */
export async function onRequestPost({ request, env }) {
  const bad = (msg, code = "ERROR", status = 400) =>
    json({ success: false, error: msg, code }, status);

  /* Parse body -------------------------------------------------- */
  let body;
  try {
    body = await request.json();
  } catch {
    return bad("Body must be valid JSON", "BAD_JSON");
  }

  const { to, from, parameters } = body || {};
   if (!to || !from)
    return bad("to and from are required", "VALIDATION_ERROR");

  /* Credentials ------------------------------------------------- */
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token } = env;
  if (!sid || !token)
    return bad("Missing Twilio credentials", "MISSING_CREDENTIALS", 500);

  /* Phone number sanity (E.164) -------------------------------- */
  const e164 = /^\+\d{8,15}$/;
  if (!e164.test(to) || !e164.test(from))
    return bad("Phone numbers must be E.164 (+15551234567)", "INVALID_PHONE");

  /* Call Twilio Studio ----------------------------------------- */
  const auth = btoa(`${sid}:${token}`);
  const encoded = new URLSearchParams({
    To: to,
    From: from,
    Parameters: JSON.stringify(parameters || {}),
  }).toString();

  // 👇 Visible in wrangler tail so you can verify the exact Flow URL.
  console.log(`➡️  Calling Twilio: https://studio.twilio.com/v2/Flows/${flowSid}/Executions for ${to}`);

  const twilio = await fetch(
    `https://studio.twilio.com/v2/Flows/${FORCED_FLOW_SID}/Executions`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encoded,
    },
  );

  if (!twilio.ok) {
    const err = await twilio.text();
    return bad(`Twilio API ${twilio.status}: ${err}`, "TWILIO_API_ERROR", 502);
  }

  const exec = await twilio.json();
  return json(
-    { success: true, executionSid: exec.sid, status: exec.status, flowSid },
-    201,
-  );
}

/* ---------- helper ---------- */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}