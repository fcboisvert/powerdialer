import { Card, CardContent } from "@/components/ui/card";

interface ActivityInfoProps {
  activityName?: string;
  dateDue?: string;
  status?: string;
}

const ActivityInfo = ({
  activityName,
  dateDue,
  status,
}: ActivityInfoProps) => (
  <Card className="mb-4">
    <CardContent className="grid gap-2 p-6">
      <div className="text-sm text-gray-700">
        <strong>Nom de l’activité:</strong> {activityName || "—"}
      </div>
      <div className="text-sm text-gray-700">
        <strong>Date Due:</strong> {dateDue || "—"}
      </div>
      <div className="text-sm text-gray-700">
        <strong>Statut:</strong> {status || "À Faire"}
      </div>
    </CardContent>
  </Card>
);

export default ActivityInfo;