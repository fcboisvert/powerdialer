// functions/api/studio/create-execution.ts
/**
 * POST /api/studio/create-execution
 * Body: { to: string; from: string; parameters?: Record<string, unknown> }
 */

interface Env {
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  FLOW_SID: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",  // Wildcard for dev; scope to texion.app later
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

// OPTIONS (CORS preflight)
export const onRequestOptions: PagesFunction<Env> = async ({ env }) => {
  return new Response(env.TWILIO_ACCOUNT_SID, { status: 204, headers: corsHeaders });
};

// POST
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  /* ---------- Parse & validate body ---------- */
  let payload: {
    to?: string;
    from?: string;
    parameters?: Record<string, unknown>;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return json({ error: 'Body must be valid JSON' }, 400);
  }

  const { to, from, parameters } = payload;
  if (!to || !from) {
    return json({ error: '`to` and `from` are required' }, 400);
  }

  // Quick E.164 sanity (add if volumes spike)
  const e164 = /^\+\d{8,15}$/;
  if (!e164.test(to) || !e164.test(from)) {
    return json({ error: 'Phones must be E.164 (+15551234567)' }, 400);
  }

  /* ---------- Call Twilio Studio REST API ---------- */
    
  //const resp = await fetch(
    //  `https://studio.twilio.com/v2/Flows/${env.FLOW_SID}/Executions`,
    //{
    //  method: 'POST',
    //  headers: {
    //    Authorization:
    //      'Basic ' +
    //      btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
    //    'Content-Type': 'application/x-www-form-urlencoded',
    //  },
    //  body: new URLSearchParams({
    //    To: to,
    //    From: from,
    //    Parameters: JSON.stringify(parameters ?? {}),
    //  }),
    //}
  //);
let data;
try {
  const resp = await fetch(
    `https://studio.twilio.com/v2/Flows/${env.FLOW_SID}/Executions`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Parameters: JSON.stringify(parameters ?? {}),
      }),
    }
  );

  data = await resp.json();

  if (!resp.ok) {
    if (resp.status === 409 && data.code === 20409 && data.details?.conflicting_execution_sid) {
      const conflictingSid = data.details.conflicting_execution_sid;
      console.warn(`Ending conflicting execution: ${conflictingSid}`);

      // End the conflicting one
      await fetch(
        `https://studio.twilio.com/v2/Flows/${env.FLOW_SID}/Executions/${conflictingSid}`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ Status: 'ended' }),
        }
      );

      // Retry the original create
      const retryResp = await fetch(
        `https://studio.twilio.com/v2/Flows/${env.FLOW_SID}/Executions`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: to,
            From: from,
            Parameters: JSON.stringify(parameters ?? {}),
          }),
        }
      );

      data = await retryResp.json();
      if (!retryResp.ok) throw new Error(`Retry failed: ${data.message}`);
      console.log(`Retry successful for execution: ${data.sid}`);
    } else {
      throw new Error(data.message || 'Twilio error');
    }
  } else {
    console.log(`Execution created successfully: ${data.sid}`, { to, from });
  }
} catch (error) {
  console.error('Execution create failed:', (error as Error).message, { to, from });
  return json({ error: (error as Error).message }, 500);
}

return json(data, 200);
  const data = await resp.json();
  return json(data, resp.status);
};

/* ---------- Small helper ---------- */
const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  }); 
  