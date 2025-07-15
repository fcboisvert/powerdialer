import React, { useEffect, useState } from "react";
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
import ResultForm from "@/components/dialer/ResultForm";
import { useNavigate } from "react-router-dom";

// === CONSTANTS ===
const STUDIO_API_URL = "https://texion.app/api/studio";
const FLOW_SID = "FW236e663e008973ab36cbfcdc706b6d97";
const QUEUE_API_URL = "https://texion.app/api/queue";
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
  TRIGGERING_FLOW: "triggering_flow",
  FLOW_ACTIVE: "flow_active",
  WAITING_OUTCOME: "waiting_outcome",
  COMPLETED: "completed",
  ERROR: "error",
} as const;
function Field({ label, value }: { label: string; value: string }) {
  if (
    (label === "LinkedIn" || label === "LinkedIn_URL") &&
    value !== "—" &&
    value.includes("linkedin.com")
  ) {
    return (
      <p className="flex">
        <span className="w-40 shrink-0 font-medium text-zinc-500">{label} :</span>
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Voir profil LinkedIn
        </a>
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
      formatted = digits.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
    } else if (digits.length === 11 && digits.startsWith("1")) {
      formatted = digits.replace(/1(\d{3})(\d{3})(\d{4})/, "+1 ($1) $2-$3");
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

export default function PowerDialer() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Chargement des contacts…");
  const [idx, setIdx] = useState(0);
  const agentKey = (
    localStorage.getItem("texion_agent")?.toLowerCase() === "simon"
      ? "simon"
      : "frederic"
  ) as "frederic" | "simon";
  const agent = AGENT_NAME_MAP[agentKey];
  const [callerId, setCallerId] = useState(AGENT_CALLER_IDS[agent][0]);
  const [callState, setCallState] = useState<(typeof CALL_STATES)[keyof typeof CALL_STATES]>(CALL_STATES.IDLE);
  const [showForm, setShowForm] = useState(false);
  const [currentExecutionSid, setCurrentExecutionSid] = useState<string | null>(null);
  const [callResult, setCallResult] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [meetingDatetime, setMeetingDatetime] = useState("");
  const current = records[idx] ?? {};
  const get = (obj: any, key: string, fb = "—") => Array.isArray(obj?.[key]) ? obj[key][0] ?? fb : obj?.[key] ?? fb;

  useEffect(() => {
    (async () => {
      setLoading(true);
      setStatus("Chargement des contacts…");
      try {
        const res = await fetch(`${QUEUE_API_URL}?agent=${encodeURIComponent(agent)}`);
        const list = await res.json();
        if (!Array.isArray(list)) throw new Error("Invalid queue format");
        setRecords(list);
        setStatus(`✅ ${list.length} contact(s) en file d'attente`);
      } catch (err) {
        console.error(err);
        setStatus("⚠️ Erreur API file d'attente");
        setRecords([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [agent]);

 const dial = async () => {
  if (callState !== CALL_STATES.IDLE) {
    setStatus("Opération en cours…");
    return;
  }

  const raw =
    get(current, "Mobile_Phone") ||
    get(current, "Direct_Phone") ||
    get(current, "Company_Phone");
  if (!raw || raw === "—") return setStatus("Aucun numéro valide !");
  if (!callerId) return setStatus("Sélectionnez un Caller ID !");
  const digits = raw.replace(/\D/g, "");
  const to =
    digits.length === 10
      ? `+1${digits}`
      : digits.length === 11 && digits.startsWith("1")
      ? `+${digits}`
      : raw.startsWith("+")
      ? raw
      : null;
  if (!to || !/^\+\d{10,15}$/.test(to)) {
    setStatus("Numéro de destination invalide !");
    return;
  }
  if (!/^\+\d{10,15}$/.test(callerId)) {
    setStatus("Numéro sortant invalide !");
    return;
  }

  const callId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Date.now().toString();
  (current as any).id = callId;

  // ✅ show form right away
  setCallState(CALL_STATES.FLOW_ACTIVE); // assume in-progress
  setShowForm(true);
  setCallResult("");
  setCallNotes("");
  setMeetingNotes("");
  setMeetingDatetime("");
  setStatus(`🚀 Déclenchement du flow pour ${to}…`);

  try {
    const payload = {
      to,
      from: callerId,
      parameters: {
        callId,
        leadName: get(current, "Full_Name"),
        company: get(current, "Nom_de_la_compagnie"),
        activity: get(current, "Activité 2.0 H.C."),
        agent,
        activityName: get(current, "Nom_de_l_Activite"),
      },
    };
    const res = await fetch(`${STUDIO_API_URL}/create-execution`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "API error");
    setCurrentExecutionSid(json.executionSid);
    setStatus(`📞 Flow déclenché – ex ${json.executionSid.slice(-6)}`);
  } catch (err: any) {
    setCallState(CALL_STATES.ERROR);
    setStatus(`❌ Erreur : ${err.message}`);
  }
};


    const simulate = async () => {
      if (callState !== CALL_STATES.IDLE) return setStatus("Appel en cours…");

      setCallState(CALL_STATES.TRIGGERING_FLOW);
      setStatus("🎭 Simulation d'appel...");
      setShowForm(false);

      const callId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Date.now().toString();
      (current as any).id = callId;

      setTimeout(async () => {
        setCallState(CALL_STATES.COMPLETED);
        setCallResult("Boite_Vocale");
        setStatus("📞 Simulation - Boîte vocale");
        setTimeout(() => next(), 2000);
      }, 3000);
    };

    const hang = () => {
      setCallState(CALL_STATES.COMPLETED);
      setShowForm(true);
      setStatus("📞 Appel terminé. Veuillez enregistrer le résultat.");
    };


  const next = () => {
    if (callState !== CALL_STATES.IDLE && callState !== CALL_STATES.COMPLETED) {
      return setStatus("Terminez l'opération en cours");
    }
    setIdx((i) => (i + 1 < records.length ? i + 1 : i));
    setCallResult("");
    setCallNotes("");
    setMeetingNotes("");
    setMeetingDatetime("");
    setShowForm(false);
    setCurrentExecutionSid(null);
    setCallState(CALL_STATES.IDLE);
    setStatus("➡️ Contact suivant");
  };

const saveAndNext = async () => {
  if (
    callResult.toLowerCase().includes("planifiee") &&
    (!meetingDatetime || meetingDatetime.trim() === "")
  ) {
    setStatus("❌ Entrez la date et l'heure pour cette activité planifiée.");
    return;
  }

  setStatus("💾 Sauvegarde en cours...");
  await updateCallResult(callResult, callNotes, meetingNotes, meetingDatetime);
  setMeetingNotes("");
  setMeetingDatetime("");
  setCallState(CALL_STATES.IDLE);
  setStatus("✅ Résultat sauvegardé");
  setTimeout(() => next(), 1000);
};


const updateCallResult = async (
  result: string,
  notes: string,
  meetingNotes?: string,
  meetingDatetime?: string
) => {
  const payload = {
  recordId: current?.id,
  activityName: get(current, "Nom_de_l_Activite"),
  result,
  notes,
  agent,
  meetingNotes,
  meetingDatetime,
  statut: "Fait", // ✅ update activity status to “Fait”
};


  try {
    const json = await sendAirtableUpdate(payload);
    console.log("✅ Airtable update-result success:", json);
  } catch (err: any) {
    console.error("❌ Erreur update-result:", err.message);
  }
};

const logout = () => {
  if (callState !== CALL_STATES.IDLE) {
    if (!window.confirm("Un appel est en cours. Quitter ?")) return;
  }
  localStorage.removeItem("texion_agent");
  setTimeout(() => navigate("/", { replace: true }), 100);
};

 const sendAirtableUpdate = async (body: any) => {
  const res = await fetch("/api/airtable/update-result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json?.message || "Airtable update failed");
  return json;
};

  if (loading) return <p className="p-10 text-center">{status}</p>;
  if (records.length === 0) return <p className="p-10 text-center">Aucun contact à appeler 👍</p>;

  function Action({
  icon: Icon,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { icon: any }) {
  return (
    <Button
      className="gap-2 bg-[#E24218] hover:bg-[#d03d15] text-white font-bold h-10 text-sm rounded-xl px-4 py-2 shadow-lg transition-all"
      {...props}
    >
      <Icon className="w-4 h-4" />
      {children}
    </Button>
  );
}

return (
  <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#f8fafc] via-[#fff] to-[#f3f4f6]">
    <div className="w-full px-4 sm:px-6 lg:px-8 pt-8">
      <div className="max-w-5xl mx-auto rounded-2xl shadow-xl bg-white/95 px-6 sm:px-10 py-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="h-[80px] overflow-hidden">
            <img src={Logo} alt="texion" className="w-[220px] object-contain" />
          </div>
          <div className="text-right text-sm">
            <p className="text-slate-500">
              {idx + 1}/{records.length} — Agent :{" "}
              <span className="font-semibold">{agent.split(" ")[0].toUpperCase()}</span>
            </p>
            <p className="text-green-600 font-medium text-xs">● Live depuis Airtable</p>
          </div>
        </div>

        {/* Caller ID selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center text-sm gap-2">
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
          <div
            className={`rounded px-3 py-2 text-sm font-medium border ${
              callState === CALL_STATES.TRIGGERING_FLOW
                ? "bg-blue-50 border-blue-300 text-blue-800"
                : callState === CALL_STATES.COMPLETED
                ? "bg-green-50 border-green-300 text-green-800"
                : callState === CALL_STATES.ERROR
                ? "bg-red-50 border-red-300 text-red-800"
                : "bg-zinc-50 border-zinc-200 text-zinc-800"
            }`}
          >
            Statut : {status}
          </div>
        </div>

        {/* Prospect + Activity Grid */}
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-4">
            <div className="border border-slate-200 bg-slate-50 rounded-lg p-4">
              <h4 className="font-semibold text-slate-700 mb-2">📜 Script d'appel</h4>
              <p className="text-zinc-800 whitespace-pre-line text-sm">
                {get(current, "Script_Appel")}
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-semibold text-zinc-800">Infos Prospect</h3>
              <Field label="Nom" value={get(current, "Full_Name")} />
              <Field label="Fonction" value={get(current, "Job_Title")} />
              <Field label="Entreprise" value={get(current, "Nom_de_la_compagnie")} />
              <Field label="LinkedIn" value={get(current, "LinkedIn_URL")} />
              <Field label="Téléphone mobile" value={get(current, "Mobile_Phone")} />
              <Field label="Téléphone direct" value={get(current, "Direct_Phone")} />
              <Field label="Téléphone entreprise" value={get(current, "Company_Phone")} />
            </div>
          </div>

          <div className="space-y-1 pt-[36px]">
            <h3 className="text-base font-semibold text-zinc-800">Infos Activité</h3>
            <Field label="Nom de l’activité" value={get(current, "Nom_de_l_Activite")} />
            <Field label="Type d’Activité" value={get(current, "Activité 2.0 H.C.")} />
            <Field label="Responsable de l’Activité" value={agent} />
            <Field label="Priorité" value={get(current, "Priorite")} />
            <Field label="Statut" value={get(current, "Statut_de_l_Activite", "À Faire")} />
            <Field label="Notes liées" value={get(current, "Linked_Notes")} />
            <Field label="Date / Heure" value={get(current, "Date_et_Heure_Rencontre")} />
          </div>
        </div>

        {/* Status display */}
        <div
          className={`rounded-md px-4 py-3 text-sm ring-1 mt-6 ${
            callState === CALL_STATES.TRIGGERING_FLOW
              ? "bg-blue-50 ring-blue-200 text-blue-800"
              : callState === CALL_STATES.FLOW_ACTIVE
              ? "bg-yellow-50 ring-yellow-200 text-yellow-800"
              : callState === CALL_STATES.WAITING_OUTCOME
              ? "bg-orange-50 ring-orange-200 text-orange-800"
              : callState === CALL_STATES.COMPLETED
              ? "bg-green-50 ring-green-200 text-green-800"
              : callState === CALL_STATES.ERROR
              ? "bg-red-50 ring-red-200 text-red-800"
              : "bg-zinc-50 ring-zinc-100"
          }`}
        >
          <div className="flex items-center gap-2">
            {callState === CALL_STATES.TRIGGERING_FLOW && (
              <Phone className="w-4 h-4 animate-pulse" />
            )}
            {callState === CALL_STATES.FLOW_ACTIVE && (
              <Clock className="w-4 h-4 animate-spin" />
            )}
            {callState === CALL_STATES.COMPLETED && (
              <CheckCircle className="w-4 h-4" />
            )}
            <span>Statut : {status}</span>
          </div>
        </div>

        {/* Call actions */}
        <div className="flex flex-wrap justify-center gap-3 pt-4">
          <Action icon={Phone} onClick={dial} disabled={callState !== CALL_STATES.IDLE}>
            Appeler
          </Action>
          <Action icon={FlaskConical} onClick={simulate} disabled={callState !== CALL_STATES.IDLE}>
            Simuler
          </Action>
          <Action icon={PhoneOff} onClick={hang} disabled={callState === CALL_STATES.IDLE}>
            Arrêter
          </Action>
          <Action icon={SkipForward} onClick={next} disabled={callState !== CALL_STATES.IDLE}>
            Suivant
          </Action>
          <Action icon={Lock} onClick={logout}>
            Logout
          </Action>
        </div>

        {/* Outcome form */}
          {showForm && (
            <ResultForm
              callResult={callResult}
              callNotes={callNotes}
              meetingNotes={meetingNotes}
              meetingDatetime={meetingDatetime}
              callStartTime={null}
              onCallResultChange={setCallResult}
              onCallNotesChange={setCallNotes}
              onMeetingNotesChange={setMeetingNotes}
              onMeetingDatetimeChange={setMeetingDatetime}
              onSubmit={saveAndNext}
            />
          )}
      </div>
    </div>
  </div>
);
}
