// functions/api/test-kv.ts
import type { KVNamespace } from '@cloudflare/workers-types';

interface Env {
  OUTCOMES_KV: KVNamespace;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  
  try {
    // Test if KV binding exists
    if (!env.OUTCOMES_KV) {
      return new Response(JSON.stringify({ 
        error: 'KV binding not found',
        env_keys: Object.keys(env),
        has_outcomes_kv: 'OUTCOMES_KV' in env
      }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    if (request.method === 'POST') {
      // Test write
      const testKey = `test-${Date.now()}`;
      const testValue = 'test-value';
      
      await env.OUTCOMES_KV.put(testKey, testValue, { expirationTtl: 60 });
      
      // Try to read it back
      const readBack = await env.OUTCOMES_KV.get(testKey);
      
      return new Response(JSON.stringify({ 
        success: true,
        wrote: { key: testKey, value: testValue },
        readBack: readBack,
        kv_exists: true
      }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // GET - list some keys
    const list = await env.OUTCOMES_KV.list({ limit: 10 });
    
    return new Response(JSON.stringify({ 
      kv_exists: true,
      keys_count: list.keys.length,
      keys: list.keys,
      test: 'KV binding is working'
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'KV operation failed',
      message: (error as Error).message,
      stack: (error as Error).stack
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
};
