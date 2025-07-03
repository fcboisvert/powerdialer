import { Label } from "@/components/ui/label";

interface CallerIdSelectorProps {
  callerId: string;
  setCallerId: (id: string) => void;
  agent: string;
  agentCallerIds: Record<string, string[]>;
}

const CallerIdSelector = ({
  callerId,
  setCallerId,
  agent,
  agentCallerIds,
}: CallerIdSelectorProps) => (
  <div className="mb-4">
    <Label htmlFor="callerIdSelect" className="mr-2">
      Numéro sortant :
    </Label>
    <select
      id="callerIdSelect"
      value={callerId}
      onChange={(e) => setCallerId(e.target.value)}
      className="border rounded px-3 py-1"
    >
      {(agentCallerIds[agent] || []).map((num) => (
        <option key={num} value={num}>
          {num}
        </option>
      ))}
    </select>
  </div>
);

export default CallerIdSelector;