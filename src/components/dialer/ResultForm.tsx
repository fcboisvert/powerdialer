// C:\Users\Frédéric-CharlesBois\projects\Powerdialer\src\components\dialer\ResultForm.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';

interface ResultFormProps {
  callResult: string;
  callNotes: string;
  meetingNotes: string;
  meetingDatetime: string;
  script: string;
  onCallResultChange: (value: string) => void;
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
  onSubmit
}: ResultFormProps) => {
  return (
    <Card className="rounded-2xl shadow-2xl border-0 bg-white/95 backdrop-blur-xl animate-in slide-in-from-bottom duration-500 overflow-hidden">
      <CardHeader className="relative">
        <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-3">
          <div className="h-8 w-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          Résultat de l'Activité
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label className="text-slate-700 font-semibold text-sm">Script d'appel</Label>
            <p className="text-zinc-800 whitespace-pre-line min-h-[120px] p-4 bg-slate-50 border border-slate-300 rounded-xl">{script || '—'}</p>
          </div>
          <div className="space-y-3">
            <Label className="text-slate-700 font-semibold text-sm">Résultat (Appel)</Label>
            <Select value={callResult} onValueChange={onCallResultChange} required>
              <SelectTrigger className="border-slate-300 focus:border-[#E24218] h-12 text-base bg-white/80 backdrop-blur-sm rounded-xl shadow-sm">
                <SelectValue placeholder="Sélectionnez un résultat" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl rounded-xl">
                <SelectItem value="S_O" className="rounded-lg">S_O</SelectItem>
                <SelectItem value="Rencontre_Expl._Planifiee" className="rounded-lg">Rencontre_Expl._Planifiee</SelectItem>
                <SelectItem value="Rencontre_Besoin_Planifiee" className="rounded-lg">Rencontre_Besoin_Planifiee</SelectItem>
                <SelectItem value="Visite_Planifiee" className="rounded-lg">Visite_Planifiee</SelectItem>
                <SelectItem value="Offre_Planifiee" className="rounded-lg">Offre_Planifiee</SelectItem>
                <SelectItem value="Touchbase_Planifiee" className="rounded-lg">Touchbase_Planifiee</SelectItem>
                <SelectItem value="Relancer_Dans_X" className="rounded-lg">Relancer_Dans_X</SelectItem>
                <SelectItem value="Info_Par_Courriel" className="rounded-lg">Info_Par_Courriel</SelectItem>
                <SelectItem value="Boite_Vocale" className="rounded-lg">Boite_Vocale</SelectItem>
                <SelectItem value="Pas_Joignable" className="rounded-lg">Pas_Joignable</SelectItem>
                <SelectItem value="Pas_Interesse" className="rounded-lg">Pas_Interesse</SelectItem>
                <SelectItem value="Demande_Lien_Booking" className="rounded-lg">Demande_Lien_Booking</SelectItem>
                <SelectItem value="Me_Refere_Interne" className="rounded-lg">Me_Refere_Interne</SelectItem>
                <SelectItem value="Me_Refere_Externe" className="rounded-lg">Me_Refere_Externe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Label className="text-slate-700 font-semibold text-sm">Notes (Appel)</Label>
            <Textarea
              value={callNotes}
              onChange={(e) => onCallNotesChange(e.target.value)}
              placeholder="Ajoutez vos notes (Appel) ici..."
              className="min-h-[120px] border-slate-300 focus:border-[#E24218] text-base resize-none bg-white/80 backdrop-blur-sm rounded-xl shadow-sm"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-slate-700 font-semibold text-sm">Notes Rencontres</Label>
            <Textarea
              value={meetingNotes}
              onChange={(e) => onMeetingNotesChange(e.target.value)}
              placeholder="Ajoutez vos notes rencontres ici..."
              className="min-h-[120px] border-slate-300 focus:border-[#E24218] text-base resize-none bg-white/80 backdrop-blur-sm rounded-xl shadow-sm"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-slate-700 font-semibold text-sm">Date / Heure (Rencontre)</Label>
            <input
              type="datetime-local"
              value={meetingDatetime}
              onChange={(e) => onMeetingDatetimeChange(e.target.value)}
              className="w-full h-12 px-4 border border-slate-300 rounded-xl focus:border-[#E24218] bg-white/80 backdrop-blur-sm shadow-sm text-base"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[#E24218] hover:bg-[#d03d15] text-white font-bold h-14 text-base rounded-xl shadow-2xl hover:shadow-[#E24218]/25 transition-all duration-300 transform hover:-translate-y-1"
          >
            💾 Sauvegarder & Continuer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ResultForm;