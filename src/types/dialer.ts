// src/types/dialer.ts

// === CRM Record for a call target (from Airtable) ===
export interface CallRecord {
  "Contact Full Name"?: string;
  "Job Title"?: string;
  "Mobile Phone"?: string;
  "Direct Phone"?: string;
  "Company Phone"?: string;
  "Nom de la compagnie"?: string;
  "Sector"?: string;
  "Activity Name"?: string;
  "Date Due"?: string;
  "Status"?: string;
  [key: string]: any; // allow fallback for dynamic Airtable fields
}

// === Props for the top-level PowerDialer component ===
export interface PowerDialerProps {
  agent: string;
  onLogout: () => void;
}


// === Normalized call outcomes (used in Airtable + UI form) ===
export type CallResult =
  | 'S_O'
  | 'Rencontre_Expl._Planifiee'
  | 'Rencontre_Besoin_Planifiee'
  | 'Visite_Planifiee'
  | 'Offre_Planifiee'
  | 'Touchbase_Planifiee'
  | 'Relancer_Dans_X'
  | 'Info_Par_Courriel'
  | 'Boite_Vocale'     // ← from "Répondeur"
  | 'Pas_Joignable'     // ← from "Pas_Joignable"
  | 'Pas_Interesse'
  | 'Demande_Lien_Booking'
  | 'Me_Refere_Interne'
  | 'Me_Refere_Externe';
