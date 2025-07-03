import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { User, Building, Phone } from "lucide-react";
import type { CallRecord } from "@/types/dialer";

interface ContactInfoProps {
  record: CallRecord;
}

const ContactInfo: React.FC<ContactInfoProps> = ({ record }) => {
  // Determine the most relevant phone number to display
  const phoneNumber =
    record["Mobile Phone"] ||
    record["Direct Phone"] ||
    record["Company Phone"] ||
    "—";

  // Determine phone label
  const phoneLabel = record["Mobile Phone"]
    ? "Mobile prioritaire"
    : record["Direct Phone"]
    ? "Ligne directe"
    : record["Company Phone"]
    ? "Téléphone entreprise"
    : "";

  return (
    <Card className="rounded-2xl shadow-xl border-0 bg-white/95 backdrop-blur-xl overflow-hidden">
      <CardHeader className="relative pb-4">
        <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-3">
          <div className="h-8 w-8 bg-gradient-to-br from-texion-orange to-red-500 rounded-lg flex items-center justify-center">
            <User className="h-4 w-4 text-white" />
          </div>
          Informations du contact
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Name Card */}
          <div className="p-6 bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-200/60 shadow-sm">
            <Label className="flex items-center gap-2 text-slate-600 font-medium text-xs uppercase tracking-wider mb-3">
              <User className="h-3 w-3" />
              Nom du contact
            </Label>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-slate-900">
                {record["Contact Full Name"] || "—"}
              </p>
              <p className="text-sm text-slate-500">
                {record["Job Title"] || "—"}
              </p>
            </div>
          </div>

          {/* Phone Card */}
          <div className="p-6 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-200/60 shadow-sm">
            <Label className="flex items-center gap-2 text-emerald-700 font-medium text-xs uppercase tracking-wider mb-3">
              <Phone className="h-3 w-3" />
              Numéro principal
            </Label>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-slate-900 font-mono">
                {phoneNumber}
              </p>
              <p className="text-sm text-emerald-600">{phoneLabel}</p>
            </div>
          </div>

          {/* Company Card */}
          <div className="p-6 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-200/60 shadow-sm">
            <Label className="flex items-center gap-2 text-blue-700 font-medium text-xs uppercase tracking-wider mb-3">
              <Building className="h-3 w-3" />
              Entreprise
            </Label>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-slate-900">
                {record["Nom de la compagnie"] || "—"}
              </p>
              <p className="text-sm text-blue-600">
                {record["Sector"] || "—"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContactInfo;