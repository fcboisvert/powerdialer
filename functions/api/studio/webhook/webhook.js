// functions/api/studio/webhook.js
// Webhook handler for Studio Flow events

export async function onRequestPost({ request, env }) {
  try {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Twilio-Signature',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Parse webhook data from Studio Flow
    const formData = await request.formData();
    const webhookData = {};
    
    // Convert FormData to object
    for (const [key, value] of formData.entries()) {
      webhookData[key] = value;
    }

    console.log('Studio webhook received:', {
      executionSid: webhookData.ExecutionSid,
      flowSid: webhookData.FlowSid,
      stepName: webhookData.StepName,
      outcome: webhookData.outcome,
      answeredBy: webhookData.AnsweredBy,
      callStatus: webhookData.CallStatus,
      timestamp: new Date().toISOString()
    });

    const {
      ExecutionSid,
      FlowSid,
      StepName,
      StepType,
      StepStatus,
      CallStatus,
      AnsweredBy,
      outcome,
      number,
      activity,
      callId,
      agent,
      leadName,
      company,
      callDuration
    } = webhookData;

    // Validate required fields
    if (!ExecutionSid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing ExecutionSid in webhook data'
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

    // Determine the outcome based on the webhook data
    let finalOutcome = outcome;
    
    // If no outcome provided, determine from AnsweredBy
    if (!finalOutcome && AnsweredBy) {
      switch (AnsweredBy.toLowerCase()) {
        case 'human':
          finalOutcome = 'Répondu_Humain';
          break;
        case 'machine':
        case 'machine_start':
        case 'machine_end_beep':
        case 'machine_end_silence':
          finalOutcome = 'Boite_Vocale';
          break;
        case 'fax':
          finalOutcome = 'Pas_Joignable';
          break;
        default:
          finalOutcome = 'Pas_Joignable';
      }
    }

    // If still no outcome, check call status
    if (!finalOutcome && CallStatus) {
      switch (CallStatus.toLowerCase()) {
        case 'completed':
          finalOutcome = 'Répondu_Humain';
          break;
        case 'busy':
        case 'no-answer':
        case 'failed':
        case 'canceled':
          finalOutcome = 'Pas_Joignable';
          break;
        default:
          finalOutcome = 'Pas_Joignable';
      }
    }

    // Default outcome if none determined
    if (!finalOutcome) {
      finalOutcome = 'Pas_Joignable';
    }

    // Store the outcome in KV storage
    try {
      // Update execution record in OUTCOMES_KV
      const executionKey = `execution_${ExecutionSid}`;
      let executionData = {};
      
      try {
        const existingData = await env.OUTCOMES_KV.get(executionKey);
        if (existingData) {
          executionData = JSON.parse(existingData);
        }
      } catch (parseError) {
        console.warn('Error parsing existing execution data:', parseError.message);
      }

      // Update with webhook data
      const updatedExecutionData = {
        ...executionData,
        outcome: finalOutcome,
        answeredBy: AnsweredBy,
        callStatus: CallStatus,
        stepName: StepName,
        callDuration: callDuration,
        webhookReceived: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'ended' // Mark as ended when we receive outcome
      };

      await env.OUTCOMES_KV.put(executionKey, JSON.stringify(updatedExecutionData), {
        expirationTtl: 86400 // 24 hours
      });

      // Store final result in RESULTS_KV for reporting
      const resultKey = `result_${ExecutionSid}`;
      const resultData = {
        executionSid: ExecutionSid,
        flowSid: FlowSid,
        outcome: finalOutcome,
        answeredBy: AnsweredBy,
        callStatus: CallStatus,
        callDuration: callDuration,
        number: number,
        activity: activity,
        agent: agent,
        leadName: leadName,
        company: company,
        stepName: StepName,
        completedAt: new Date().toISOString(),
        webhookData: webhookData // Store complete webhook for debugging
      };

      await env.RESULTS_KV.put(resultKey, JSON.stringify(resultData), {
        expirationTtl: 604800 // 7 days for results
      });

      console.log(`Webhook processed successfully: ${ExecutionSid} - ${finalOutcome}`);

    } catch (kvError) {
      console.error('KV storage error in webhook:', {
        error: kvError.message,
        executionSid: ExecutionSid,
        timestamp: new Date().toISOString()
      });
      // Don't fail the webhook if storage fails - return success to Twilio
    }

    // Respond to Twilio that webhook was processed successfully
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
        executionSid: ExecutionSid,
        outcome: finalOutcome,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );

  } catch (error) {
    console.error('Webhook processing error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Always return 200 to Twilio to avoid retries
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Webhook processing failed',
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, // Return 200 to prevent Twilio retries
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }
}

// Handle GET requests for webhook URL verification
export async function onRequestGet({ request, env }) {
  return new Response(
    JSON.stringify({
      service: 'Texion PowerDialer Studio Webhook',
      status: 'active',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }),
    { 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      } 
    }
  );
}

// Handle OPTIONS requests for CORS
export async function onRequestOptions({ request }) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Twilio-Signature',
      'Access-Control-Max-Age': '86400'
    }
  });
}