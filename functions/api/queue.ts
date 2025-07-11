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

// ─────────── Constants ─────────── //
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

// ─────────── Handler ─────────── //
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
  return {
    id: rec.id,
    Full_Name: f["Full Name"] ?? "",
    phones: [f["Mobile Phone"], f["Direct Phone"], f["Company Phone"]].filter(Boolean),
    Mobile_Phone: f["Mobile Phone"] ?? null,
    Direct_Phone: f["Direct Phone"] ?? null,
    Company_Phone: f["Company Phone"] ?? null,
    Job_Title: f["Job Title"] ?? "",
    Nom_de_la_compagnie: f["Nom de la compagnie"] ?? "",
    LinkedIn_URL: f["Contact LinkedIn URL"] ?? "",
    "Nom de l'Activite": f["Nom de l’Activité"] ?? "",
    Priorite: f["Priorité"] ?? null,
    Statut_de_l_Activite: f["Statut de l'Activité"] ?? "",
    Linked_Notes: f["Linked Notes"] ?? "",
    Rencontres: f["Rencontres"] ?? "",
    Opportunity: f["Opportunity"] ?? "",
    "Activité 2.0": f["Activité 2.0"] ?? "",
    "Activité 2.0 H.C.": f["Activité 2.0 H.C."] ?? "",
    "Responsable de l'Activité": f["Responsable de l'Activité"] ?? "",
    "Nom du Responsable": f["Nom du Responsable"] ?? "",
    Entreprise: f["Entreprise (from Opportunity)"] ?? "",
    "Type d'Activité 2.0": f["Type d'Activité 2.0"] ?? "",
    Message_content: f["Message content"] ?? "",
    Call_Triggered: f["Call Triggered"] ?? "",
    Resultat_Appel: f["Résultat (Appel)"] ?? "",
    "Date et Heure Rencontre": f["Date et Heure Rencontre"] ?? "",
    Flow_URL: f["Flow URL"] ?? "",
  };
}
