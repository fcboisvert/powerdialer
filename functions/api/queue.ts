// functions/api/queue.ts
/**
 *  POST /queue   →  body = { agent: "frederic", leads: [...] }
 *  GET  /queue?agent=frederic →  returns JSON array
 *
 *  Storage: Cloudflare KV (QUEUE_KV) – add 1 KV binding in the Pages dashboard
 */
export const onRequest: PagesFunction<{ QUEUE_KV: KVNamespace }> = async (
  ctx
) => {
  const kv = ctx.env.QUEUE_KV;
  const { request } = ctx;
  
  // Add CORS headers for browser requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const agent = (url.searchParams.get("agent") || "").toLowerCase();

    if (request.method === "POST") {
      // ---------- push list from Make ----------
      let body;
      
      try {
        body = await request.json();
      } catch (jsonError) {
        return new Response(
          JSON.stringify({ error: "Invalid JSON in request body" }), 
          { 
            status: 400,
            headers: { 
              "content-type": "application/json",
              ...corsHeaders
            }
          }
        );
      }

      const { agent: a, leads } = body as {
        agent: string;
        leads: unknown[];
      };

      // Validate request body
      if (!a || typeof a !== 'string') {
        return new Response(
          JSON.stringify({ error: "Missing or invalid 'agent' field" }), 
          { 
            status: 400,
            headers: { 
              "content-type": "application/json",
              ...corsHeaders
            }
          }
        );
      }

      if (!Array.isArray(leads)) {
        return new Response(
          JSON.stringify({ error: "'leads' must be an array" }), 
          { 
            status: 400,
            headers: { 
              "content-type": "application/json",
              ...corsHeaders
            }
          }
        );
      }

      // Store in KV with error handling
      try {
        await kv.put(
          a.toLowerCase(), 
          JSON.stringify(leads), 
          { expirationTtl: 3600 }
        );
        
        return new Response(
          JSON.stringify({ success: true, message: "Queue updated" }), 
          { 
            status: 200,
            headers: { 
              "content-type": "application/json",
              ...corsHeaders
            }
          }
        );
      } catch (kvError) {
        console.error('KV put error:', kvError);
        return new Response(
          JSON.stringify({ error: "Failed to store data" }), 
          { 
            status: 500,
            headers: { 
              "content-type": "application/json",
              ...corsHeaders
            }
          }
        );
      }
    }

    if (request.method === "GET") {
      // ---------- front-end pulls queue ----------
      if (!agent) {
        return new Response(
          JSON.stringify({ error: "Missing 'agent' query parameter" }), 
          { 
            status: 400,
            headers: { 
              "content-type": "application/json",
              ...corsHeaders
            }
          }
        );
      }

      try {
        const raw = (await kv.get(agent)) || "[]";
        
        return new Response(raw, {
          headers: { 
            "content-type": "application/json",
            ...corsHeaders
          }
        });
      } catch (kvError) {
        console.error('KV get error:', kvError);
        return new Response(
          JSON.stringify({ error: "Failed to retrieve data" }), 
          { 
            status: 500,
            headers: { 
              "content-type": "application/json",
              ...corsHeaders
            }
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }), 
      { 
        status: 405,
        headers: { 
          "content-type": "application/json",
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }), 
      { 
        status: 500,
        headers: { 
          "content-type": "application/json",
          ...corsHeaders
        }
      }
    );
  }
};