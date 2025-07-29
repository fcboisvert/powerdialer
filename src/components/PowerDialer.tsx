// PowerDialer.tsx — automatic outcome polling integrated (PRODUCTION READY)
// -----------------------------------------------------------------------------
// KEY ADDITIONS (search for "// >>>" comments):
// 1. OUTCOME_POLL_URL const
// 2. pollRef via useRef
// 3. startPollingOutcome(callId) helper
// 4. clearPollingOutcome() helper called from hang, save, next
// -----------------------------------------------------------------------------
import {
  initTwilioDevice,
  getTwilioDevice,
  destroyTwilioDevice,
} from "@/lib/voiceClient";
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
import ResultForm from "@/components/dialer/ResultForm";
import { useNavigate } from "react-router-dom";

import type { CallResult } from "@/types/dialer";

// Add Debug Helper (temporary) after your imports
if (typeof window !== 'undefined') {
  (window as any).debugDialer = () => {
    const device = getTwilioDevice();
    console.log('=== DIALER DEBUG ===');
    console.log('Device exists:', !!device);
    console.log('Device state:', device?.state);
    console.log('Device identity:', device?.identity);
    console.log('Is busy:', device?.isBusy);
    console.log('Current call:', (window as any).currentCall);
    return device;
  };
}

// === CONSTANTS ===
const STUDIO_API_URL = "https://texion.app/api/studio";
const FLOW_SID = "FW52d9007999380cfbb435838d0733e84c";
// Worker runs on the same origin as the app once deployed on Pages
const QUEUE_API_URL = "/api/queue";
const AIRTABLE_UPDATE_URL = "https://texion.app/api/airtable/update-result";
// >>> new endpoint that simply reads KV by callId
const OUTCOME_POLL_URL = "https://texion.app/api/outcome";

const AGENT_CALLER_IDS: Record<string, string[]> = {
  // "Frédéric-Charles Boisvert": ["+14388178171"],
  // "Simon McConnell": ["+14388178177"],
  frederic: ["+14388178171"],
  simon: ["+14388178177"],
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

export default function PowerDialer() {
  const navigate = useNavigate();
  // >>> ref to store interval id so we can clear it
  // === STATE ===
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Chargement des contacts…");
  const [idx, setIdx] = useState(0);
  const agentKey = (
    localStorage.getItem("texion_agent")?.toLowerCase() === "simon"
      ? "simon"
      : "frederic"
  ) as "frederic" | "simon";
  const agent = AGENT_NAME_MAP[agentKey]; // Use full name for consistency
  const [callerId, setCallerId] = useState(AGENT_CALLER_IDS[agentKey][0]);
  const [callState, setCallState] = useState<
    (typeof CALL_STATES)[keyof typeof CALL_STATES]
  >(CALL_STATES.IDLE);
  const [showForm, setShowForm] = useState(false);
  const [currentExecutionSid, setCurrentExecutionSid] = useState<string | null>(
    null
  );
  const [callResult, setCallResult] = useState<CallResult>("S_O");
  const [callNotes, setCallNotes] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [meetingDatetime, setMeetingDatetime] = useState("");
  const [pollTimer, setPollTimer] = useState<NodeJS.Timeout>();
  const current = records[idx] ?? {};
  const get = (obj: any, key: string, fb = "—") =>
    Array.isArray(obj?.[key]) ? obj[key][0] ?? fb : obj?.[key] ?? fb;

  async function updateCallResult(
    result: string,
    notes: string,
    meetingNotes?: string,
    meetingDatetime?: string,
    forceStatutFait = false // new parameter for auto-saves
  ) {
    const payload = {
      recordId: get(current, "Record_ID"),
      outcome: result,
      number:
        get(current, "Mobile_Phone") ||
        get(current, "Direct_Phone") ||
        get(current, "Company_Phone"),
      activity: get(current, "Nom_de_l_Activite"),
      activityName: get(current, "Nom_de_l_Activite"),
      callId: current?.id || "unknown-call-id",
      agent,
      script: get(current, "Message_content"),
      statut: forceStatutFait ? "Fait" : undefined,
    };

    if (["Boite_Vocale", "Pas_Joignable"].includes(result)) {
      try {
        const res = await fetch("https://texion.app/api/call-outcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Call outcome API failed");
        console.log("✅ API logged:", result);
      } catch (err: any) {
        console.error("❌ API call-outcome error:", err.message);
      }
    } else {
      try {
        const res = await fetch(AIRTABLE_UPDATE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recordId: get(current, "Record_ID"),
            activityName: get(current, "Nom_de_l_Activite"),
            result,
            notes,
            agent,
            meetingNotes,
            meetingDatetime,
            statut: "Fait",
          }),
        });
        if (!res.ok) throw new Error("Airtable update API failed");
        console.log("✅ Airtable updated:", result);
      } catch (err: any) {
        console.error("❌ Airtable update error:", err.message);
      }
    }
  }

  // ------------------------------------------------------------------
  // Helper to start polling KV for outcome until we get it or timeout
  // ------------------------------------------------------------------
  const clearPollingOutcome = () => {
    if (pollTimer) clearTimeout(pollTimer);  // ← CORRECT
    // Nothing to cancel yet — placeholder for future polling cancel logic
  };

  const startPollingOutcome = (callId: string) => {
    console.log(`[PowerDialer] Starting to poll for callId: "${callId}"`);
    console.log(`[PowerDialer] callId length: ${callId.length}`);
    console.log(`[PowerDialer] Full URL: ${OUTCOME_POLL_URL}?callId=${callId}`);

    let attempts = 0;
    const maxAttempts = 100; // ~7 minutes
    const delay = 4000; // 4 seconds per attempt  

    const poll = async () => {
      if (attempts++ >= maxAttempts) {
        console.warn(
          `[PowerDialer] Polling timed out after ${attempts} attempts`
        );
        return;
      }

      const url = `${OUTCOME_POLL_URL}?callId=${callId}`;
      console.log(`[PowerDialer] Polling attempt ${attempts} for URL: ${url}`);

      const res = await fetch(url);
      console.log(`[PowerDialer] Response status: ${res.status}`);

      if (!res.ok) {
        setTimeout(poll, delay);
        return;
      }

      const data: { outcome?: string } = await res.json();
      console.log(`[PowerDialer] Poll response data:`, data);

      // Fix for PowerDialer.tsx - auto-saving call outcome and ensuring Statut = "Fait" is saved correctly

      // Update the polling detection block (inside startPollingOutcome) like this:
      if (
        data?.outcome &&
        ["Boite_Vocale", "Pas_Joignable"].includes(data.outcome)
      ) {
        const outcome = data.outcome as CallResult;
        console.log(`[PowerDialer] Outcome detected: ${outcome}`);

        setCallResult(outcome);
        setCallState(CALL_STATES.COMPLETED);
        setStatus(`📞 ${outcome}`);
        setShowForm(true);

        // Bypass the form, save directly and set Statut = "Fait"
        setTimeout(() => {
          console.log(
            "[PowerDialer] Auto-saving outcome with Statut=Fait and continuing..."
          );
          updateCallResult(outcome, "Auto-detected result", "", "", true)
            .then(() => {
              setTimeout(() => next(), 500); // Advance after save
            })
            .catch((err) =>
              console.error("[PowerDialer] Auto-save failed:", err)
            );
        }, 300);
      } else {
        const timer = setTimeout(poll, delay);
        setPollTimer(timer);
      }
    };

    const timer = setTimeout(poll, delay);
    setPollTimer(timer);
  };

  // ------------------------------------------------------------------
  // Fetch queue
  // ------------------------------------------------------------------
  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const agent = localStorage.getItem("texion_agent")?.toLowerCase() || "";
        const res = await fetch(`${QUEUE_API_URL}?agent=${agent}`);
        if (!res.ok) throw new Error("Failed to fetch queue");
        const data: CallRecord[] = await res.json();
        setRecords(data);
        setLoading(false);
        setStatus("Contacts chargés");
      } catch (err: any) {
        console.error("Queue fetch error:", err);
        setStatus("Erreur de chargement des contacts");
        setLoading(false);
      }
    };
    fetchQueue();
  }, []);

  // Simplified Twilio device initialization
  useEffect(() => {
    const setupDevice = async () => {
      await initTwilioDevice(agentKey); // Wait for initialization

      const device = getTwilioDevice();
      if (device) {
        // Remove any existing listeners first
        device.removeAllListeners();

        device.on('incoming', (conn) => {
          console.log('🔔 Incoming call from Studio flow');
          console.log('Call parameters:', conn.parameters);

          // Accept all incoming calls from Studio
          conn.accept();
          setCallState(CALL_STATES.FLOW_ACTIVE);
          setStatus("📞 Appel studio connecté - bridge actif");
          clearPollingOutcome();
        });

        device.on('disconnect', (conn) => {
          console.log('📞 Call disconnected');
          setCallState(CALL_STATES.COMPLETED);
          setStatus("📞 Appel terminé - remplir le formulaire");
          setShowForm(true);
        });

        // Also handle device-level disconnect
        device.on('disconnected', () => {
          console.log('📱 Device disconnected');
        });

        // Add registration monitoring
        device.on('registered', () => {
          console.log('✅ Device registered successfully');
        });

        device.on('registrationFailed', (error) => {
          console.error('❌ Registration failed:', error);
          setStatus('❌ Erreur de connexion Twilio');
        });

        device.on('error', (error) => {
          console.error('❌ Device error:', error.message);
        });
      }
    };

    setupDevice();
  }, [agentKey]);

  // Ensure form is visible when in appropriate states
  useEffect(() => {
    if (
      callState === CALL_STATES.WAITING_OUTCOME ||
      callState === CALL_STATES.COMPLETED
    ) {
      setShowForm(true);
    }
  }, [callState]);

  // === LOGIC FUNCTIONS ===
  const dial = async () => {
    if (callState !== CALL_STATES.IDLE) {
      setStatus("Opération en cours...");
      return;
    }

    // Get phone number
    const raw =
      get(current, "Mobile_Phone") ||
      get(current, "Direct_Phone") ||
      get(current, "Company_Phone");

    if (!raw || raw === "—") return setStatus("Aucun numéro valide !");

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

    // Check Twilio device state using isBusy
    const device = getTwilioDevice();
    if (!device) {
      setStatus("❌ Device Twilio non initialisé");
      return;
    }

    if (device.isBusy) {
      setStatus("📞 Un appel est déjà en cours");
      return;
    }

    // Set initial states
    setCallState(CALL_STATES.TRIGGERING_FLOW);
    setStatus(`🚀 Déclenchement du flow pour ${to}…`);
    setShowForm(false);
    setCallResult("S_O");
    setCallNotes("");
    setMeetingNotes("");
    setMeetingDatetime("");

    try {
      // Generate call ID
      const callId =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Date.now().toString();

      (current as any).id = callId;

      // Create payload with proper casing
      const payload = {
        to: to, // lowercase
        from: callerId, // lowercase
        parameters: {
          recordId: get(current, "Record_ID"),
          callId,
          leadName: get(current, "Full_Name"),
          company: get(current, "Nom_de_la_compagnie"),
          activity: get(current, "Activite_HC"),
          agent,
          activityName: get(current, "Nom_de_l_Activite"),
        },
      };

      // ADD DEBUG HERE
      console.log('🔍 Debug - Agent identity:', agent);
      console.log('🔍 Debug - Flow parameters:', payload.parameters);
      // Right before the fetch call
      console.log('📋 FULL DEBUG INFO:');
      console.log('- Agent identity:', agent);
      console.log('- Caller ID:', callerId);
      console.log('- To number:', to);
      console.log('- Full payload:', JSON.stringify(payload, null, 2));

      // Trigger the Studio flow
      const res = await fetch(`${STUDIO_API_URL}/create-execution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json: { success: boolean; sid?: string; error?: string } =
        await res.json();

      if (!json.success || !json.sid) {
        throw new Error(json.error || "API error");
      }

      // Connect Twilio device AFTER the flow is created
      console.info('device.connect', { To: to }, '...')
      const call = await device.connect({ params: { To: to } });
      console.info('device.connect result:', call)

      // Store call reference for hang() to work properly
      if (call) {
        (window as any).currentCall = call;

        // ADD THESE HANDLERS:
        call.on('accept', () => {
          console.log('📞 Outgoing call accepted');
          setCallState(CALL_STATES.FLOW_ACTIVE);
          setStatus("📞 Appel connecté - parlez maintenant");
          clearPollingOutcome(); // Stop polling when connected
        });

        call.on('disconnect', () => {
          console.log('📞 Outgoing call disconnected');
          setCallState(CALL_STATES.COMPLETED);
          setStatus("📞 Appel terminé - remplir le formulaire");
          setShowForm(true);
        });

        call.on('error', (error) => {
          console.error('❌ Call error:', error);
          setCallState(CALL_STATES.ERROR);
          setStatus(`❌ Erreur d'appel: ${error.message}`);
        });

        call.on('ringing', () => {
          console.log('🔔 Call is ringing...');
          setStatus("🔔 Sonnerie en cours...");
        });
      }

      // Update states
      setCurrentExecutionSid(json.sid);
      setStatus(`📞 Flow déclenché – ex ${json.sid.slice(-6)}`);
      setCallState(CALL_STATES.WAITING_OUTCOME);
      setShowForm(true); // Show form immediately

      // Start polling for outcome
      // Delay polling for outcome to avoid race with Twilio HTTP callback
      setTimeout(() => {
        console.log(
          `[PowerDialer] Starting delayed polling for callId: ${callId}`
        );
        startPollingOutcome(callId);
      }, 1500); // 1.5 seconds delay

      // Debug logging only in development
      if (import.meta.env.DEV) {
        console.log("Dial states set:", {
          callState: CALL_STATES.WAITING_OUTCOME,
          showForm: true,
          currentExecutionSid: json.sid,
        });
      }
    } catch (err: any) {
      setCallState(CALL_STATES.ERROR);
      setStatus(`❌ Erreur : ${err.message}`);
      setShowForm(false);
    }
  };

  const hang = async () => {
    // Disconnect any active device calls
    const device = getTwilioDevice();
    if (device) {
      device.disconnectAll();
    }

    // Also disconnect any stored call reference
    if ((window as any).currentCall) {
      (window as any).currentCall.disconnect();
      (window as any).currentCall = null;
    }

    // End Studio execution if exists
    if (currentExecutionSid) {
      try {
        await fetch(`${STUDIO_API_URL}/end-execution`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flowSid: FLOW_SID,
            executionSid: currentExecutionSid,
          }),
        });
      } catch (error: any) {
        console.error("Error ending execution:", error);
      }
    }

    clearPollingOutcome();
    setCurrentExecutionSid(null);
    setCallState(CALL_STATES.IDLE);
    setShowForm(false);
    setStatus("📞 Appel terminé");
  };

  const simulate = () => {
    if (callState !== CALL_STATES.IDLE) return setStatus("Appel en cours…");
    setCallState(CALL_STATES.TRIGGERING_FLOW);
    setStatus("🎭 Simulation d'appel...");
    setShowForm(true);

    const callId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Date.now().toString();
    (current as any).id = callId;

    setTimeout(() => {
      clearPollingOutcome();
      setCallState(CALL_STATES.COMPLETED);
      const simulated = "Boite_Vocale" as CallResult;
      setCallResult(simulated);
      updateCallResult(simulated, "Simulation - Message laissé");
      setStatus("📞 Simulation - Boîte vocale");
      setTimeout(() => next(), 2000);
    }, 3000);
  };

  const next = () => {
    if (callState !== CALL_STATES.IDLE && callState !== CALL_STATES.COMPLETED) {
      return setStatus("Terminez l'opération en cours");
    }
    clearPollingOutcome();

    // Clear any active call reference
    if ((window as any).currentCall) {
      (window as any).currentCall = null;
    }

    setIdx((i) => (i + 1 < records.length ? i + 1 : i));
    setCallResult("S_O");
    setCallNotes("");
    setMeetingNotes("");
    setMeetingDatetime("");
    setShowForm(false);
    setCurrentExecutionSid(null);
    setCallState(CALL_STATES.IDLE);
    setStatus("➡️ Contact suivant");
  };

  const saveAndNext = async () => {
    if (callResult === "S_O") {
      setStatus("❌ Sélectionnez un résultat d'appel");
      return;
    }
    setStatus("💾 Sauvegarde en cours...");
    await updateCallResult(
      callResult,
      callNotes,
      meetingNotes,
      meetingDatetime
    );
    clearPollingOutcome();
    setMeetingNotes("");
    setMeetingDatetime("");
    setCallState(CALL_STATES.IDLE);
    setStatus("✅ Résultat sauvegardé");
    next();
    setTimeout(() => {
      const callBtn = document.querySelector(
        "button:has(svg.lucide-phone)"
      ) as HTMLButtonElement;
      if (callBtn) callBtn.click();
    }, 1000);
  };

  const logout = () => {
    if (callState !== CALL_STATES.IDLE) {
      if (!window.confirm("Un appel est en cours. Quitter ?")) return;
    }
    clearPollingOutcome();
    localStorage.removeItem("texion_agent");
    setTimeout(() => {
      navigate("/", { replace: true });
    }, 100);
    destroyTwilioDevice();
  };

  // === UI RENDER ===
  if (loading) return <p className="p-10 text-center">{status}</p>;
  if (records.length === 0)
    return <p className="p-10 text-center">Aucun contact à appeler 👍</p>;

  // Debug logging only in development
  if (import.meta.env.DEV) {
    console.log("Form render check:", {
      showForm,
      callState,
      shouldRender:
        showForm &&
        (callState === CALL_STATES.WAITING_OUTCOME ||
          callState === CALL_STATES.COMPLETED),
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] via-[#fff] to-[#f3f4f6]">
      <div className="rounded-2xl shadow-2xl bg-white/95 px-8 py-12 w-full max-w-3xl flex flex-col items-center">
        <header className="flex flex-col items-center w-full mb-8">
          <img
            src={Logo}
            alt="texion"
            className="w-full h-[100px] mb-3"
            style={{ objectFit: "contain" }}
          />
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            POWER DIALER TEXION
          </h1>
          <span className="text-xs font-medium text-slate-500">
            {idx + 1}/{records.length} — Agent :{" "}
            {agent.split(" ")[0].toUpperCase()}
          </span>
        </header>
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="font-medium text-green-700">
            Live depuis Airtable
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Numéro sortant :</span>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={callerId}
            onChange={(e) => setCallerId(e.target.value)}
          >
            {(AGENT_CALLER_IDS[agentKey] || []).map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="mb-2 font-semibold text-zinc-800">Infos Prospect</h3>
            <Field label="Nom" value={get(current, "Full_Name")} />
            <Field label="Poste" value={get(current, "Job_Title")} />
            <Field
              label="Entreprise"
              value={get(current, "Nom_de_la_compagnie")}
            />
            <Field
              label="Profil LinkedIn"
              value={get(current, "LinkedIn_URL")}
            />
            <Field
              label="Téléphone mobile"
              value={get(current, "Mobile_Phone")}
            />
            <Field
              label="Téléphone direct"
              value={get(current, "Direct_Phone")}
            />
            <Field
              label="Téléphone entreprise"
              value={get(current, "Company_Phone")}
            />
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-zinc-800">Infos Activité</h3>
            <Field
              label="Nom de l'activité"
              value={get(current, "Nom_de_l_Activite")}
            />
            <Field
              label="Type d'activité"
              value={get(current, "Activite_HC")}
            />
            <Field
              label="Nom du responsable"
              value={get(current, "Nom_du_responsable")}
            />
            <Field label="Priorité" value={get(current, "Priorite")} />
            <Field
              label="Statut"
              value={get(current, "Statut_de_l_Activite", "À Faire")}
            />
          </div>
        </div>
        <div
          className={`rounded-md px-4 py-3 text-sm ring-1 ${callState === CALL_STATES.TRIGGERING_FLOW
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
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Action
            icon={Phone}
            onClick={dial}
            disabled={callState !== CALL_STATES.IDLE}
          >
            Appeler
          </Action>
          <Action
            icon={FlaskConical}
            onClick={simulate}
            disabled={callState !== CALL_STATES.IDLE}
          >
            Simuler
          </Action>
          <Action
            icon={PhoneOff}
            onClick={hang}
            disabled={callState === CALL_STATES.IDLE}
          >
            Arrêter
          </Action>
          <Action
            icon={SkipForward}
            onClick={next}
            disabled={callState !== CALL_STATES.IDLE}
          >
            Suivant
          </Action>
          <Action icon={Lock} onClick={logout}>
            Logout
          </Action>
        </div>
        {showForm && (
          <ResultForm
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
          />
        )}
      </div>
    </div>
  );
}

// Helpers
function Field({ label, value }: { label: string; value: string }) {
  if (
    (label === "Profil LinkedIn" || label === "LinkedIn_URL") &&
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