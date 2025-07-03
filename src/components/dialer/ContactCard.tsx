import { Card, CardContent } from "@/components/ui/card";

interface ContactCardProps {
  name: string;
  job?: string;
  phone?: string;
  company?: string;
  sector?: string;
  directPhone?: string;
  companyPhone?: string;
}

const ContactCard = ({
  name,
  job,
  phone,
  company,
  sector,
  directPhone,
  companyPhone,
}: ContactCardProps) => (
  <Card className="mb-4">
    <CardContent className="grid gap-2 p-6">
      <div>
        <span className="font-bold text-lg">{name}</span>
        {job && <span className="ml-2 text-gray-500">({job})</span>}
      </div>
      <div className="text-sm text-gray-700">
        <strong>Entreprise:</strong> {company || "—"}
      </div>
      <div className="text-sm text-gray-700">
        <strong>Secteur:</strong> {sector || "—"}
      </div>
      <div className="text-sm text-gray-700">
        <strong>Téléphone mobile:</strong> {phone || "—"}
      </div>
      <div className="text-sm text-gray-700">
        <strong>Téléphone direct:</strong> {directPhone || "—"}
      </div>
      <div className="text-sm text-gray-700">
        <strong>Téléphone entreprise:</strong> {companyPhone || "—"}
      </div>
    </CardContent>
  </Card>
);

export default ContactCard;