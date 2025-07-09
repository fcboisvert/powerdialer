// src/components/PowerDialer.tsx
import React, { useEffect, useState, useRef } from "react";
import "./PowerDialer.css";
import type { CallRecord } from "@/types/dialer";

declare global {
  interface Window {
    Twilio: any;
  }
}

const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/elyl7t9siafnen8m6xentift6334yaek";
const AGENT_CALLER_IDS: Record<string, string[]> = {
  frederic: ["+14388178171"],
  simon: ["+14388178177"],
};

const getAgent = (): string => localStorage.getItem("texion_agent") || "frederic";

const PowerDialer: React.FC = () => {
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("Chargement des contacts...");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [agent] = useState<string>(getAgent());
  const [callerId, setCallerId] = useState<string>("");
  const [callActive, setCallActive] = useState(false);
  const [showResultForm, setShowResultForm] = useState(false);

  // Twilio refs
  const twilioDevice = useRef<any>(null);
  const connection = useRef<any>(null);

  useEffect(() => {
    setStatus("Chargement des contacts...");
    fetch(`${MAKE_WEBHOOK_URL}?agent=${encodeURIComponent(agent)}`)
      .then(res => res.json())
      .then(list => {
        if (Array.isArray(list) && list.length > 0) {
          setRecords(list);
          setStatus(`✅ ${list.length} contact(s) chargé(s)`);
        } else {
          setRecords([{ id: "test", "Full Name": ["Test"], "Mobile Phone": ["+15140000000"] } as any]);
          setStatus("⚠️ Mode test activé");
        }
        setLoading(false);
      })
      .catch(() => {
        setRecords([{ id: "test", "Full Name": ["Test"], "Mobile Phone": ["+15140000000"] } as any]);
        setStatus("⚠️ Erreur chargement, mode test activé");
        setLoading(false);
      });
  }, [agent]);

  useEffect(() => {
    // Set default callerId after agent/records load
    const ids = AGENT_CALLER_IDS[agent] || [];
    if (ids.length > 0) setCallerId(ids[0]);
  }, [agent, records]);

  useEffect(() => {
    if (!window.Twilio) {
      setStatus("Twilio SDK non chargé !");
      return;
    }
    let device: any = null;
    const initTwilio = async () => {
      setStatus("Initialisation Twilio...");
      try {
        const res = await fetch(`https://almond-mouse-3471.twil.io/token-public?agent=${agent}`);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const { token } = await res.json();
        device = new window.Twilio.Device(token, { debug: false });
        twilioDevice.current = device;

        device.on("ready", () => setStatus("Twilio prêt"));
        device.on("connect", () => {
          setStatus("📞 Appel en cours...");
          setCallActive(true);
        });
        device.on("disconnect", () => {
          setStatus("🛑 Appel terminé");
          setCallActive(false);
          setShowResultForm(true);
        });
        device.on("error", (err: any) => setStatus("Erreur Twilio: " + err.message));
      } catch (e: any) {
        setStatus("Erreur token: " + e.message);
      }
    };
    initTwilio();
    return () => {
      if (device) device.destroy();
    };
  }, [agent]);

  if (loading) return <div>{status}</div>;
  const current = records[currentIdx];
  const getField = (obj: any, key: string, def = "—") =>
    Array.isArray(obj?.[key]) ? (obj[key][0] || def) : (obj?.[key] || def);

  // -- Button handlers --
  const handleCall = () => {
    if (!twilioDevice.current) {
      setStatus("Twilio non initialisé");
      return;
    }
    let phoneNumber = getField(current, "Mobile Phone");
    if (!phoneNumber || phoneNumber === "—") phoneNumber = getField(current, "Direct Phone");
    if (!phoneNumber || phoneNumber === "—") phoneNumber = getField(current, "Company Phone");
    if (!phoneNumber || phoneNumber === "—") {
      setStatus("Aucun numéro de téléphone valide pour ce contact !");
      return;
    }
    if (!callerId) {
      setStatus("Sélectionnez un Caller ID !");
      return;
    }
    setStatus(`Appel en cours vers ${phoneNumber} (Caller ID: ${callerId})...`);
    setCallActive(true);
    setShowResultForm(false);
    connection.current = twilioDevice.current.connect({
      To: phoneNumber,
      From: callerId,
      contact_channel_address: phoneNumber,
      flow_channel_address: callerId
    });
  };

  const handleSimulate = () => {
    setStatus("🎭 Appel simulé…");
    setCallActive(true);
    setShowResultForm(false);
    setTimeout(() => {
      setStatus("📞 Fin de la simulation");
      setCallActive(false);
      setShowResultForm(true);
    }, 2000);
  };

  const handleHang = () => {
    if (twilioDevice.current) twilioDevice.current.disconnectAll();
    setStatus("📞 Appel raccroché");
    setCallActive(false);
    setShowResultForm(true);
  };

  const handleNext = () => {
    setShowResultForm(false);
    setCurrentIdx(i => (i + 1 < records.length ? i + 1 : i));
    setStatus("➡️ Suivant");
  };

  const handleLogout = () => {
    localStorage.removeItem("texion_agent");
    window.location.reload();
  };

  return (
    <div className="texion-dialer">
      <h2 className="texion-title">📞 POWER DIALER TEXION</h2>
      <div style={{ textAlign: "center", fontWeight: "bold", marginBottom: 10 }}>
        {currentIdx + 1}/{records.length} – Agent: {agent.toUpperCase()}
      </div>
      <div className="texion-callerid">
        <label htmlFor="callerIdSelect">Numéro sortant :</label>
        <select
          id="callerIdSelect"
          value={callerId}
          onChange={e => setCallerId(e.target.value)}
        >
          {(AGENT_CALLER_IDS[agent] || []).map(num => (
            <option key={num} value={num}>{num}</option>
          ))}
        </select>
      </div>
      <div className="texion-section-title">Infos Prospect</div>
      <div className="texion-field"><label>Nom :</label><span>{getField(current, "Full Name")}</span></div>
      <div className="texion-field"><label>Fonction :</label><span>{getField(current, "Job Title")}</span></div>
      <div className="texion-field"><label>Entreprise :</label><span>{getField(current, "Nom de la compagnie")}</span></div>
      <div className="texion-field"><label>Secteur :</label><span>{getField(current, "Sector")}</span></div>
      <div className="texion-field"><label>Téléphone mobile :</label><span>{getField(current, "Mobile Phone")}</span></div>
      <div className="texion-field"><label>Téléphone direct :</label><span>{getField(current, "Direct Phone")}</span></div>
      <div className="texion-field"><label>Téléphone entreprise :</label><span>{getField(current, "Company Phone")}</span></div>
      <div className="texion-section-title">Infos Activité</div>
      <div className="texion-field"><label>Nom de l'activité :</label><span>{getField(current, "Nom de l'Activité")}</span></div>
      <div className="texion-field"><label>Date Due :</label><span>{getField(current, "Date Due")}</span></div>
      <div className="texion-field"><label>Statut :</label><span>{getField(current, "Statut de l'Activité", "À Faire")}</span></div>
      <div className="texion-status">Statut : {status}</div>
      <div>
        <button className="texion-btn" onClick={handleCall} disabled={callActive}>📞 Appeler</button>
        <button className="texion-btn" onClick={handleSimulate} disabled={callActive}>🎭 Simuler</button>
        <button className="texion-btn" onClick={handleHang} disabled={!callActive}>🛑 Raccrocher</button>
        <button className="texion-btn" onClick={handleNext} disabled={callActive}>➡️ Suivant</button>
        <button className="texion-btn" onClick={handleLogout}>🔐 Logout</button>
      </div>
      {showResultForm && (
        <div className="texion-form" style={{ display: "block", marginTop: 20 }}>
          <h3>Résultat de l'appel</h3>
          {/* Add form fields for saving results here */}
          <button className="texion-btn">💾 Sauvegarder & Suivant</button>
        </div>
      )}
    </div>
  );
};

export default PowerDialer;
