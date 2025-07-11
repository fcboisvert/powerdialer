/**
 * Cloudflare Pages Function: Airtable Call Queue API (Agent-facing)
 * GET  /api/queue?agent=Frédéric-Charles Boisvert → fetches queue from Airtable view
 * POST /api/queue { id, status }                  → patches call status in Airtable
 */

interface Env {
  AIRTABLE_TOKEN: string;
  AIRTABLE_BASE: string;
  AIRTABLE_TABLE: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const FIELD_KEYS = {
  fullName: "Full Name",
  priority: "Priorité",
  mobile: "Mobile Phone",
  direct: "Direct Phone",
  company: "Company Phone",
  status: "Statut de l'Activité",
  agent: "Responsable de l'Activité",
};

const VIEW_MAP: Record<string, string> = {
  "Simon McConnell": "To Call View - simon",
  "Frédéric-Charles Boisvert": "To Call View - frederic",
};

type AirtableRecord = {
  id: string;
  fields: Record<string, any>;
};

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const method = request.method;

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  if (method === "GET") {
    const agent = url.searchParams.get("agent");
    if (!agent || !VIEW_MAP[agent]) {
      return respond({ error: "Invalid or missing 'agent'" }, 400);
    }

    const view = VIEW_MAP[agent];
    const baseUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE}/${encodeURIComponent(env.AIRTABLE_TABLE)}`;
    const query = `?view=${encodeURIComponent(view)}&sort[0][field]=${encodeURIComponent(FIELD_KEYS.priority)}&sort[0][direction]=asc`;

    try {
      const records = await fetchAllAirtable(`${baseUrl}${query}`, env.AIRTABLE_TOKEN);
      const leads = records.map(mapAirtableRecord);
      return respond(leads, 200);
    } catch (err) {
      console.error("Airtable GET error:", err);
      return respond({ error: "Failed to fetch queue" }, 502);
    }
  }

  if (method === "POST") {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return respond({ error: "Invalid JSON in body" }, 400);
    }

    const { id, status } = body;
    if (!id || !status) return respond({ error: "'id' and 'status' required" }, 400);

    try {
      const patchUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE}/${encodeURIComponent(env.AIRTABLE_TABLE)}`;
      const patchBody = {
        records: [{ id, fields: { [FIELD_KEYS.status]: status } }],
      };

      const res = await fetch(patchUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${env.AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patchBody),
      });

      if (!res.ok) {
        const details = await res.text();
        return respond({ error: "Airtable update failed", details }, res.status);
      }

      return respond({ ok: true }, 200);
    } catch (err) {
      console.error("Airtable PATCH error:", err);
      return respond({ error: "Failed to update lead" }, 502);
    }
  }

  return respond({ error: "Method Not Allowed" }, 405);
};

// ─────────── Utilities ─────────── //

const respond = (data: any, status: number): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

async function fetchAllAirtable(baseUrl: string, token: string): Promise<AirtableRecord[]> {
  let records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = offset ? `${baseUrl}&offset=${offset}` : baseUrl;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable fetch failed with status ${res.status}`);
    const json = await res.json();
    records = records.concat(json.records || []);
    offset = json.offset;
  } while (offset);

  return records;
}

function mapAirtableRecord(rec: AirtableRecord) {
  const f = rec.fields;
  const safe = (key: string) => (f[key] ?? "").toString().trim();

  return {
    id: rec.id,
    Full_Name: safe("Full Name"),
    Job_Title: safe("Job Title"),
    Nom_de_la_compagnie: safe("Nom de la compagnie"),
    LinkedIn_URL: safe("Contact LinkedIn URL"),
    Mobile_Phone: safe("Mobile Phone"),
    Direct_Phone: safe("Direct Phone"),
    Company_Phone: safe("Company Phone"),
    Nom_de_l_Activite: safe("Nom de l'Activite"),
    Priorite: safe("Priorité"),
    Date_et_Heure_Rencontre: safe("Notes Rencontres"),
    Statut_de_l_Activite: safe("Statut de l'Activité"),
    Linked_Notes: safe("Linked Notes"),
    Flow_URL: safe("Flow URL"),
    Message_content: safe("Message content"),
    Resultat_Appel: safe("Résultat (Appel)"),
    Opportunity: safe("Opportunity"),
    "Activité 2.0": safe("Activité 2.0"),
    "Activité 2.0 H.C.": safe("Activité 2.0 H.C."),
    "Responsable de l'Activité": safe("Responsable de l'Activité"),
    "Nom du Responsable": safe("Nom du Responsable"),
    Entreprise: safe("Entreprise (from Opportunity)"),
    "Type d'Activité 2.0": safe("Type d'Activité 2.0"),
    Call_Triggered: safe("Call Triggered"),
  };
}
