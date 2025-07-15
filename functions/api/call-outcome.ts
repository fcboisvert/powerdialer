// functions/api/call-outcome.ts
// Updated: maps valid outcomes to Airtable-friendly values, patches Airtable automatically,
// and returns a 200 response that PowerDialer can trust.
// -----------------------------------------------------------------------------
// POST /call-outcome
// Expected body:
// {
//   "outcome": "Répondu_Humain" | "Répondeur" | "Pas_Joignable",
//   "number" : "+15141234567",
//   "activity" : "T2-0.3 Cold Call 1",
//   "activityName": "TEXION - …",
//   "callId" : "uuid",
//   "agent"  : "frederic"
// }
// -----------------------------------------------------------------------------

interface CallOutcomePayload {
  outcome: 'Répondu_Humain' | 'Répondeur' | 'Pas_Joignable';
  number: string;
  activity: string;
  activityName: string;
  callId: string;
  agent: string;
}

export const onRequest: PagesFunction<{ OUTCOMES_KV: KVNamespace }> = async (
  ctx,
) => {
  const kv = ctx.env.OUTCOMES_KV;
  const { request } = ctx;

  // --- CORS -----------------------------------------------------------
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  } as const;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { 'content-type': 'application/json', ...corsHeaders } },
    );
  }

  // --- Parse + validate payload --------------------------------------
  let payload: CallOutcomePayload;
  try {
    payload = await request.json();
  } catch (_) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } },
    );
  }

  const { outcome, callId, agent } = payload;
  if (!outcome || !callId || !agent) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: outcome, callId, agent' }),
      { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } },
    );
  }

  const validOutcomes = ['Répondu_Humain', 'Répondeur', 'Pas_Joignable'] as const;
  if (!validOutcomes.includes(outcome)) {
    return new Response(
      JSON.stringify({ error: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}` }),
      { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } },
    );
  }

  // --- Persist outcome to KV (24h TTL) -------------------------------
  const outcomeData = { ...payload, timestamp: new Date().toISOString(), processed: false };
  await kv.put(`outcome_${callId}`, JSON.stringify(outcomeData), { expirationTtl: 86_400 });

  // keep last 10 outcomes per agent for quick lookup
  const agentKey = `recent_outcomes_${agent.toLowerCase()}`;
  const existing = await kv.get(agentKey);
  const recent = existing ? (JSON.parse(existing) as typeof outcomeData[]) : [];
  recent.unshift(outcomeData);
  await kv.put(agentKey, JSON.stringify(recent.slice(0, 10)), { expirationTtl: 86_400 });

  // --- Map outcome for Airtable --------------------------------------
  const AT_OUTCOME_MAP: Record<CallOutcomePayload['outcome'], 'Répondu_Humain' | 'Boite_Vocale' | 'Pas_Joignable'> = {
    Répondu_Humain: 'Répondu_Humain',
    Répondeur: 'Boite_Vocale',
    Pas_Joignable: 'Pas_Joignable',
  };
  const airtableResult = AT_OUTCOME_MAP[outcome];

  // Patch Airtable only for voicemail or not‑reachable; human replies handled manually.
  if (['Répondeur', 'Pas_Joignable'].includes(outcome)) {
    const res = await fetch('https://texion.app/api/airtable/update-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityName: payload.activityName,
        result: airtableResult,
        notes: '',
        agent: payload.agent,
        meetingNotes: '',
        meetingDatetime: '',
        statut: 'Fait',
      }),
    });

    if (!res.ok) {
      console.error('[call-outcome] Airtable update failed:', await res.text());
    } else {
      console.log('[call-outcome] Airtable updated ✔', airtableResult);
    }
  }

  // --- Success response ----------------------------------------------
  return new Response(
    JSON.stringify({ success: true, message: 'Call outcome recorded successfully', callId, outcome }),
    { status: 200, headers: { 'content-type': 'application/json', ...corsHeaders } },
  );
};
