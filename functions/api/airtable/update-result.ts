// functions/api/airtable/update-result.ts
/**
 * POST /airtable/update-result
 * Updates Airtable record with call result via Make.com webhook
 * 
 * Expected body:
 * {
 *   "activityName": "SPARK Microsystems-Jean-Sebastien Poirier-T2-0.3 Cold Call 1",
 *   "result": "Boite_Vocale",
 *   "notes": "Message laissé automatiquement", 
 *   "agent": "frederic"
 * }
 */

interface UpdateResultPayload {
  activityName: string;
  result: string;
  notes: string;
  agent: string;
}

export const onRequest: PagesFunction<{ 
  RESULTS_KV: KVNamespace,
  MAKE_AIRTABLE_WEBHOOK?: string,
  AIRTABLE_API_KEY?: string,
  AIRTABLE_BASE_ID?: string,
  AIRTABLE_TABLE_NAME?: string
}> = async (ctx) => {
  const { request, env } = ctx;
  const kv = env.RESULTS_KV;
  
  // Add CORS headers for browser requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight requests
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
    let payload: UpdateResultPayload;
    
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
    if (!payload.activityName || !payload.result || !payload.agent) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: activityName, result, agent' 
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

    // Validate result values
    const validResults = [
      'S_O', 'Rencontre_Expl._Planifiee', 'Rencontre_Besoin_Planifiee',
      'Visite_Planifiee', 'Offre_Planifiee', 'Touchbase_Planifiee',
      'Relancer_Dans_X', 'Info_Par_Courriel', 'Boite_Vocale',
      'Pas_Joignable', 'Pas_Interesse', 'Demande_Lien_Booking',
      'Me_Refere_Interne', 'Me_Refere_Externe'
    ];
    
    if (!validResults.includes(payload.result)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid result. Must be one of: ${validResults.join(', ')}` 
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

    console.log('Updating call result:', payload);

    // Prepare data for storage/forwarding
    const updateData = {
      ...payload,
      timestamp: new Date().toISOString(),
      status: 'processing'
    };

    // Store the update request in KV for tracking
    try {
      const updateKey = `update_${Date.now()}_${payload.agent}`;
      await kv.put(
        updateKey,
        JSON.stringify(updateData),
        { expirationTtl: 3600 } // 1 hour
      );
    } catch (kvError) {
      console.error('KV storage warning:', kvError);
      // Continue even if KV storage fails
    }

    // Option 1: Use Make.com webhook (RECOMMENDED)
    if (env.MAKE_AIRTABLE_WEBHOOK) {
      try {
        const makeResponse = await fetch(env.MAKE_AIRTABLE_WEBHOOK, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            activityName: payload.activityName,
            result: payload.result,
            notes: payload.notes,
            agent: payload.agent,
            timestamp: new Date().toISOString()
          })
        });

        if (!makeResponse.ok) {
          throw new Error(`Make.com webhook failed: ${makeResponse.status} ${makeResponse.statusText}`);
        }

        const makeResult = await makeResponse.text();
        console.log('Make.com webhook response:', makeResult);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Call result updated via Make.com',
            method: 'make_webhook',
            data: payload 
          }), 
          { 
            status: 200,
            headers: { 
              'content-type': 'application/json',
              ...corsHeaders
            }
          }
        );

      } catch (makeError) {
        console.error('Make.com webhook error:', makeError);
        
        // Fall back to storing in KV
        try {
          await kv.put(
            `failed_update_${Date.now()}`,
            JSON.stringify({ ...updateData, error: makeError.message }),
            { expirationTtl: 86400 } // 24 hours for failed updates
          );
        } catch (kvError) {
          console.error('KV fallback storage error:', kvError);
        }

        return new Response(
          JSON.stringify({ 
            error: 'Failed to update via Make.com webhook',
            details: makeError.message 
          }), 
          { 
            status: 500,
            headers: { 
              'content-type': 'application/json',
              ...corsHeaders
            }
          }
        );
      }
    }

    // Option 2: Direct Airtable API (if configured)
    if (env.AIRTABLE_API_KEY && env.AIRTABLE_BASE_ID && env.AIRTABLE_TABLE_NAME) {
      try {
        // Note: This is a simplified example - you'd need to find the record ID first
        const airtableResponse = await fetch(
          `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_NAME}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              records: [
                {
                  // You would need to implement record lookup by activityName
                  fields: {
                    "Resultat_Appel": payload.result,
                    "Notes": payload.notes,
                    "Updated_By": payload.agent,
                    "Updated_At": new Date().toISOString()
                  }
                }
              ]
            })
          }
        );

        if (!airtableResponse.ok) {
          throw new Error(`Airtable API failed: ${airtableResponse.status}`);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Call result updated via Airtable API',
            method: 'airtable_direct',
            data: payload 
          }), 
          { 
            status: 200,
            headers: { 
              'content-type': 'application/json',
              ...corsHeaders
            }
          }
        );

      } catch (airtableError) {
        console.error('Airtable API error:', airtableError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update via Airtable API',
            details: airtableError.message 
          }), 
          { 
            status: 500,
            headers: { 
              'content-type': 'application/json',
              ...corsHeaders
            }
          }
        );
      }
    }

    // No update method configured
    return new Response(
      JSON.stringify({ 
        success: false,
        message: 'No update method configured. Please set MAKE_AIRTABLE_WEBHOOK or Airtable API credentials.',
        stored: true,
        data: payload
      }), 
      { 
        status: 200,
        headers: { 
          'content-type': 'application/json',
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error('Unexpected error in airtable/update-result:', error);
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