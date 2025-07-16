/// <reference types="@cloudflare/workers-types" />
import type { KVNamespace } from '@cloudflare/workers-types';

interface Env {
  OUTCOMES_KV: KVNamespace;
}
  const validOutcomes = ['Boite_Vocale', 'Pas_Joignable'] as const;

interface CallOutcomePayload {
  outcome: 'Boite_Vocale' | 'Pas_Joignable';
  number: string;
  activity: string;
  activityName: string;
  callId: string;
  agent: string;
}

export const onRequest: PagesFunction<Env> = async (ctx) => {

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
      { status: 405, headers: { 'content-type': 'application/json', ...corsHeaders } }
    );
  }
  
  // --- Parse + validate payload --------------------------------------
  let payload: CallOutcomePayload;
  try {
    payload = await request.json();
  } catch (_) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } }
    );
  }

  const { outcome, callId, agent } = payload;

  if (!outcome || !callId || !agent) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: outcome, callId, agent' }),
      { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } }
    );
  }

  // --- Parse + validate payload --------------------------------------
  if (!validOutcomes.includes(outcome)) {
    return new Response(
      JSON.stringify({ error: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}` }),
      { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } }
    );
  }

     const res = await fetch('https://texion.app/api/airtable/update-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityName: payload.activityName,
        result: outcome,
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
      console.log('[call-outcome] Airtable updated ✔', outcome);
    }

  // --- Success response ----------------------------------------------
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Call outcome recorded successfully',
      callId,
      outcome,
    }),
    { status: 200, headers: { 'content-type': 'application/json', ...corsHeaders } }
  );
};
