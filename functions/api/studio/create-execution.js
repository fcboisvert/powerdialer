// Cloudflare Pages Function – create a Twilio Studio Flow execution
// ---------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  "Access-Control-Max-Age": "86400",
};

/* ---------- OPTIONS (pre-flight) ---------- */
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

  const { flowSid, to, from, parameters } = body || {};
  if (!flowSid || !to || !from)
    return bad("flowSid, to and from are required", "VALIDATION_ERROR");

  /* Credentials ------------------------------------------------- */
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token } = env;
  if (!sid || !token) {
    return bad("Missing Twilio credentials", "MISSING_CREDENTIALS", 500);
  }

  /* Phone number quick sanity (E.164) --------------------------- */
  const re = /^\+\d{8,15}$/;
  if (!re.test(to) || !re.test(from))
    return bad("Phone numbers must be E.164 (+15551234567)", "INVALID_PHONE");

  /* Call Twilio Studio ----------------------------------------- */
  const auth = btoa(`${sid}:${token}`);
  const encoded = new URLSearchParams({
    To: to,
    From: from,
    Parameters: JSON.stringify(parameters || {}),
  }).toString();

  // 👇 DEBUG: log exactly which Flow is being called
  console.log(
    `➡️  Calling Twilio: https://studio.twilio.com/v2/Flows/${flowSid}/Executions for ${to}`
  );

  const twilio = await fetch(
    `https://studio.twilio.com/v2/Flows/${flowSid}/Executions`,
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
    const err = await twilio.text();
    return bad(`Twilio API ${twilio.status}`, "TWILIO_API_ERROR", 502);
  }

  const exec = await twilio.json();
  return json(
    {
      success: true,
      executionSid: exec.sid,
      status: exec.status,
      flowSid, // echo back which flow was used
    },
    201
  );
}

/* ---------- helper ---------- */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}