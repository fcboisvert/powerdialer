// functions/api/studio/execution-status/[executionSid].js
// Optimized Cloudflare Pages Function for execution status

export async function onRequestGet({ request, env, params }) {
  try {
    // More permissive CORS headers for development
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const { executionSid } = params;
    const url = new URL(request.url);
    const flowSid = url.searchParams.get('flowSid');

    // Enhanced validation
    if (!executionSid || !executionSid.startsWith('EX')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Valid Execution SID is required',
          code: 'INVALID_EXECUTION_SID'
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    if (!flowSid || !flowSid.startsWith('FW')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Valid Flow SID query parameter is required',
          code: 'INVALID_FLOW_SID'
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    // Get Twilio credentials
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.error('Missing Twilio credentials');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Service configuration error',
          code: 'MISSING_CREDENTIALS'
        }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    // Check cache first with better error handling
    const executionKey = `execution_${executionSid}`;
    let cachedExecution = null;
    
    try {
      const cachedData = await env.OUTCOMES_KV.get(executionKey);
      if (cachedData) {
        cachedExecution = JSON.parse(cachedData);
        console.log(`Cache hit for execution: ${executionSid}`);
        
        // If we have a recent webhook outcome, return it quickly
        if (cachedExecution.outcome && cachedExecution.webhookReceived) {
          const webhookAge = Date.now() - new Date(cachedExecution.webhookReceived).getTime();
          if (webhookAge < 30000) { // Less than 30 seconds old
            return new Response(
              JSON.stringify({
                success: true,
                execution: {
                  sid: cachedExecution.sid,
                  status: 'ended',
                  dateCreated: cachedExecution.createdAt,
                  dateUpdated: cachedExecution.updatedAt,
                  contactChannelAddress: cachedExecution.contactChannelAddress,
                  outcome: cachedExecution.outcome,
                  answeredBy: cachedExecution.answeredBy,
                  fromCache: true,
                  cacheAge: Math.round(webhookAge / 1000)
                },
                cached: true,
                timestamp: new Date().toISOString()
              }),
              { 
                headers: { 
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-cache',
                  ...corsHeaders 
                } 
              }
            );
          }
        }
      }
    } catch (kvError) {
      console.warn('KV cache error:', kvError.message);
    }

    // Prepare Twilio API call with timeout
    const twilioAuth = btoa(`${accountSid}:${authToken}`);
    const twilioUrl = `https://studio.twilio.com/v2/Flows/${flowSid}/Executions/${executionSid}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const twilioResponse = await fetch(twilioUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Texion-PowerDialer/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!twilioResponse.ok) {
        const errorText = await twilioResponse.text();
        console.error('Twilio API Error:', {
          status: twilioResponse.status,
          url: twilioUrl,
          error: errorText
        });
        
        // Return cached data if available when API fails
        if (cachedExecution) {
          console.log('Fallback to cached data due to API error');
          return new Response(
            JSON.stringify({
              success: true,
              execution: {
                sid: cachedExecution.sid,
                status: cachedExecution.status || 'unknown',
                dateCreated: cachedExecution.createdAt,
                dateUpdated: cachedExecution.updatedAt || cachedExecution.createdAt,
                contactChannelAddress: cachedExecution.contactChannelAddress,
                outcome: cachedExecution.outcome,
                answeredBy: cachedExecution.answeredBy,
                fromCache: true
              },
              warning: 'Data served from cache due to API unavailability',
              cached: true,
              timestamp: new Date().toISOString()
            }),
            { 
              headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                ...corsHeaders 
              } 
            }
          );
        }

        // No cache available, return specific error
        const statusCode = twilioResponse.status >= 500 ? 502 : twilioResponse.status;
        return new Response(
          JSON.stringify({
            success: false,
            error: `Twilio API returned ${twilioResponse.status}`,
            code: 'TWILIO_API_ERROR',
            details: errorText
          }),
          { 
            status: statusCode,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            } 
          }
        );
      }

      const execution = await twilioResponse.json();
      console.log(`Execution status retrieved: ${executionSid} - ${execution.status}`);

      // Prepare execution data for cache update
      const executionData = {
        sid: execution.sid,
        status: execution.status,
        contactChannelAddress: execution.contact_channel_address,
        flowSid: flowSid,
        createdAt: execution.date_created,
        updatedAt: execution.date_updated || new Date().toISOString(),
        lastChecked: new Date().toISOString(),
        // Preserve webhook data if it exists
        ...(cachedExecution && {
          parameters: cachedExecution.parameters,
          to: cachedExecution.to,
          from: cachedExecution.from,
          outcome: cachedExecution.outcome,
          answeredBy: cachedExecution.answeredBy,
          webhookReceived: cachedExecution.webhookReceived
        })
      };

      // Update cache with error handling
      try {
        await env.OUTCOMES_KV.put(executionKey, JSON.stringify(executionData), {
          expirationTtl: 86400 // 24 hours
        });
      } catch (kvError) {
        console.warn('Failed to update OUTCOMES_KV:', kvError.message);
      }

      // Fetch execution context for completed executions
      let executionContext = null;
      if (execution.status === 'ended') {
        try {
          const contextUrl = `https://studio.twilio.com/v2/Flows/${flowSid}/Executions/${executionSid}/ExecutionContext`;
          const contextController = new AbortController();
          const contextTimeoutId = setTimeout(() => contextController.abort(), 10000);

          const contextResponse = await fetch(contextUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${twilioAuth}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Texion-PowerDialer/1.0'
            },
            signal: contextController.signal
          });

          clearTimeout(contextTimeoutId);

          if (contextResponse.ok) {
            const contextData = await contextResponse.json();
            executionContext = contextData.context;
            
            // Store final outcome in results KV
            if (executionContext) {
              const resultKey = `result_${executionSid}`;
              const resultData = {
                executionSid: executionSid,
                flowSid: flowSid,
                outcome: executionContext.outcome || executionContext.CallStatus || 'completed',
                answeredBy: executionContext.AnsweredBy,
                callDuration: executionContext.CallDuration,
                context: executionContext,
                completedAt: new Date().toISOString(),
                contactChannelAddress: execution.contact_channel_address
              };

              try {
                await env.RESULTS_KV.put(resultKey, JSON.stringify(resultData), {
                  expirationTtl: 604800 // 7 days
                });
                console.log(`Final outcome stored: ${executionSid} - ${resultData.outcome}`);
              } catch (kvError) {
                console.warn('Failed to store result in RESULTS_KV:', kvError.message);
              }
            }
          }
        } catch (contextError) {
          console.warn('Error fetching execution context:', contextError.message);
        }
      }

      // Return successful response
      return new Response(
        JSON.stringify({
          success: true,
          execution: {
            sid: execution.sid,
            status: execution.status,
            dateCreated: execution.date_created,
            dateUpdated: execution.date_updated,
            contactChannelAddress: execution.contact_channel_address,
            // Include context data if available
            ...(executionContext && { 
              context: executionContext,
              outcome: executionContext.outcome || executionContext.CallStatus,
              answeredBy: executionContext.AnsweredBy 
            }),
            // Include cached outcome if available
            ...(cachedExecution?.outcome && {
              outcome: cachedExecution.outcome,
              answeredBy: cachedExecution.answeredBy
            })
          },
          cached: false,
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            ...corsHeaders 
          } 
        }
      );

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        // Return cached data on timeout if available
        if (cachedExecution) {
          return new Response(
            JSON.stringify({
              success: true,
              execution: {
                sid: cachedExecution.sid,
                status: cachedExecution.status || 'unknown',
                dateCreated: cachedExecution.createdAt,
                dateUpdated: cachedExecution.updatedAt,
                contactChannelAddress: cachedExecution.contactChannelAddress,
                fromCache: true
              },
              warning: 'Data served from cache due to timeout',
              cached: true,
              timestamp: new Date().toISOString()
            }),
            { 
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders 
              } 
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: 'Request timeout - Twilio API took too long to respond',
            code: 'TIMEOUT_ERROR'
          }),
          { 
            status: 504, 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            } 
          }
        );
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error('Execution status function error:', {
      error: error.message,
      stack: error.stack,
      executionSid: params?.executionSid,
      timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }
}

// Optimized manual status updates
export async function onRequestPost({ request, env, params }) {
  try {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    const { executionSid } = params;
    const body = await request.json();
    const { status, outcome, notes, agent } = body;

    if (!executionSid || !status) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Execution SID and status are required',
          code: 'MISSING_REQUIRED_FIELDS'
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    // Get and update execution data
    const executionKey = `execution_${executionSid}`;
    let executionData = {};
    
    try {
      const existingData = await env.OUTCOMES_KV.get(executionKey);
      if (existingData) {
        executionData = JSON.parse(existingData);
      }
    } catch (kvError) {
      console.warn('Error reading existing execution data:', kvError.message);
    }

    // Update execution data
    const updatedData = {
      ...executionData,
      status: status,
      updatedAt: new Date().toISOString(),
      manualUpdate: true,
      ...(outcome && { outcome }),
      ...(notes && { notes }),
      ...(agent && { agent })
    };

    // Store updated data
    await env.OUTCOMES_KV.put(executionKey, JSON.stringify(updatedData), {
      expirationTtl: 86400
    });

    // Store final result if outcome provided
    if (outcome) {
      const resultKey = `result_${executionSid}`;
      const resultData = {
        executionSid: executionSid,
        outcome: outcome,
        notes: notes,
        agent: agent,
        status: status,
        manualEntry: true,
        timestamp: new Date().toISOString(),
        contactChannelAddress: executionData.contactChannelAddress
      };

      try {
        await env.RESULTS_KV.put(resultKey, JSON.stringify(resultData), {
          expirationTtl: 604800
        });
      } catch (kvError) {
        console.warn('Failed to store manual result:', kvError.message);
      }
    }

    console.log(`Manual status update: ${executionSid} - ${status} by ${agent || 'unknown'}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Execution status updated successfully',
        executionSid: executionSid,
        status: status,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );

  } catch (error) {
    console.error('Manual update error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to update execution status',
        code: 'UPDATE_ERROR'
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function onRequestOptions({ request }) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}