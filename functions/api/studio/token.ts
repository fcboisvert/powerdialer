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

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    try {
        const { agent } = await request.json();
        if (!agent) {
            return new Response(JSON.stringify({ error: 'missing agent' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Use a simpler approach - base64 encode everything
        const now = Math.floor(Date.now() / 1000);
        const exp = now + 3600; // 1 hour

        // Create the JWT manually with proper structure
        const header = JSON.stringify({
            typ: 'JWT',
            alg: 'HS256',
            cty: 'twilio-fpa;v=1'
        });

        const payload = JSON.stringify({
            jti: `${env.TWILIO_API_KEY}-${now}`,
            iss: env.TWILIO_API_KEY,
            sub: env.TWILIO_ACCOUNT_SID,
            iat: now,
            exp: exp,
            grants: {
                identity: agent,
                voice: {
                    incoming: { allow: true },
                    outgoing: {
                        application_sid: env.TWILIO_TWIML_APP_SID
                    }
                }
            }
        });

        // Base64URL encode
        const base64urlEscape = (str: string) => {
            return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        };

        const encodedHeader = base64urlEscape(btoa(header));
        const encodedPayload = base64urlEscape(btoa(payload));

        // Create signature
        const encoder = new TextEncoder();
        const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(env.TWILIO_API_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signature = await crypto.subtle.sign('HMAC', key, data);
        const encodedSignature = base64urlEscape(btoa(String.fromCharCode(...new Uint8Array(signature))));

        const token = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

        // Debug log
        console.log('Token generated for:', agent);

        return new Response(JSON.stringify({ token }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error: any) {
        console.error('Token generation error:', error);
        return new Response(JSON.stringify({
            error: 'Token generation failed',
            details: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
};