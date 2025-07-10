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
              id: "test",
              "Full Name": ["Test"],
              "Mobile Phone": ["+15140000000"]
            } as any
          ]);
          setStatus("⚠️ Mode test activé");
        }
      })
      .catch(() => {
        setRecords([
          {
            id: "test",
            "Full Name": ["Test"],
            "Mobile Phone": ["+15140000000"]
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
  const get = (obj: any, key: string, d = "—") =>
    Array.isArray(obj?.[key]) ? obj[key][0] || d : obj?.[key] || d;



  /* actions */
  const dial = () => {
    if (!twilioDevice.current) return setStatus("Twilio non initialisé");
    let num = get(current, "Mobile Phone");
    if (num === "—") num = get(current, "Direct Phone");
    if (num === "—") num = get(current, "Company Phone");
    if (num === "—") return setStatus("Aucun numéro valide !");
    if (!callerId) return setStatus("Sélectionnez un Caller ID !");

    setStatus(`Appel → ${num}`);
    setShowForm(false);
    
    connection.current = twilioDevice.current.connect({
      To: num,
      From: callerId,
      contact_channel_address: num,
      flow_channel_address: callerId
    });
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

        {/* caller-ID selector */}
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
            <Field label="Nom" value={get(current, "Full Name")} />
            <Field label="Fonction" value={get(current, "Job Title")} />
            <Field label="Entreprise" value={get(current, "Nom de la compagnie")} />
            <Field label="Secteur" value={get(current, "Sector")} />
            <Field label="Téléphone mobile" value={get(current, "Mobile Phone")} />
            <Field label="Téléphone direct" value={get(current, "Direct Phone")} />
            <Field label="Téléphone entreprise" value={get(current, "Company Phone")} />
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-zinc-800">Infos Activité</h3>
            <Field label="Nom de l'activité" value={get(current, "Nom de l'Activité")} />
            <Field label="Type d'activité" value={get(current, "Activité 2.0 H.C.")} />
            <Field label="Date Due" value={get(current, "Date Due")} />
            <Field label="Statut" value={get(current, "Statut de l'Activité", "À Faire")} />
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
            {/* add your form inputs here */}
            <Button onClick={next}>💾 Sauvegarder &amp; Suivant</Button>
          </div>
        )}
      </section>
    </main>
  );
}

/* ─────────── helpers ─────────── */
function Field({ label, value }: { label: string; value: string }) {
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