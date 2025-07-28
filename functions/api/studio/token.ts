/// <reference types="@cloudflare/workers-types" />
import * as twilio from '@twilio/voice-sdk';

interface Env {
    TWILIO_ACCOUNT_SID: string;
    TWILIO_API_KEY: string;
    TWILIO_API_SECRET: string;
    FLOW_SID: string;
    TWILIO_TWIML_APP_SID: string;

}

interface Payload {
    agent: string;
}
// OPTIONS (CORS preflight)
export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
};
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    let payload: Payload;

    try {
        payload = (await request.json()) as typeof payload;
    } catch {
        return json({ error: 'Body must be valid JSON' }, 400);
    }

    const { agent } = payload;
    if (!agent) {
        return json({ error: 'missing agent' }, 400);
    }

    const accessToken = new twilio.jwt.AccessToken(
        env.TWILIO_ACCOUNT_SID,
        env.TWILIO_API_KEY,
        env.TWILIO_API_SECRET,
        { identity: agent }
    )
    const grant = new twilio.jwt.AccessToken.VoiceGrant({
        incomingAllow: true,
        outgoingApplicationSid: env.TWILIO_TWIML_APP_SID,
    })
    accessToken.addGrant(grant)

    return json({ token: accessToken.toJwt() })
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",  // Wildcard for dev; scope to texion.app later
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
};

/* ---------- Small helper ---------- */
const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });


// identity = nameGenerator();

// const accessToken = new AccessToken(
//     config.accountSid,
//     config.apiKey,
//     config.apiSecret
// );
// accessToken.identity = identity;
// const grant = new VoiceGrant({
//     outgoingApplicationSid: config.twimlAppSid,
//     incomingAllow: true,
// });
// accessToken.addGrant(grant);

// // Include identity and token in a JSON response
// return {
//     identity: identity,
//     token: accessToken.toJwt(),
// };
// };