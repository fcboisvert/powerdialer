/**
 * Airtable Call-Queue API – Cloudflare Pages Function
 * GET  /api/queue?agent=frederic   → list leads from the agent’s “To Call” view
 * POST /api/queue                  → { id, status }  patch lead status
 */

interface Env {
  AIRTABLE_READ_TOKEN: string;
  AIRTABLE_WRITE_TOKEN: string;
  AIRTABLE_BASE: string;
  AIRTABLE_TABLE: string;
}

/* ───── Constants ───── */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const VIEW_BY_AGENT: Record<string, string> = {
  "Simon McConnell": "To Call View - simon",
  "Frédéric-Charles Boisvert": "To Call View - frederic",
};

const SLUG_TO_AGENT: Record<string, string> = {
  frederic: "Frédéric-Charles Boisvert",
  simon: "Simon McConnell",
};

const F_STATUS = "Statut de l'Activité";

/* ───── GET handler ───── */

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const raw = new URL(request.url).searchParams.get("agent") ?? "";
  const agentView =
    VIEW_BY_AGENT[raw] ??
    VIEW_BY_AGENT[SLUG_TO_AGENT[raw.toLowerCase()] ?? ""];

  if (!agentView) {
    return json({ error: "Invalid or missing 'agent' param" }, 400);
  }

  const baseUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE}/${encodeURIComponent(
    env.AIRTABLE_TABLE
  )}?view=${encodeURIComponent(agentView)}`;

  try {
    const records = await fetchAll(baseUrl, env.AIRTABLE_READ_TOKEN);
    return json(records.map(mapRecord), 200);
  } catch (err) {
    console.error("Airtable GET error:", err);
    console.log("env:", env);
    console.log("agent:", agentView);
    return json({ error: "Failed to fetch queue" }, 502);
  }
};

/* ───── POST handler ───── */

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { id?: string; status?: string };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Body must be valid JSON" }, 400);
  }

  const { id, status } = body;
  if (!id || !status) {
    return json({ error: "'id' and 'status' required" }, 400);
  }

  const patchUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE}/${encodeURIComponent(
    env.AIRTABLE_TABLE
  )}`;

  const res = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_WRITE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      records: [{ id, fields: { [F_STATUS]: status } }],
    }),
  });

  if (!res.ok) {
    const details = await res.text();
    return json({ error: "Airtable update failed", details }, res.status);
  }

  return json({ ok: true }, 200);
};

/* ───── Utilities ───── */

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

type AirtableRecord = {
  id: string;
  fields: Record<string, any>;
};

async function fetchAll(
  url: string,
  token: string
): Promise<AirtableRecord[]> {
  let out: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const finalUrl = offset ? `${url}&offset=${offset}` : url;
    const res = await fetch(finalUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) throw new Error(`Airtable status ${res.status}`);

    const json = (await res.json()) as {
      records: AirtableRecord[];
      offset?: string;
    };

    if (!Array.isArray(json.records) || json.records.length === 0) break;

    out = out.concat(json.records);
    offset = json.offset;
  } while (offset);

  return out;
}

function mapRecord(r: AirtableRecord) {
  const f = (k: string) => (r.fields[k] ?? "").toString().trim();

  return {
    id: r.id,
    Full_Name: f("Full Name"),
    Job_Title: f("Job Title"),
    Nom_de_la_compagnie: f("Nom de la compagnie"),
    LinkedIn_URL: f("Contact LinkedIn URL"),
    Mobile_Phone: f("Mobile Phone"),
    Direct_Phone: f("Direct Phone"),
    Company_Phone: f("Company Phone"),
    Nom_de_l_Activite:
      f("Nom de l’Activité") ||
      f("Nom de l’activité") ||
      f("Nom de l'activité") ||
      f("Nom de l'Activité") ||
      f("Nom de l_Activite"),
    Priorite: f("Priorité"),
    Notes_Rencontres: f("Notes Rencontres"),
    Statut_de_l_Activite: f(F_STATUS),
    Resultat_Appel: f("Résultat (Appel)"),
    Opportunity: f("Opportunity"),
  };
}
