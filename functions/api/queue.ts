/**
 * Cloudflare Pages Function: Airtable Call Queue API (Agent-facing)
 * GET  /api/queue?agent=Frédéric-Charles Boisvert   → fetches queue from Airtable view
 * POST /api/queue   { id, status }                  → patches call status in Airtable
 */

interface Env {
  AIRTABLE_TOKEN: string;
  AIRTABLE_BASE: string;
  AIRTABLE_TABLE: string;
}

const FIELD_STATUS = "Statut de l'Activité";
const FIELD_AGENT = "Responsable de l'Activité";
const FIELD_PRIORITY = "Priorité";
const FIELD_MOBILE = "Mobile Phone";
const FIELD_DIRECT = "Direct Phone";
const FIELD_COMPANY = "Company Phone";

// Map agent to view names
const VIEW_MAP: Record<string, string> = {
  "Simon McConnell": "To Call View - simon",
  "Frédéric-Charles Boisvert": "To Call View - frederic",
};

type AirtableRecord = {
  id: string;
  fields: Record<string, any>;
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const url = new URL(request.url);

  // Standard CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle CORS preflight
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });

  // GET: Pull live queue for agent from Airtable
  if (request.method === "GET") {
    const agent = url.searchParams.get("agent");
    if (!agent)
      return resp({ error: "Missing 'agent' query parameter" }, 400, corsHeaders);

    const view = VIEW_MAP[agent];
    if (!view)
      return resp({ error: "Unknown agent or missing view mapping" }, 400, corsHeaders);

    const apiUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE}/${encodeURIComponent(
      env.AIRTABLE_TABLE
    )}?view=${encodeURIComponent(view)}&sort[0][field]=${encodeURIComponent(
      FIELD_PRIORITY
    )}&sort[0][direction]=asc`;

    try {
      const records = await fetchAllAirtable(apiUrl, env.AIRTABLE_TOKEN);

      // Map fields: always return phone fallback array and useful info
      const leads = records.map((rec) => ({
        id: rec.id,
        name: rec.fields["Full Name"] ?? "",
        phones: [
          rec.fields[FIELD_MOBILE] ?? null,
          rec.fields[FIELD_DIRECT] ?? null,
          rec.fields[FIELD_COMPANY] ?? null,
        ].filter(Boolean),
        mobile: rec.fields[FIELD_MOBILE] ?? null,
        direct: rec.fields[FIELD_DIRECT] ?? null,
        company: rec.fields[FIELD_COMPANY] ?? null,
        priority: rec.fields[FIELD_PRIORITY] ?? null,
        opportunity: rec.fields["Opportunity"] ?? "",
        statut: rec.fields[FIELD_STATUS] ?? "",
        agent: rec.fields[FIELD_AGENT] ?? "",
        linkedin: rec.fields["Contact LinkedIn URL"] ?? "",
      }));

      return resp(leads, 200, corsHeaders);
    } catch (err) {
      console.error("Airtable fetch error:", err);
      return resp({ error: "Failed to fetch queue from Airtable" }, 502, corsHeaders);
    }
  }

  // POST: Update lead status in Airtable
  if (request.method === "POST") {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return resp({ error: "Invalid JSON in request body" }, 400, corsHeaders);
    }
    const { id, status } = body;
    if (!id || !status)
      return resp({ error: "id and status required" }, 400, corsHeaders);

    const patchUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE}/${encodeURIComponent(
      env.AIRTABLE_TABLE
    )}`;

    try {
      const res = await fetch(patchUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${env.AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: [
            {
              id,
              fields: {
                [FIELD_STATUS]: status,
              },
            },
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return resp({ error: "Airtable update failed", details: err }, res.status, corsHeaders);
      }

      return resp({ ok: true }, 200, corsHeaders);
    } catch (err) {
      console.error("Airtable patch error:", err);
      return resp({ error: "Failed to update lead in Airtable" }, 502, corsHeaders);
    }
  }

  return resp({ error: "Method Not Allowed" }, 405, corsHeaders);
};

// Helpers
function resp(data: any, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

// Handles  Airtable pagination (up to thousands of records)
async function fetchAllAirtable(
  baseUrl: string,
  token: string
): Promise<AirtableRecord[]> {
  let records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const url = offset ? `${baseUrl}&offset=${offset}` : baseUrl;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Airtable fetch failed");
    const json = await res.json();
    records = records.concat(json.records);
    offset = json.offset;
  } while (offset);
  return records;
}
