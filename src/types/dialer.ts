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
  [key: string]: any;
}

export interface PowerDialerProps {
  agent: string;
  onLogout: () => void;
}