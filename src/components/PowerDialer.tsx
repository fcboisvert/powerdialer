import React, { useEffect, useState, useRef } from "react";
import type { CallRecord } from "@/types/dialer";
import { Button } from "@/components/ui/button";
import {
  Phone,
  FlaskConical,
  PhoneOff,
  SkipForward,
  Lock
} from "lucide-react";
import Logo from "/texion-logo.svg";

declare global {
  interface Window {
    Twilio: any;
  }
}

/* ─────────── config ─────────── */
const MAKE_WEBHOOK_URL =
  "https://hook.us2.make.com/elyl7t9siafnen8m6xentift6334yaek";

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
  const [showForm, setShowForm] = useState(false);

  const twilioDevice = useRef<any>(null);
  const connection = useRef<any>(null);

  /* fetch queue from Make */
  useEffect(() => {
    fetch(`${MAKE_WEBHOOK_URL}?agent=${encodeURIComponent(agent)}`)
      .then((r) => r.json())
      .then((list) => {
        if (Array.isArray(list) && list.length) {
          setRecords(list);
          setStatus(`✅ ${list.length} contact(s) chargé(s)`);
        } else {
          setRecords([
            {
              "Nom de l'Activite": "Test Activity",
              "Flow_URL": "https://studio.twilio.com/v2/Flows/FW236e663e008973ab36cbfcdc706b6d97/Executions",
              "Full_Name": "Test User",
              "Mobile_Phone": "+15140000000",
              "Job_Title": "Test Position",
              "Nom_de_la_compagnie": "Test Company"
            } as any
          ]);
          setStatus("⚠️ Mode test activé");
        }
      })
      .catch(() => {
        setRecords([
          {
            "Nom de l'Activite": "Test Activity",
            "Flow_URL": "https://studio.twilio.com/v2/Flows/FW236e663e008973ab36cbfcdc706b6d97/Executions",
            "Full_Name": "Test User",
            "Mobile_Phone": "+15140000000",
            "Job_Title": "Test Position",
            "Nom_de_la_compagnie": "Test Company"
          } as any
        ]);
        setStatus("⚠️ Erreur chargement, mode test activé");
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
          setStatus("📞 Appel en cours…");
          setCallActive(true);
        });
        device.on("disconnect", () => {
          setStatus("🛑 Appel terminé");
          setCallActive(false);
          setShowForm(true);
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
    let num = get(current, "Mobile_Phone");
    if (num === "—") num = get(current, "Direct_Phone");
    if (num === "—") num = get(current, "Company_Phone");
    if (num === "—") return setStatus("Aucun numéro valide !");
    if (!callerId) return setStatus("Sélectionnez un Caller ID !");

    // Get the Flow URL from Make.com and extract the Flow SID
    const flowUrl = get(current, "Flow_URL");
    const flowSid = getFlowSidFromUrl(flowUrl);
    
    setStatus(`Appel → ${num}${flowSid ? ` (Flow: ${flowSid})` : ''}`);
    setShowForm(false);
    
    const connectionParams: any = {
      To: num,
      From: callerId,
      contact_channel_address: num,
      flow_channel_address: callerId
    };

    // Add Flow SID if available
    if (flowSid) {
      connectionParams.flowSid = flowSid;
    }
    
    connection.current = twilioDevice.current.connect(connectionParams);
  };

  const simulate = () => {
    setStatus("🎭 Simulation…");
    setCallActive(true);
    setShowForm(false);
    setTimeout(() => {
      setStatus("📞 Fin de la simulation");
      setCallActive(false);
      setShowForm(true);
    }, 2000);
  };
  
  const hang = () => {
    twilioDevice.current?.disconnectAll();
    setStatus("📞 Appel raccroché");
    setCallActive(false);
    setShowForm(true);
  };
  
  const next = () => {
    setIdx((i) => (i + 1 < records.length ? i + 1 : i));
    setShowForm(false);
    setStatus("➡️ Suivant");
  };
  
  const logout = () => {
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

        {/* status banner */}
        <div className="rounded-md bg-zinc-50 ring-1 ring-zinc-100 px-4 py-3 text-sm">
          Statut&nbsp;: {status}
        </div>

        {/* buttons */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Action icon={Phone} onClick={dial} disabled={callActive}>
            Appeler
          </Action>
          <Action icon={FlaskConical} onClick={simulate} disabled={callActive}>
            Simuler
          </Action>
          <Action icon={PhoneOff} onClick={hang} disabled={!callActive}>
            Raccrocher
          </Action>
          <Action icon={SkipForward} onClick={next} disabled={callActive}>
            Suivant
          </Action>
          <Action icon={Lock} onClick={logout}>Logout</Action>
        </div>

        {/* result form placeholder */}
        {showForm && (
          <div className="mt-8 rounded-lg bg-zinc-50 ring-1 ring-zinc-100 p-6">
            <h4 className="font-medium mb-4">Résultat de l'appel</h4>
            
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
                  <strong>Résultat actuel:</strong> {get(current, "Resultat_Appel")}
                </p>
              </div>
            )}

            {/* Placeholder for form inputs */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Résultat de l'appel:</label>
                <select className="w-full border rounded px-3 py-2 text-sm">
                  <option>Intéressé - RDV programmé</option>
                  <option>Intéressé - Rappel plus tard</option>
                  <option>Pas intéressé</option>
                  <option>Pas disponible - Laisser message</option>
                  <option>Numéro invalide</option>
                  <option>Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes:</label>
                <textarea 
                  className="w-full border rounded px-3 py-2 text-sm" 
                  rows={3}
                  placeholder="Notes sur l'appel..."
                ></textarea>
              </div>
            </div>

            <Button onClick={next}>💾 Sauvegarder &amp; Suivant</Button>
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