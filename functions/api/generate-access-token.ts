// functions/api/generate-access-token.ts

import jwt from 'jsonwebtoken';

export interface Env {
  ACCOUNT_SID: string;
  AUTH_TOKEN: string;
  TWIML_APP_SID: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const identity = url.searchParams.get('identity');

  const allowedIdentities = ['frederic', 'simon'];
  if (!identity || !allowedIdentities.includes(identity)) {
    return new Response(JSON.stringify({ error: 'Unauthorized identity' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { ACCOUNT_SID, AUTH_TOKEN, TWIML_APP_SID } = context.env;

  const exp = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const payload = {
    scope: `scope:client:outgoing?appSid=${TWIML_APP_SID}&clientName=${identity}`,
    iss: ACCOUNT_SID,
    exp,
  };

  const token = jwt.sign(payload, AUTH_TOKEN);

  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
