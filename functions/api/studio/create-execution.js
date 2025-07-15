const FLOW_SID = "FW236e663e008973ab36cbfcdc706b6d97";

/* ---------- CORS pre-flight ---------- */
export const onRequestOptions = () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400"
    }
  });

/* ---------- POST /api/studio/create-execution ---------- */
export async function onRequestPost({ request, env }) {
  const respond = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  /* 1 ▸ parse body */
  let body;
  try {
    body = await request.json();
  } catch {
    return respond({ success: false, error: "Body must be valid JSON" }, 400);
  }

  const { to, from, parameters: extra = {} } = body || {};
  if (!to || !from)
    return respond({ success: false, error: "`to` and `from` are required" }, 400);

  const e164 = /^\+\d{10,15}$/;
  if (!e164.test(to) || !e164.test(from))
    return respond(
      { success: false, error: "Phone numbers must be E.164 (+15551234567)" },
      400
    );

  /* 2 ▸ credentials */
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token } = env;
  if (!sid || !token)
    return respond({ success: false, error: "Missing Twilio credentials" }, 500);

  /* 3 ▸ build Parameters JSON */
  const flowParams = {
    ...extra,
    to,
    from
  };

  /* 4 ▸ form-encode body
       - To / From (capitalised)       → contact.channel & misc
       - to / from (lower case)        → trigger.parameters.to/from  ✅
       - Parameters (stringified JSON) → flow.data + logging         ✅           */
  const form = new URLSearchParams({
    To: to,
    From: from,
    to,
    from,
    Parameters: JSON.stringify(flowParams)
  });

  /* 5 ▸ hit Studio */
  const twilioResp = await fetch(
    `https://studio.twilio.com/v2/Flows/${FLOW_SID}/Executions`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${sid}:${token}`),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    }
  );

  if (!twilioResp.ok) {
    const txt = await twilioResp.text();
    return respond(
      { success: false, error: `Twilio API ${twilioResp.status}: ${txt}` },
      502
    );
  }

  /* 6 ▸ success */
  const exec = await twilioResp.json();
  return respond(
    {
      success: true,
      executionSid: exec.sid,
      status: exec.status,
      flowSid: FLOW_SID
    },
    201
  );
}
