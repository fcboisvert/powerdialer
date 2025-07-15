// PowerDialer.tsx — auto‑logging + auto‑advance dialer
// 2025‑07‑15
// -----------------------------------------------------------------------------
//  ✱ Auto‑polls Twilio outcome → writes Boite_Vocale / Pas_Joignable automatically
//  ✱ Saves to backend, auto‑advances to next record, auto‑dials next call
// -----------------------------------------------------------------------------

import React, { useEffect, useRef, useState } from "react";
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

// === CONSTANTS ===============================================================
const STUDIO_API_URL = "https://texion.app/api/studio";
const FLOW_SID = "FW52d9007999380cfbb435838d0733e84c";
const QUEUE_API_URL = "https://texion.app/api/queue";
const AIRTABLE_UPDATE_URL = "https://texion.app/api/airtable/update-result";
const OUTCOME_POLL_URL = "https://texion.app/api/outcome"; // GET ?callId=<uuid>

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
  WAITING_OUTCOME: "waiting_outcome",
  COMPLETED: "completed",
  ERROR: "error",
} as const;

type CallState = (typeof CALL_STATES)[keyof typeof CALL_STATES];

// ============================================================================
export default function PowerDialer() {
  const navigate = useNavigate();
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ---------------- state ----------------------------------------------------
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Chargement des contacts…");
  const [callState, setCallState] = useState<CallState>(CALL_STATES.IDLE);
  const [showForm, setShowForm] = useState(false);
  const [currentExecutionSid, setCurrentExecutionSid] = useState<string | null>(null);
  const [callResult, setCallResult] = useState<string>("");
  const [callNotes, setCallNotes] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [meetingDatetime, setMeetingDatetime] = useState("");

  // agent & callerId ---------------------------------------------------------
  const agentKey = (localStorage.getItem("texion_agent")?.toLowerCase() === "simon" ? "simon" : "frederic") as
    | "frederic"
    | "simon";
  const agent = AGENT_NAME_MAP[agentKey];
  const [callerId, setCallerId] = useState(AGENT_CALLER_IDS[agent][0]);

  const current = records[idx] ?? {};
  const get = (obj: any, key: string, fb = "—") => (Array.isArray(obj?.[key]) ? obj[key][0] ?? fb : obj?.[key] ?? fb);

  // ------------------ helpers ------------------------------------------------
  const clearPollingOutcome = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPollingOutcome = (callId: string) => {
    clearPollingOutcome();
    let attempt = 0;
    pollRef.current = setInterval(async () => {
      if (++attempt > 10) return clearPollingOutcome(); // ≈40 s timeout
      try {
        const r = await fetch(`${OUTCOME_POLL_URL}?callId=${callId}`);
        if (!r.ok) return;
        const data = await r.json();
        if (data?.outcome) {
          clearPollingOutcome();
          const mapped = data.outcome === "Répondeur" ? "Boite_Vocale" : data.outcome === "Pas_Joignable" ? "Pas_Joignable" : "Répondu_Humain";
          if (mapped === "Boite_Vocale" || mapped === "Pas_Joignable") {
            await autoHandleOutcome(mapped);
          } else {
            setShowForm(true); // For human, show form
          }
        }
      } catch (_) {}
    }, 4000);
  };

  // auto‑process outcome, save, advance, dial next ---------------------------
  const autoHandleOutcome = async (mappedOutcome: "Boite_Vocale" | "Pas_Joignable") => {
    setStatus(`💾 Enregistrement automatique (${mappedOutcome})…`);
    await updateCallResult(mappedOutcome, "");
    setStatus("✅ Résultat auto‐enregistré");
    // advance to next contact after small delay
    setTimeout(() => {
      next(true /* autoDial */);
    }, 500);
  };

  // -------------------- queue load -----------------------------------------
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${QUEUE_API_URL}?agent=${encodeURIComponent(agent)}`);
        const list = await res.json();
        if (!Array.isArray(list)) throw new Error("Invalid queue format");
        setRecords(list);
        setStatus(`✅ ${list.length} contact(s) en file d'attente`);
      } catch (e) {
        console.error(e);
        setStatus("⚠️ Erreur API file d'attente");
      } finally {
        setLoading(false);
      }
    })();
  }, [agent]);

  // ========================================================================
  // dial, hang, simulate, next, save, etc.
  // ========================================================================
  const dial = async () => {
    if (callState !== CALL_STATES.IDLE) return setStatus("Opération en cours…");
    const raw = get(current, "Mobile_Phone") || get(current, "Direct_Phone") || get(current, "Company_Phone");
    if (raw === "—") return setStatus("Aucun numéro valide !");

    const digits = raw.replace(/\D/g, "");
    const to = digits.length === 10 ? `+1${digits}` : raw.startsWith("+") ? raw : null;
    if (!to) return setStatus("Numéro invalide !");

    setCallState(CALL_STATES.TRIGGERING_FLOW);
    setStatus(`🚀 Flow pour ${to}`);
    setShowForm(false);
    setCallResult("");

    const callId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Date.now().toString();
    (current as any).id = callId;

    try {
      const res = await fetch(`${STUDIO_API_URL}/create-execution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      }).then((r) => r.json());
      if (!res.success) throw new Error(res.error || "API error");

      setCurrentExecutionSid(res.executionSid);
      setCallState(CALL_STATES.WAITING_OUTCOME);
      setStatus(`📞 ex ${res.executionSid.slice(-6)}`);
      startPollingOutcome(callId);
    } catch (err: any) {
      setCallState(CALL_STATES.ERROR);
      setStatus(`❌ ${err.message}`);
    }
  };

  const hang = async () => {
    if (currentExecutionSid) {
      await fetch(`${STUDIO_API_URL}/end-execution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowSid: FLOW_SID, executionSid: currentExecutionSid }),
      });
    }
    clearPollingOutcome();
    setCallState(CALL_STATES.IDLE);
    setStatus("📞 Arrêté");
  };

  const simulate = () => {
    if (callState !== CALL_STATES.IDLE) return setStatus("Appel en cours…");
    setCallState(CALL_STATES.TRIGGERING_FLOW);
    setStatus("🎭 Simulation d'appel...");
    setShowForm(true); // Show form during simulation

    const callId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Date.now().toString();
    (current as any).id = callId;

    setTimeout(() => {
      clearPollingOutcome();
      setCallState(CALL_STATES.COMPLETED);
      setCallResult("Boite_Vocale");
      updateCallResult("Boite_Vocale", "Simulation - Message laissé");
      setStatus("📞 Simulation - Boîte vocale");
      setTimeout(() => next(), 2000);
    }, 3000);
  };

  const next = () => {
    if (callState !== CALL_STATES.IDLE && callState !== CALL_STATES.COMPLETED) {
      return setStatus("Terminez l'opération en cours");
    }
    clearPollingOutcome();
    setIdx((i) => Math.min(i + 1, records.length - 1));
    setCallResult("");
    setCallNotes("");
    setMeetingNotes("");
    setMeetingDatetime("");
    setShowForm(false);
    setCallState(CALL_STATES.IDLE);
    setStatus("➡️ Suivant");
  };

  const saveAndNext = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!callResult) return setStatus("❌ Sélectionnez un résultat");
    setStatus("💾 Sauvegarde…");
    await updateCallResult(callResult, callNotes, meetingNotes, meetingDatetime);
    next();
  };

  // ---------------------------------------------------------------- update
  async function updateCallResult(result: string, notes: string, meetNotes?: string, meetDate?: string) {
    const payload = {
      activityName: get(current, "Nom_de_l_Activite"),
      result,
      notes,
      agent,
      meetingNotes: meetNotes,
      meetingDatetime: meetDate,
      statut: "Fait",
    };
    await fetch(AIRTABLE_UPDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  // logout -----------------------------------------------------------
  const logout = () => {
    if (callState !== CALL_STATES.IDLE && !window.confirm("Un appel est en cours. Quitter ?")) return;
    clearPollingOutcome();
    localStorage.removeItem("texion_agent");
    navigate("/", { replace: true });
  };

  // ================================================================= JSX
  if (loading) return <p className="p-10 text-center">{status}</p>;
  if (!records.length) return <p className="p-10 text-center">Aucun contact 👍</p>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] via-[#fff] to-[#f3f4f6]">
      <div className="rounded-2xl shadow-2xl bg-white/95 px-8 py-12 w-full max-w-3xl flex flex-col items-center">
        {/* header ---------------------------------------------------------*/}
        <header className="flex flex-col items-center w-full mb-8">
          <img src={Logo} alt="texion" className="w-full h-[100px] mb-3 object-contain" />
          <h1 className="text-2xl font-bold text-slate-900 mb-1">POWER DIALER TEXION</h1>
          <span className="text-xs text-slate-500">{idx + 1}/{records.length} — {agent.split(" ")[0].toUpperCase()}</span>
        </header>

        {/* status pill ----------------------------------------------------*/}
        <div className="rounded-md bg-zinc-50 ring-1 ring-zinc-100 px-4 py-2 mb-4 text-sm">
          {status}
        </div>

        {/* action buttons -------------------------------------------------*/}
        <div className="flex flex-wrap gap-3 mb-4">
          <DialBtn icon={Phone} onClick={dial} disabled={callState !== CALL_STATES.IDLE}>Appeler</DialBtn>
          <DialBtn icon={FlaskConical} onClick={simulate} disabled={callState !== CALL_STATES.IDLE}>Simuler</DialBtn>
          <DialBtn icon={PhoneOff} onClick={hang} disabled={callState === CALL_STATES.IDLE}>Arrêter</DialBtn>
          <DialBtn icon={SkipForward} onClick={() => next()} disabled={callState !== CALL_STATES.IDLE}>Suivant</DialBtn>
          <DialBtn icon={Lock} onClick={logout}>Logout</DialBtn>
        </div>

        {showForm && (<ResultForm
          callResult={callResult}
          callNotes={callNotes}
          meetingNotes={meetingNotes}
          meetingDatetime={meetingDatetime}
          script={get(current, "Message_content")}
          onCallResultChange={setCallResult}
          onCallNotesChange={setCallNotes}
          onMeetingNotesChange={setMeetingNotes}
          onMeetingDatetimeChange={setMeetingDatetime}
          onSubmit={saveAndNext}
        />)}
      </div>
    </div>
  );
}

// Helpers
function Field({ label, value }: { label: string; value: string }) {
  if (
    (label === "LinkedIn" || label === "LinkedIn_URL") &&
    value !== "—" &&
    value.includes("linkedin.com")
  ) {
    return (
      <p className="flex">
        <span className="w-40 shrink-0 font-medium text-zinc-500">
          {label} :
        </span>
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
        <span className="w-40 shrink-0 font-medium text-zinc-500">
          {label} :
        </span>
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

// simple reusable button ------------------------------------------------------
function DialBtn({ icon: Icon, children, ...props }: React.ComponentProps<typeof Button> & { icon: any }) {
  return (
    <Button className="gap-2 bg-[#E24218] hover:bg-[#d03d15] text-white font-bold h-10 rounded-xl px-4 shadow-lg" {...props}>
      <Icon className="w-4 h-4" /> {children}
    </Button>
  );

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
      <Icon className="w-4 h-4" /> {children}
    </Button>
  );
}
}
