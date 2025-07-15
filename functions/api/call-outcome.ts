// C:\Users\Frédéric-CharlesBois\projects\Powerdialer\functions\api\call-outcome.ts
/**
 * POST /call-outcome
 * Receives call outcomes from Twilio Studio Flow
 * 
 * Expected body:
 * {
 *   "outcome": "Répondu_Humain" | "Répondeur" | "Pas_Joignable",
 *   "number": "+15141234567",
 *   "activity": "SPARK Microsystems-Jean-Sebastien Poirier-T2-0.3 Cold Call 1",
 *   "callId": "call_1234567890_abc123",
 *   "agent": "frederic"
 * }
 */

interface CallOutcomePayload {
  outcome: 'Répondu_Humain' | 'Répondeur' | 'Pas_Joignable';
  number: string;
  activity: string;
  callId: string;
  agent: string;
}

export const onRequest: PagesFunction<{ OUTCOMES_KV: KVNamespace }> = async (ctx) => {
  const kv = ctx.env.OUTCOMES_KV;
  const { request } = ctx;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }), 
      { 
        status: 405,
        headers: { 
          'content-type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }

  try {
    let payload: CallOutcomePayload;
    
    try {
      payload = await request.json();
    } catch (jsonError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }), 
        { 
          status: 400,
          headers: { 
            'content-type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // Validate required fields
    if (!payload.outcome || !payload.callId || !payload.agent) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: outcome, callId, agent' 
        }), 
        { 
          status: 400,
          headers: { 
            'content-type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // Validate outcome values
    const validOutcomes = ['Répondu_Humain', 'Répondeur', 'Pas_Joignable'];
    if (!validOutcomes.includes(payload.outcome)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}` 
        }), 
        { 
          status: 400,
          headers: { 
            'content-type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    console.log('Call outcome received:', payload);

    // Store the outcome in KV for PowerDialer to potentially retrieve
    const outcomeData = {
      ...payload,
      timestamp: new Date().toISOString(),
      processed: false
    };

    try {
      // Store with callId as key for specific call tracking
      await kv.put(
        `outcome_${payload.callId}`, 
        JSON.stringify(outcomeData), 
        { expirationTtl: 86400 } // 24 hours
      );

      // Also store in agent's recent outcomes list
      const agentKey = `recent_outcomes_${payload.agent.toLowerCase()}`;
      const existingOutcomes = await kv.get(agentKey);
      let recentOutcomes = existingOutcomes ? JSON.parse(existingOutcomes) : [];

      recentOutcomes.unshift(outcomeData);
      recentOutcomes = recentOutcomes.slice(0, 10);

      await kv.put(
        agentKey,
        JSON.stringify(recentOutcomes),
        { expirationTtl: 86400 } // 24 hours
      );

      console.log(`Stored outcome for agent ${payload.agent}: ${payload.outcome}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Call outcome recorded successfully',
          callId: payload.callId,
          outcome: payload.outcome
        }), 
        { 
          status: 200,
          headers: { 
            'content-type': 'application/json',
            ...corsHeaders
          }
        }
      );

    } catch (kvError) {
      console.error('KV storage error:', kvError);
      return new Response(
        JSON.stringify({ error: 'Failed to store call outcome' }), 
        { 
          status: 500,
          headers: { 
            'content-type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

  } catch (error) {
    console.error('Unexpected error in call-outcome:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500,
        headers: { 
          'content-type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
};