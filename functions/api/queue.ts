// functions/queue.ts
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
  const url = new URL(request.url);
  const agent = (url.searchParams.get("agent") || "").toLowerCase();

  if (request.method === "POST") {
    // ---------- push list from Make ----------
    const { agent: a, leads } = (await request.json()) as {
      agent: string;
      leads: unknown[];
    };
    if (!a || !Array.isArray(leads))
      return new Response("Bad body", { status: 400 });
    await kv.put(a.toLowerCase(), JSON.stringify(leads), { expirationTtl: 3600 });
    return new Response("OK", { status: 204 });
  }

  if (request.method === "GET") {
    // ---------- front-end pulls queue ----------
    if (!agent) return new Response("Missing agent", { status: 400 });
    const raw = (await kv.get(agent)) || "[]";
    return new Response(raw, {
      headers: { "content-type": "application/json" }
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
};
