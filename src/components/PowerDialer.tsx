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
  CheckCircle
} from "lucide-react";
import Logo from "/texion-logo.svg";

declare global {
  interface Window {
    Twilio: any;
  }
}

/* ─────────── config ─────────── */
const QUEUE_API_URL = "https://texion.app/api/queue";
const AIRTABLE_API_URL = "https://texion.app/api/airtable";

const AGENT_CALLER_IDS: Record<string, string[]> = {
  frederic: ["+14388178171"],
  simon: ["+14388178177"]
};

const getAgent = () => localStorage.getItem("texion_agent") || "frederic";

/* ─────────── component ─────────── */
export default function PowerDialer() {
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Chargement des contacts…");
  const [idx, setIdx] = useState(0);

  const agent = getAgent();
  const [callerId, setCallerId] = useState("");
  const [callActive, setCallActive] = useState(false);
  const [callState, setCallState] = useState<'idle' | 'calling' | 'waiting_outcome' | 'agent_connected'>('idle');
  const [showForm, setShowForm] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callResult, setCallResult] = useState("");
  const [callNotes, setCallNotes] = useState("");

  const twilioDevice = useRef<any>(null);
  const connection = useRef<any>(null);

  /* Listen for call outcome webhooks */
  useEffect(() => {
    const handleCallOutcome = (event: CustomEvent) => {
      const { outcome, callId, activity } = event.detail;
      console.log("Received call outcome:", outcome, callId);
      
      if (callId === currentCallId) {
        if (outcome === "Répondeur" || outcome === "Boite_Vocale") {
          // Automatic voicemail outcome
          setCallResult("Boite_Vocale");
          setCallState('idle');
          setCallActive(false);
          updateCallResult("Boite_Vocale", "Message laissé automatiquement");
          setStatus("📞 Message vocal laissé");
          setTimeout(() => next(), 2000); // Auto advance after 2 seconds
        } else if (outcome === "Répondu_Humain") {
          // Human answered - agent needs to handle the call
          setCallState('agent_connected');
          setStatus("👤 Humain répondu - En conversation");
          setShowForm(true);
        } else if (outcome === "Pas_Joignable") {
          // Not reachable
          setCallResult("Pas_Joignable");
          setCallState('idle');
          setCallActive(false);
          updateCallResult("Pas_Joignable", "Numéro non joignable");
          setStatus("❌ Pas joignable");
          setTimeout(() => next(), 2000);
        }
      }
    };

    window.addEventListener('callOutcome', handleCallOutcome as EventListener);
    return () => window.removeEventListener('callOutcome', handleCallOutcome as EventListener);
  }, [currentCallId]);

  /* Update call result to Airtable */
  const updateCallResult = async (result: string, notes: string) => {
    try {
      const current = records[idx];
      await fetch(`${AIRTABLE_API_URL}/update-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityName: get(current, "Nom de l'Activite"),
          result: result,
          notes: notes,
          agent: agent
        })
      });
    } catch (error) {
      console.error("Error updating call result:", error);
    }
  };

  /* fetch queue from API */
  useEffect(() => {
    const url = `${QUEUE_API_URL}?agent=${encodeURIComponent(agent)}`;
    console.log("Fetching from queue API:", url); // Debug log
    
    fetch(url)
      .then((r) => r.json())
      .then((response) => {
        console.log("Queue API response:", response); // Debug log
        console.log("Agent being requested:", agent); // Debug log
        console.log("Response type:", typeof response); // Debug log
        console.log("Is array:", Array.isArray(response)); // Debug log
        
        // Handle the response from your queue API
        let list: any[] = [];
        
        if (Array.isArray(response)) {
          // Direct array response
          list = response;
          console.log("Using direct array, length:", list.length);
        } else if (response && typeof response === 'object') {
          // Key-value response where agent name is the key
          console.log("Object keys:", Object.keys(response));
          list = response[agent] || response[agent.toLowerCase()] || response[agent.toUpperCase()] || [];
          console.log("Using key-value, agent key:", agent, "list length:", list.length);
        }
        
        if (Array.isArray(list) && list.length) {
          console.log("Setting records:", list);
          setRecords(list);
          setStatus(`✅ ${list.length} contact(s) en file d'attente`);
        } else {
          console.log("No data in queue, using test data");
          setRecords([
            {
              "Nom de l'Activite": "SPARK Microsystems-Jean-Sebastien Poirier-T2-0.3 Cold Call 1",
              "Flow_URL": "https://studio.twilio.com/v2/Flows/FW236e663e008973ab36cbfcdc706b6d97/Executions",
              "Full_Name": "Jean-Sebastien Poirier",
              "Mobile_Phone": "15148060649",
              "Job_Title": "Director of Operations and Quality",
              "Nom_de_la_compagnie": "SPARK Microsystems",
              "LinkedIn_URL": "https://www.linkedin.com/in/ACwAAB99-_wBx7uE2Au4xf9ALpUwH_EeWTa8ifU",
              "Direct_Phone": "438-375-3990",
              "Company_Phone": "438-375-3990",
              "Priorite": "2",
              "Statut_de_l_Activite": "À Faire",
              "Linked_Notes": "",
              "Date et Heure Rencontre": "",
              "Message_content": "",
              "Resultat_Appel": ""
            } as any
          ]);
          setStatus(`⚠️ File d'attente vide pour ${agent} - Mode test`);
        }
      })
      .catch((error) => {
        console.error("Queue API error:", error); // Debug log
        setRecords([
          {
            "Nom de l'Activite": "SPARK Microsystems-Jean-Sebastien Poirier-T2-0.3 Cold Call 1",
            "Flow_URL": "https://studio.twilio.com/v2/Flows/FW236e663e008973ab36cbfcdc706b6d97/Executions",
            "Full_Name": "Jean-Sebastien Poirier",
            "Mobile_Phone": "15148060649",
            "Job_Title": "Director of Operations and Quality",
            "Nom_de_la_compagnie": "SPARK Microsystems",
            "LinkedIn_URL": "https://www.linkedin.com/in/ACwAAB99-_wBx7uE2Au4xf9ALpUwH_EeWTa8ifU",
            "Direct_Phone": "438-375-3990",
            "Company_Phone": "438-375-3990",
            "Priorite": "2",
            "Statut_de_l_Activite": "À Faire",
            "Linked_Notes": "",
            "Date et Heure Rencontre": "",
            "Message_content": "",
            "Resultat_Appel": ""
          } as any
        ]);
        setStatus("⚠️ Erreur API file d'attente - Mode test");
      })
      .finally(() => setLoading(false));
  }, [agent]);

  /* caller-ID selection */
  useEffect(() => {
    const ids = AGENT_CALLER_IDS[agent] || [];
    if (ids.length) setCallerId(ids[0]);
  }, [agent]);

  /* init Twilio once */
  useEffect(() => {
    if (!window.Twilio) {
      setStatus("Twilio SDK non chargé !");
      return;
    }
    let device: any;
    (async () => {
      setStatus("Initialisation Twilio…");
      try {
        const res = await fetch(
          `https://almond-mouse-3471.twil.io/token-public?agent=${agent}`
        );
        const { token } = await res.json();
        device = new window.Twilio.Device(token);
        twilioDevice.current = device;

        device.on("ready", () => setStatus("Twilio prêt"));
        device.on("connect", () => {
          setStatus("📞 Appel connecté - En attente du résultat...");
          setCallActive(true);
          setCallState('waiting_outcome');
        });
        device.on("disconnect", () => {
          if (callState === 'agent_connected') {
            setStatus("📞 Conversation terminée");
            setShowForm(true);
          } else {
            setStatus("🛑 Appel terminé");
            setCallState('idle');
          }
          setCallActive(false);
        });
        device.on("error", (e: any) =>
          setStatus("Erreur Twilio: " + e.message)
        );
      } catch (e: any) {
        setStatus("Erreur token: " + e.message);
      }
    })();
    return () => device && device.destroy();
  }, [agent]);

  /* helpers */
  const current = records[idx];
  const get = (obj: any, key: string, d = "—") => {
    // Handle both array and direct string values
    if (Array.isArray(obj?.[key])) {
      return obj[key][0] || d;
    }
    return obj?.[key] || d;
  };

  // Extract Flow SID from the Flow URL
  const getFlowSidFromUrl = (flowUrl: string): string | null => {
    if (!flowUrl || flowUrl === "—") return null;
    const match = flowUrl.match(/\/Flows\/([A-Za-z0-9]+)\/Executions/);
    return match ? match[1] : null;
  };



  /* actions */
  const dial = () => {
    if (!twilioDevice.current) return setStatus("Twilio non initialisé");
    if (callState !== 'idle') return setStatus("Appel en cours, veuillez patienter");
    
    let num = get(current, "Mobile_Phone");
    if (num === "—") num = get(current, "Direct_Phone");
    if (num === "—") num = get(current, "Company_Phone");
    if (num === "—") return setStatus("Aucun numéro valide !");
    if (!callerId) return setStatus("Sélectionnez un Caller ID !");

    // Get the Flow URL from the queue data and extract the Flow SID
    const flowUrl = get(current, "Flow_URL");
    const flowSid = getFlowSidFromUrl(flowUrl);
    
    // Generate unique call ID
    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentCallId(callId);
    
    setCallState('calling');
    setStatus(`📞 Composition → ${num}${flowSid ? ` (Flow: ${flowSid})` : ''}`);
    setShowForm(false);
    setCallResult("");
    setCallNotes("");
    
    const connectionParams: any = {
      To: num,
      From: callerId,
      contact_channel_address: num,
      flow_channel_address: callerId,
      // Pass activity information to the flow
      activity: get(current, "Nom de l'Activite"),
      callId: callId,
      leadName: get(current, "Full_Name"),
      company: get(current, "Nom_de_la_compagnie"),
      agent: agent
    };

    // Add Flow SID if available
    if (flowSid) {
      connectionParams.flowSid = flowSid;
    }
    
    connection.current = twilioDevice.current.connect(connectionParams);
  };

  const simulate = () => {
    if (callState !== 'idle') return setStatus("Appel en cours, veuillez patienter");
    
    setStatus("🎭 Simulation d'appel...");
    setCallActive(true);
    setCallState('calling');
    setShowForm(false);
    setTimeout(() => {
      setStatus("📞 Simulation - Boîte vocale");
      setCallActive(false);
      setCallState('idle');
      setCallResult("Boite_Vocale");
      updateCallResult("Boite_Vocale", "Simulation - Message laissé");
      setTimeout(() => next(), 2000);
    }, 3000);
  };
  
  const hang = () => {
    twilioDevice.current?.disconnectAll();
    setStatus("📞 Appel raccroché");
    setCallActive(false);
    setCallState('idle');
    setCurrentCallId(null);
    setShowForm(false);
  };
  
  const next = () => {
    if (callState !== 'idle') return setStatus("Terminez l'appel en cours avant de passer au suivant");
    
    setIdx((i) => (i + 1 < records.length ? i + 1 : i));
    setShowForm(false);
    setCallResult("");
    setCallNotes("");
    setCurrentCallId(null);
    setStatus("➡️ Contact suivant");
  };

  const saveAndNext = async () => {
    if (!callResult) {
      setStatus("❌ Veuillez sélectionner un résultat d'appel");
      return;
    }
    
    setStatus("💾 Sauvegarde en cours...");
    await updateCallResult(callResult, callNotes);
    setCallState('idle');
    setStatus("✅ Résultat sauvegardé");
    setTimeout(() => next(), 1000);
  };
  
  const logout = () => {
    if (callState !== 'idle') {
      if (!confirm("Un appel est en cours. Êtes-vous sûr de vouloir vous déconnecter ?")) {
        return;
      }
    }
    localStorage.removeItem("texion_agent");
    window.location.reload();
  };

  if (loading) return <p className="p-10 text-center">{status}</p>;

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-100 via-white to-zinc-100 flex items-center justify-center p-4">
      <section className="w-full max-w-3xl bg-white rounded-xl shadow-xl ring-1 ring-zinc-100 p-10 space-y-8">
        {/* header */}
        <header className="flex items-center gap-3">
          <img src={Logo} alt="texion" className="w-10 h-auto" />
          <h1 className="text-lg font-semibold tracking-tight">
            POWER DIALER TEXION
          </h1>
          <span className="ml-auto text-sm font-medium">
            {idx + 1}/{records.length}&nbsp;– Agent&nbsp;:
            {agent.toUpperCase()}
          </span>
        </header>

        {/* Flow indicator */}
        {get(current, "Flow_URL") !== "—" && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Flow assigné&nbsp;:</span>
            <span className="text-blue-600 font-mono text-xs">
              {getFlowSidFromUrl(get(current, "Flow_URL")) || "Non détecté"}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Numéro sortant&nbsp;:</span>
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



        {/* 2-column grid */}
        <div className="grid md:grid-cols-2 gap-x-12 gap-y-6 text-sm">
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

        {/* status banner with call state indicator */}
        <div className={`rounded-md px-4 py-3 text-sm ring-1 ${
          callState === 'calling' ? 'bg-blue-50 ring-blue-200 text-blue-800' :
          callState === 'waiting_outcome' ? 'bg-yellow-50 ring-yellow-200 text-yellow-800' :
          callState === 'agent_connected' ? 'bg-green-50 ring-green-200 text-green-800' :
          'bg-zinc-50 ring-zinc-100'
        }`}>
          <div className="flex items-center gap-2">
            {callState === 'calling' && <Phone className="w-4 h-4 animate-pulse" />}
            {callState === 'waiting_outcome' && <Clock className="w-4 h-4 animate-spin" />}
            {callState === 'agent_connected' && <CheckCircle className="w-4 h-4" />}
            <span>Statut&nbsp;: {status}</span>
          </div>
        </div>

        {/* buttons */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Action icon={Phone} onClick={dial} disabled={callState !== 'idle'}>
            Appeler
          </Action>
          <Action icon={FlaskConical} onClick={simulate} disabled={callState !== 'idle'}>
            Simuler
          </Action>
          <Action icon={PhoneOff} onClick={hang} disabled={!callActive && callState === 'idle'}>
            Raccrocher
          </Action>
          <Action icon={SkipForward} onClick={next} disabled={callState !== 'idle'}>
            Suivant
          </Action>
          <Action icon={Lock} onClick={logout}>Logout</Action>
        </div>

        {/* result form */}
        {showForm && callState === 'agent_connected' && (
          <div className="mt-8 rounded-lg bg-zinc-50 ring-1 ring-zinc-100 p-6">
            <h4 className="font-medium mb-4">📞 Conversation terminée - Saisir le résultat</h4>
            
            {/* Show current message content if available */}
            {get(current, "Message_content") !== "—" && (
              <div className="mb-4 p-3 bg-blue-50 rounded border-l-4 border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Message préparé:</strong> {get(current, "Message_content")}
                </p>
              </div>
            )}

            {/* Show current result if available */}
            {get(current, "Resultat_Appel") !== "—" && (
              <div className="mb-4 p-3 bg-green-50 rounded border-l-4 border-green-200">
                <p className="text-sm text-green-800">
                  <strong>Résultat précédent:</strong> {get(current, "Resultat_Appel")}
                </p>
              </div>
            )}

            {/* Form inputs */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Résultat de l'appel: *</label>
                <select 
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={callResult}
                  onChange={(e) => setCallResult(e.target.value)}
                >
                  <option value="">-- Sélectionner un résultat --</option>
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
                <label className="block text-sm font-medium mb-1">Notes:</label>
                <textarea 
                  className="w-full border rounded px-3 py-2 text-sm" 
                  rows={3}
                  placeholder="Notes sur l'appel..."
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                ></textarea>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={saveAndNext} disabled={!callResult}>
                💾 Sauvegarder &amp; Suivant
              </Button>
              <Button variant="outline" onClick={hang}>
                ❌ Annuler l'appel
              </Button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

/* ─────────── helpers ─────────── */
function Field({ label, value }: { label: string; value: string }) {
  // Handle LinkedIn URLs specifically
  if (label === "LinkedIn" && value !== "—" && value.includes("linkedin.com")) {
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

  // Handle phone numbers - format them nicely
  if ((label.includes("Téléphone") || label.includes("Phone")) && value !== "—") {
    const formattedPhone = value.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
    return (
      <p className="flex">
        <span className="w-40 shrink-0 font-medium text-zinc-500">{label} :</span>
        <span className="text-zinc-800 font-mono">{formattedPhone}</span>
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