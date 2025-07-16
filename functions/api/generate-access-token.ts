// functions/api/generate-access-token.ts
import { SignJWT } from 'jose';

export interface Env {
  ACCOUNT_SID: string;
  AUTH_TOKEN: string;
  TWIML_APP_SID: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const identity = url.searchParams.get('identity');

  const allowedIdentities = ['frederic', 'simon'];
  if (!identity || !allowedIdentities.includes(identity)) {
    return new Response(JSON.stringify({ error: 'Unauthorized identity' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { ACCOUNT_SID, AUTH_TOKEN, TWIML_APP_SID } = env;
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const jwt = await new SignJWT({
    scope: `scope:client:outgoing?appSid=${TWIML_APP_SID}&clientName=${identity}`,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(iat)
    .setIssuer(ACCOUNT_SID)
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(AUTH_TOKEN));

  return new Response(JSON.stringify({ token: jwt }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
