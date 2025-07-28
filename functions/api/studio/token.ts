/// <reference types="@cloudflare/workers-types" />

interface Env {
    TWILIO_ACCOUNT_SID: string;
    TWILIO_API_KEY: string;
    TWILIO_API_SECRET: string;
    TWILIO_TWIML_APP_SID: string;
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

// Base64 URL encoding helper
function base64url(str: string): string {
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    try {
        // Parse request body
        let body: any;
        try {
            body = await request.json();
        } catch (e) {
            return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Extract agent from body
        const agent = body?.agent;

        if (!agent) {
            return new Response(JSON.stringify({ error: 'missing agent', received: body }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Log for debugging
        console.log('Generating token for agent:', agent);

        // For Cloudflare Workers, we need to use crypto.subtle for HMAC
        const now = Math.floor(Date.now() / 1000);
        const expires = now + 3600;

        const header = {
            typ: 'JWT',
            alg: 'HS256',
            cty: 'twilio-fpa;v=1'
        };

        const grants = {
            identity: agent,
            voice: {
                incoming: { allow: true },
                outgoing: {
                    application_sid: env.TWILIO_TWIML_APP_SID
                }
            }
        };

        const payload = {
            jti: `${env.TWILIO_API_KEY}-${now}`,
            iss: env.TWILIO_API_KEY,
            sub: env.TWILIO_ACCOUNT_SID,
            nbf: now,
            exp: expires,
            grants: grants
        };

        const headerStr = base64url(JSON.stringify(header));
        const payloadStr = base64url(JSON.stringify(payload));
        const toSign = `${headerStr}.${payloadStr}`;

        // Create HMAC-SHA256 signature using Web Crypto API
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(env.TWILIO_API_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signature = await crypto.subtle.sign(
            'HMAC',
            key,
            encoder.encode(toSign)
        );

        const signatureStr = base64url(String.fromCharCode(...new Uint8Array(signature)));
        const token = `${toSign}.${signatureStr}`;

        return new Response(JSON.stringify({ token }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error: any) {
        console.error('Token generation error:', error);
        return new Response(JSON.stringify({
            error: 'Token generation failed',
            details: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
};