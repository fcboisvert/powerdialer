import React, { useEffect, useState, useRef } from "react";
import type { CallRecord } from "@/types/dialer";
import { Button } from "@/components/ui/button";
import {
  Phone,
  FlaskConical,
  PhoneOff,
  SkipForward,
  Lock,
  Clock,
  CheckCircle,
} from "lucide-react";
import Logo from "/texion-logo.svg";

declare global {
  interface Window {
    Twilio: any;
  }
}

const QUEUE_API_URL = "https://texion.app/api/queue";
const AIRTABLE_API_URL = "https://texion.app/api/airtable";
const TWILIO_TOKEN_URL = "https://almond-mouse-3471.twil.io/token-public";

const AGENT_CALLER_IDS: Record<string, string[]> = {
  "Frédéric-Charles Boisvert": ["+14388178171"],
  "Simon McConnell": ["+14388178177"],
};

const AGENT_NAME_MAP: Record<string, string> = {
  frederic: "Frédéric-Charles Boisvert",
  simon: "Simon McConnell",
};

const CALL_STATES = {
  IDLE: "idle",
  CALLING: "calling",
  WAITING: "waiting_outcome",
  CONNECTED: "agent_connected",
} as const;

export default function PowerDialer() {
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Chargement des contacts…");
  const [idx, setIdx] = useState(0);

  const getAgentKey = () =>
  localStorage.getItem("texion_agent")?.toLowerCase() === "simon"
    ? "simon"
    : "frederic"; // fallback to 'frederic' if unset or unknown

   const agentKey = getAgentKey(); // e.g. "frederic"
   const agent = AGENT_NAME_MAP[agentKey]; // e.g. "Frédéric-Charles Boisvert"

  const [callerId, setCallerId] = useState(AGENT_CALLER_IDS[agent]?.[0] || "");
  const [callState, setCallState] = useState<
    keyof typeof CALL_STATES
  >(CALL_STATES.IDLE);
  const [callActive, setCallActive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callResult, setCallResult] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [meetingDatetime, setMeetingDatetime] = useState("");


  const twilioDevice = useRef<null | any>(null); // or stricter: Twilio.Device
  const connection = useRef<any>(null);
  const current = records[idx];

  const get = (obj: any, key: string, fallback = "—") => {
    const val = obj?.[key];
    return Array.isArray(val) ? val[0] || fallback : val || fallback;
  };

  const getFlowSidFromUrl = (url: string): string | null => {
   if (!url || typeof url !== "string") return null;
   const match = url.match(/\/Flows\/([A-Za-z0-9]+)\/Executions/);
   return match ? match[1] : null;
  };


  useEffect(() => {
    const fetchQueue = async () => {
      setLoading(true);
      setStatus("Chargement des contacts…");

      try {
        const res = await fetch(`${QUEUE_API_URL}?agent=${encodeURIComponent(agent)}`);
        const result = await res.json();

        if (!Array.isArray(result)) {
          console.error("Bad queue response:", result);
          throw new Error("Invalid queue format");
        }

        const normalized = result.map((lead) => ({
          id: lead.id,
          Full_Name: (lead["Full Name"] ?? "—").toString().trim(),
          Job_Title: (lead["Job Title"] ?? "—").toString().trim(),
          Nom_de_la_compagnie: (lead["Nom de la compagnie"] ?? "—").toString().trim(),
          LinkedIn_URL: (lead["Contact LinkedIn URL"] ?? "—").toString().trim(),
          Mobile_Phone: (lead["Mobile Phone"] ?? lead.phones?.[0] ?? "—").toString().trim(),
          Direct_Phone: (lead["Direct Phone"] ?? "—").toString().trim(),
          Company_Phone: (lead["Company Phone"] ?? "—").toString().trim(),

          Nom_de_l_Activite: (lead["Nom de l'Activite"] ?? "—").toString().trim(),
          Priorite: (lead["Priorité"] ?? "—").toString().trim(),
          Date_et_Heure_Rencontre: (lead["Notes Rencontres"] ?? "—").toString().trim(),
          Statut_de_l_Activite: (lead["Statut de l'Activité"] ?? "À Faire").toString().trim(),
          Linked_Notes: (lead["Linked Notes"] ?? "—").toString().trim(),
          Flow_URL: (lead["Flow URL"] ?? "—").toString().trim(),

          Message_content: (lead["Message content"] ?? "—").toString().trim(),
          Resultat_Appel: (lead["Résultat (Appel)"] ?? "—").toString().trim(),
        }));



        setRecords(normalized);
        setStatus(`✅ ${normalized.length} contact(s) en file d'attente`);
      } catch (e) {
        console.error("Queue fetch failed", e);
        setStatus("⚠️ Erreur API file d'attente");
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchQueue();
  }, [agent]);
  useEffect(() => {
    if (!window.Twilio) return setStatus("Twilio SDK non chargé !");
    let device: any;

    (async () => {
      try {
        setStatus("Initialisation Twilio…");
        const res = await fetch(`${TWILIO_TOKEN_URL}?identity=${agentKey}`);
        const { token } = await res.json();


        device = new window.Twilio.Device(token);
        twilioDevice.current = device;

        device.on("ready", () => setStatus("Twilio prêt"));
        device.on("connect", () => {
          setCallActive(true);
          setCallState(CALL_STATES.WAITING);
          setStatus("📞 Appel connecté - En attente du résultat...");
        });
        device.on("disconnect", () => {
          if (callState === CALL_STATES.CONNECTED) {
            setStatus("📞 Conversation terminée");
            setShowForm(true);
          } else {
            setStatus("🛑 Appel terminé");
            setCallState(CALL_STATES.IDLE);
          }
          setCallActive(false);
        });
        device.on("error", (e: any) =>
          setStatus("Erreur Twilio: " + e.message)
        );
      } catch (e: any) {
        console.error("Twilio init error", e);
        setStatus("Erreur token: " + e.message);
      }
    })();

    return () => device && device.destroy();
  }, [agent]);

  useEffect(() => {
    const handler = (event: CustomEvent) => {
      const { outcome, callId } = event.detail;
      if (callId !== currentCallId) return;

      const autoAdvance = (result: string, notes: string, msg: string) => {
        setCallResult(result);
        setCallState(CALL_STATES.IDLE);
        setCallActive(false);
        updateCallResult(result, notes);
        setStatus(msg);
        setTimeout(() => next(), 2000);
      };

      switch (outcome) {
        case "Répondeur":
        case "Boite_Vocale":
          autoAdvance("Boite_Vocale", "Message laissé automatiquement", "📞 Message vocal laissé");
          break;
        case "Répondu_Humain":
          setCallState(CALL_STATES.CONNECTED);
          setStatus("👤 Humain répondu - En conversation");
          setShowForm(true);
          break;
        case "Pas_Joignable":
          autoAdvance("Pas_Joignable", "Numéro non joignable", "❌ Pas joignable");
          break;
      }
    };

    window.addEventListener("callOutcome", handler as EventListener);
    return () => window.removeEventListener("callOutcome", handler as EventListener);
  }, [currentCallId]);

  const updateCallResult = async (result: string, notes: string) => {
    try {
      await fetch(`${AIRTABLE_API_URL}/update-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityName: get(current, "Nom de l'Activite"),
          result,
          notes: callNotes,
          meetingNotes,
          meetingDatetime,
          agent,
        }),
      });

    await fetch(QUEUE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, status: "Fait" }),
    });
  } catch (e) {
    console.error("Airtable update error", e);
  }
};


  const dial = () => {
    if (!twilioDevice.current) return setStatus("Twilio non initialisé");
    if (callState !== CALL_STATES.IDLE) return setStatus("Appel en cours…");

    let num = get(current, "Mobile_Phone") || get(current, "Direct_Phone") || get(current, "Company_Phone");
    if (!num || num === "—") return setStatus("Aucun numéro valide !");
    if (!callerId) return setStatus("Sélectionnez un Caller ID !");

    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const flowSid = getFlowSidFromUrl(get(current, "Flow_URL"));

    setCallState(CALL_STATES.CALLING);
    setCurrentCallId(callId);
    setStatus(`📞 Composition → ${num}${flowSid ? ` (Flow: ${flowSid})` : ""}`);
    setShowForm(false);
    setCallResult("");
    setCallNotes("");

    const params = {
      To: num,
      From: callerId,
      contact_channel_address: num,
      flow_channel_address: callerId,
      activity: get(current, "Nom de l'Activite"),
      callId,
      leadName: get(current, "Full_Name"),
      company: get(current, "Nom_de_la_compagnie"),
      agent,
      ...(flowSid && { flowSid }),
    };

    connection.current = twilioDevice.current.connect(params);
  };

  const hang = () => {
    twilioDevice.current?.disconnectAll();
    setCallActive(false);
    setCallState(CALL_STATES.IDLE);
    setCurrentCallId(null);
    setShowForm(false);
    setStatus("📞 Appel raccroché");
  };
  const simulate = () => {
    if (callState !== CALL_STATES.IDLE) return setStatus("Appel en cours…");

    setCallActive(true);
    setCallState(CALL_STATES.CALLING);
    setStatus("🎭 Simulation d'appel...");
    setShowForm(false);

    setTimeout(() => {
      setCallActive(false);
      setCallState(CALL_STATES.IDLE);
      setCallResult("Boite_Vocale");
      updateCallResult("Boite_Vocale", "Simulation - Message laissé");
      setStatus("📞 Simulation - Boîte vocale");
      setTimeout(() => next(), 2000);
    }, 3000);
  };

  const next = () => {
    if (callState !== CALL_STATES.IDLE) return setStatus("Terminez l'appel en cours");
    setIdx((i) => (i + 1 < records.length ? i + 1 : i));
    setCallResult("");
    setCallNotes("");
    setMeetingNotes("");
    setMeetingDatetime("");
    setShowForm(false);
    setCurrentCallId(null);
    setStatus("➡️ Contact suivant");
  };

  const saveAndNext = async () => {
    if (!callResult) {
      setStatus("❌ Sélectionnez un résultat d'appel");
      return;
    }

    setStatus("💾 Sauvegarde en cours...");
    await updateCallResult(callResult, callNotes);
    setMeetingNotes("");
    setMeetingDatetime("");
    setCallState(CALL_STATES.IDLE);
    setStatus("✅ Résultat sauvegardé");
    setTimeout(() => next(), 1000);
  };

  const logout = () => {
    if (callState !== CALL_STATES.IDLE) {
      if (!confirm("Un appel est en cours. Quitter ?")) return;
    }
    localStorage.removeItem("texion_agent");
    window.location.reload();
  };

  if (loading) return <p className="p-10 text-center">{status}</p>;

  return (
    <main className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
      <section className="w-full max-w-3xl bg-white rounded-xl shadow-xl ring-1 ring-zinc-100 p-10 space-y-8">
        <header className="flex items-center gap-3">
          <img src={Logo} alt="texion" className="w-10 h-auto" />
          <h1 className="text-lg font-semibold">POWER DIALER TEXION</h1>
          <span className="ml-auto text-sm font-medium">
            {idx + 1}/{records.length} – Agent: {agent.split(" ")[0].toUpperCase()}
          </span>
        </header>

        <div className="flex items-center gap-2 text-sm">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="font-medium text-green-700">Live depuis Airtable</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Numéro sortant :</span>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={callerId}
            onChange={(e) => setCallerId(e.target.value)}
          >
            {(AGENT_CALLER_IDS[agent] || []).map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="mb-2 font-semibold text-zinc-800">Infos Prospect</h3>
            <Field label="Nom" value={get(current, "Full_Name")} />
            <Field label="Fonction" value={get(current, "Job_Title")} />
            <Field label="Entreprise" value={get(current, "Nom_de_la_compagnie")} />
            <Field label="LinkedIn" value={get(current, "LinkedIn_URL")} />
            <Field label="Téléphone mobile" value={get(current, "Mobile_Phone")} />
            <Field label="Téléphone direct" value={get(current, "Direct_Phone")} />
            <Field label="Téléphone entreprise" value={get(current, "Company_Phone")} />
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-zinc-800">Infos Activité</h3>
            <Field label="Nom de l'activité" value={get(current, "Nom de l'Activite")} />
            <Field label="Priorité" value={get(current, "Priorite")} />
            <Field label="Date et heure" value={get(current, "Date et Heure Rencontre")} />
            <Field label="Statut" value={get(current, "Statut_de_l_Activite", "À Faire")} />
            <Field label="Notes liées" value={get(current, "Linked_Notes")} />
            <Field label="Flow configuré" value={get(current, "Flow_URL") !== "—" ? "✅ Oui" : "❌ Non"} />
          </div>
        </div>

        <div className={`rounded-md px-4 py-3 text-sm ring-1 ${
          callState === CALL_STATES.CALLING
            ? 'bg-blue-50 ring-blue-200 text-blue-800'
            : callState === CALL_STATES.WAITING
            ? 'bg-yellow-50 ring-yellow-200 text-yellow-800'
            : callState === CALL_STATES.CONNECTED
            ? 'bg-green-50 ring-green-200 text-green-800'
            : 'bg-zinc-50 ring-zinc-100'
        }`}>
          <div className="flex items-center gap-2">
            {callState === CALL_STATES.CALLING && <Phone className="w-4 h-4 animate-pulse" />}
            {callState === CALL_STATES.WAITING && <Clock className="w-4 h-4 animate-spin" />}
            {callState === CALL_STATES.CONNECTED && <CheckCircle className="w-4 h-4" />}
            <span>Statut : {status}</span>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Action icon={Phone} onClick={dial} disabled={callState !== CALL_STATES.IDLE}>Appeler</Action>
          <Action icon={FlaskConical} onClick={simulate} disabled={callState !== CALL_STATES.IDLE}>Simuler</Action>
          <Action icon={PhoneOff} onClick={hang} disabled={!callActive && callState === CALL_STATES.IDLE}>Raccrocher</Action>
          <Action icon={SkipForward} onClick={next} disabled={callState !== CALL_STATES.IDLE}>Suivant</Action>
          <Action icon={Lock} onClick={logout}>Logout</Action>
        </div>

        {showForm && callState === CALL_STATES.CONNECTED && (
          <div className="mt-8 rounded-lg bg-zinc-50 ring-1 ring-zinc-100 p-6">
            <h4 className="font-medium mb-4">📞 Conversation terminée - Résultat</h4>
            {get(current, "Message_content") !== "—" && (
              <div className="mb-4 p-3 bg-blue-50 rounded border-l-4 border-blue-200">
                <p className="text-sm text-blue-800"><strong>Message préparé:</strong> {get(current, "Message_content")}</p>
              </div>
            )}
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Résultat de l'appel *</label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={callResult} onChange={(e) => setCallResult(e.target.value)}>
                  <option value="">-- Sélectionner --</option>
                  <option value="S_O">S_O</option>
                  <option value="Rencontre_Expl._Planifiee">Rencontre_Expl._Planifiee</option>
                  <option value="Rencontre_Besoin_Planifiee">Rencontre_Besoin_Planifiee</option>
                  <option value="Visite_Planifiee">Visite_Planifiee</option>
                  <option value="Offre_Planifiee">Offre_Planifiee</option>
                  <option value="Touchbase_Planifiee">Touchbase_Planifiee</option>
                  <option value="Relancer_Dans_X">Relancer_Dans_X</option>
                  <option value="Info_Par_Courriel">Info_Par_Courriel</option>
                  <option value="Boite_Vocale">Boite_Vocale</option>
                  <option value="Pas_Joignable">Pas_Joignable</option>
                  <option value="Pas_Interesse">Pas_Interesse</option>
                  <option value="Demande_Lien_Booking">Demande_Lien_Booking</option>
                  <option value="Me_Refere_Interne">Me_Refere_Interne</option>
                  <option value="Me_Refere_Externe">Me_Refere_Externe</option>
                </select>
              </div>
              <div>
               <label className="block text-sm font-medium mb-1">Notes Rencontres</label>
               <textarea
                className="w-full border rounded px-3 py-2 text-sm"
                rows={4}
                placeholder="Détails à se rappeler de l'appel…"
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
              ></textarea>
            </div>

<div>
  <label className="block text-sm font-medium mb-1">Date et Heure Rencontre (si applicable)</label>
  <input
    type="datetime-local"
    className="w-full border rounded px-3 py-2 text-sm"
    value={meetingDatetime}
    onChange={(e) => setMeetingDatetime(e.target.value)}
  />
</div>

            </div>
            <div className="flex gap-3">
              <Button onClick={saveAndNext} disabled={!callResult}>💾 Sauvegarder & Suivant</Button>
              <Button variant="outline" onClick={hang}>❌ Annuler l'appel</Button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

// ─────────── Helpers ───────────
function Field({ label, value }: { label: string; value: string }) {
  if (label === "LinkedIn_URL" && value !== "—" && value.includes("linkedin.com")) {
    return (
      <p className="flex">
        <span className="w-40 shrink-0 font-medium text-zinc-500">{label} :</span>
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Voir profil LinkedIn</a>
      </p>
    );
  }

if (
  (label.includes("Phone") || label.includes("Téléphone")) &&
  value !== "—" &&
  typeof value === "string"
) {
  const digits = value.replace(/\D/g, "");
  let formatted = value.trim();

  if (digits.length === 10) {
    formatted = digits.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  } else if (digits.length === 11 && digits.startsWith("1")) {
    formatted = digits.replace(/1(\d{3})(\d{3})(\d{4})/, '+1 ($1) $2-$3');
  }

  return (
    <p className="flex">
      <span className="w-40 shrink-0 font-medium text-zinc-500">{label} :</span>
      <span className="text-zinc-800 font-mono">{formatted}</span>
    </p>
  );
}



  return (
    <p className="flex">
      <span className="w-40 shrink-0 font-medium text-zinc-500">{label} :</span>
      <span className="text-zinc-800">{value}</span>
    </p>
  );
}

function Action({
  icon: Icon,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { icon: any }) {
  return (
    <Button variant="primary" size="sm" className="gap-2" {...props}>
      <Icon className="w-4 h-4" /> {children}
    </Button>
  );
}
