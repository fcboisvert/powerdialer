import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ResultFormProps {
  callResult: string;
  callNotes: string;
  callStartTime: Date | null;
  onCallResultChange: (value: string) => void;
  onCallNotesChange: (value: string) => void;
  onMeetingNotesChange: (value: string) => void;
  onMeetingDatetimeChange: (value: string) => void;
  meetingNotes: string;
  meetingDatetime: string;
  onSubmit: (e: React.FormEvent) => void;
}

const ResultForm = ({
  callResult,
  callNotes,
  callStartTime,
  onCallResultChange,
  onCallNotesChange,
  meetingNotes,
  meetingDatetime,
  onMeetingNotesChange,
  onMeetingDatetimeChange,
  onSubmit,
}: ResultFormProps) => {
  let callDuration = '—';
  if (callStartTime) {
    const seconds = Math.floor((Date.now() - callStartTime.getTime()) / 1000);
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    callDuration = `${min}:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <Card className="rounded-2xl shadow-2xl border-0 bg-white/95 backdrop-blur-xl animate-in slide-in-from-bottom duration-500 overflow-hidden mt-6">
      <CardHeader className="relative">
        <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-3">
          <div className="h-8 w-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          Résultat de l'activité
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-slate-700 font-semibold text-sm">Résultat de l'appel</Label>
              <Select value={callResult} onValueChange={onCallResultChange} required>
                <SelectTrigger className="border-slate-300 focus:border-[#E24218] h-12 text-base bg-white/80 backdrop-blur-sm rounded-xl shadow-sm">
                  <SelectValue placeholder="Sélectionnez un résultat" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl rounded-xl">
                  {[
                    'S_O',
                    'Rencontre_Expl._Planifiee',
                    'Rencontre_Besoin_Planifiee',
                    'Visite_Planifiee',
                    'Offre_Planifiee',
                    'Touchbase_Planifiee',
                    'Relancer_Dans_X',
                    'Info_Par_Courriel',
                    'Boite_Vocale',
                    'Pas_Joignable',
                    'Pas_Interesse',
                    'Demande_Lien_Booking',
                    'Me_Refere_Interne',
                    'Me_Refere_Externe',
                  ].map((item) => (
                    <SelectItem key={item} value={item} className="rounded-lg">
                      {item.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="text-slate-700 font-semibold text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Durée d'appel
              </Label>
              <div className="h-12 px-4 bg-slate-50 border border-slate-300 rounded-xl flex items-center text-slate-600 font-mono">
                {callDuration}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-slate-700 font-semibold text-sm">Notes Rencontres</Label>
            <Textarea
              value={callNotes}
              onChange={(e) => onCallNotesChange(e.target.value)}
              placeholder="Ajoutez vos notes de l'appel ici..."
              className="min-h-[100px] border-slate-300 focus:border-[#E24218] text-base resize-none bg-white/80 backdrop-blur-sm rounded-xl shadow-sm"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-slate-700 font-semibold text-sm">Date / Heure (Rencontre)</Label>
            <Input
              type="datetime-local"
              value={meetingDatetime}
              onChange={(e) => onMeetingDatetimeChange(e.target.value)}
              className="h-12 border-slate-300 focus:border-[#E24218] text-base rounded-xl bg-white/80 backdrop-blur-sm shadow-sm"
            />
          </div>
          <Button type="submit" className="bg-[#E24218] hover:bg-[#d03d15] text-white font-bold text-sm px-6 py-2 rounded-xl shadow-md">
            ✅ Sauvegarder & Continuer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ResultForm;
