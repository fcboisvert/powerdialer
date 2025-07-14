// Cloudflare Pages Function – always launch CC1 Powerdialer Outbound
// ------------------------------------------------------------------
//  ▸ Flow SID is hard‑coded so the frontend cannot change it.
//  ▸ Logs show the exact REST URL that is called.
//  ▸ Wildcard CORS allows any custom header in pre‑flight.

const FORCED_FLOW_SID = "FW236e663e008973ab36cbfcdc706b6d97"; // CC1 – Powerdialer Outbound

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",   // wildcard so every header passes
  "Access-Control-Max-Age": "86400",
};

// ---- OPTIONS (CORS pre‑flight) -----------------------------------
export const onRequestOptions = () =>
  new Response(null, { status: 200, headers: corsHeaders });

// ---- POST ---------------------------------------------------------
export async function onRequestPost({ request, env }) {
  // helper to send JSON error responses
  const bad = (msg, code = "ERROR", status = 400) =>
    json({ success: false, error: msg, code }, status);

  // 1. Parse body ---------------------------------------------------
  let body;
  try {
    body = await request.json();
  } catch {
    return bad("Body must be valid JSON", "BAD_JSON");
  }

  const { to, from, parameters } = body || {};
  if (!to || !from) return bad("to and from are required", "VALIDATION_ERROR");

  // 2. Credentials --------------------------------------------------
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token } = env;
  if (!sid || !token) return bad("Missing Twilio credentials", "MISSING_CREDENTIALS", 500);

  // 3. Quick phone sanity (E.164) -----------------------------------
  const e164 = /^\+\d{8,15}$/;
  if (!e164.test(to) || !e164.test(from))
    return bad("Phone numbers must be E.164 (+15551234567)", "INVALID_PHONE");

  // 4. Call Twilio Studio ------------------------------------------
  console.log(`➡️  Calling Twilio Studio Flow ${FORCED_FLOW_SID} for ${to}`);

  const auth = btoa(`${sid}:${token}`);
  const encoded = new URLSearchParams({
    To: to,
    From: from,
    Parameters: JSON.stringify(parameters || {}),
  }).toString();

  const twilio = await fetch(
    `https://studio.twilio.com/v2/Flows/${FORCED_FLOW_SID}/Executions`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encoded,
    }
  );

  if (!twilio.ok) {
    const errText = await twilio.text();
    console.error("Twilio API error", twilio.status, errText);
    return bad(`Twilio API ${twilio.status}`, "TWILIO_API_ERROR", 502);
  }

  const exec = await twilio.json();
  return json({
    success: true,
    executionSid: exec.sid,
    status: exec.status,
    flowSid: FORCED_FLOW_SID,
  }, 201);
}

// ---- helper -------------------------------------------------------
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
