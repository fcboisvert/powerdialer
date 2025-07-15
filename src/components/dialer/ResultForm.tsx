// C:\Users\Frédéric-CharlesBois\projects\Powerdialer\src\components\dialer\ResultForm.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

import type { CallResult } from "@/types/dialer";


interface ResultFormProps {
  callResult: CallResult;
  callNotes: string;
  meetingNotes: string;
  meetingDatetime: string;
  script: string;
  onCallResultChange: (value: CallResult) => void;
  onCallNotesChange: (value: string) => void;
  onMeetingNotesChange: (value: string) => void;
  onMeetingDatetimeChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const ResultForm = ({
  callResult,
  callNotes,
  meetingNotes,
  meetingDatetime,
  script,
  onCallResultChange,
  onCallNotesChange,
  onMeetingNotesChange,
  onMeetingDatetimeChange,
  onSubmit,
}: ResultFormProps) => {
  return (
    <Card className="mt-6 w-full rounded-xl border border-slate-200 bg-white/95 shadow-md">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800">Résultat de l'Activité</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="script" className="text-sm font-medium text-slate-700">Script d'appel</Label>
            <p id="script" className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-800 whitespace-pre-wrap">
              {script || '—'}
            </p>
          </div>

          <div>
            <Label htmlFor="notes-appel" className="text-sm font-medium text-slate-700">Notes (Appel)</Label>
            <Textarea
              id="notes-appel"
              value={callNotes}
              onChange={(e) => onCallNotesChange(e.target.value)}
              placeholder="Ajoutez vos notes ici..."
              className="mt-1 min-h-[80px] text-sm"
            />
          </div>

          <div>
            <Label htmlFor="resultat-appel" className="text-sm font-medium text-slate-700">Résultat (Appel)</Label>
            <Select value={callResult} onValueChange={onCallResultChange}>
              <SelectTrigger id="resultat-appel" className="mt-1 text-sm">
                <SelectValue placeholder="Sélectionnez un résultat" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="S_O">S_O</SelectItem>
                <SelectItem value="Rencontre_Expl._Planifiee">Rencontre Expl. Planifiée</SelectItem>
                <SelectItem value="Rencontre_Besoin_Planifiee">Rencontre Besoin Planifiée</SelectItem>
                <SelectItem value="Visite_Planifiee">Visite Planifiée</SelectItem>
                <SelectItem value="Offre_Planifiee">Offre Planifiée</SelectItem>
                <SelectItem value="Touchbase_Planifiee">Touchbase Planifiée</SelectItem>
                <SelectItem value="Relancer_Dans_X">Relancer Dans X</SelectItem>
                <SelectItem value="Info_Par_Courriel">Info Par Courriel</SelectItem>
                <SelectItem value="Boite_Vocale">Boîte Vocale</SelectItem>
                <SelectItem value="Pas_Joignable">Pas Joignable</SelectItem>
                <SelectItem value="Pas_Interesse">Pas Intéressé</SelectItem>
                <SelectItem value="Demande_Lien_Booking">Demande Lien Booking</SelectItem>
                <SelectItem value="Me_Refere_Interne">Me Réfère Interne</SelectItem>
                <SelectItem value="Me_Refere_Externe">Me Réfère Externe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="date-heure-rencontre" className="text-sm font-medium text-slate-700">Date / Heure (Rencontre)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "mt-1 w-full justify-start text-left font-normal text-sm",
                    !meetingDatetime && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {meetingDatetime ? format(new Date(meetingDatetime), "M/d/yyyy h:mma") : <span>Choisissez une date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Input
                  type="datetime-local"
                  value={meetingDatetime}
                  onChange={(e) => onMeetingDatetimeChange(e.target.value)}
                  className="border-0"
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button
            type="submit"
            className="w-full mt-4 bg-[#E24218] hover:bg-[#d03d15] text-white"
          >
            Sauvegarder & Continuer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ResultForm;
