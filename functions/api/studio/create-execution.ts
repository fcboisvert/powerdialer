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

  /* ---------- Call Twilio Studio REST API ---------- */
  const resp = await fetch(
    `https://studio.twilio.com/v2/Flows/${env.FLOW_SID}/Executions`,
    {
      method: 'POST',
      headers: {
        Authorization:
          'Basic ' +
          btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Parameters: JSON.stringify(parameters ?? {}),
      }),
    }
  );

  const data = await resp.json();
  return json(data, resp.status);
};

/* ---------- Small helper ---------- */
const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
