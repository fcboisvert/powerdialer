/// <reference types="@cloudflare/workers-types" />
import type { KVNamespace } from '@cloudflare/workers-types';

interface Env {
  OUTCOMES_KV: KVNamespace;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

// OPTIONS (CORS preflight)
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

// GET /api/outcome?callId=uuid
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const callId = new URL(request.url).searchParams.get('callId');

  if (!callId) {
    console.error('Missing callId param');
    return json({ error: 'Missing required param: callId' }, 400);
  }

  try {
    const outcome = await env.OUTCOMES_KV.get(callId);
    console.log(`Fetched outcome for ${callId}: ${outcome ?? 'null'}`);
    return json({ outcome: outcome ?? null }, 200);
  } catch (error) {
    console.error(`KV get failed for ${callId}: ${(error as Error).message}`);
    return json({ error: 'Failed to fetch outcome' }, 500);
  }
};