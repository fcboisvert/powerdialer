import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock } from 'lucide-react';

interface ResultFormProps {
  callResult: string;
  callNotes: string;
  callStartTime: Date | null;
  onCallResultChange: (value: string) => void;
  onCallNotesChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const ResultForm = ({
  callResult,
  callNotes,
  callStartTime,
  onCallResultChange,
  onCallNotesChange,
  onSubmit
}: ResultFormProps) => {
  // Optionally, you could compute call duration
  let callDuration = '—';
  if (callStartTime) {
    const seconds = Math.floor((Date.now() - callStartTime.getTime()) / 1000);
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    callDuration = `${min}:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <Card className="rounded-2xl shadow-2xl border-0 bg-white/95 backdrop-blur-xl animate-in slide-in-from-bottom duration-500 overflow-hidden">
      <CardHeader className="relative">
        <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-3">
          <div className="h-8 w-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          Résultat de l'appel
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
                  <SelectItem value="Connecté" className="rounded-lg">✅ Connecté – Humain</SelectItem>
                  <SelectItem value="Boite vocale" className="rounded-lg">📧 Boîte vocale</SelectItem>
                  <SelectItem value="Pas de réponse" className="rounded-lg">❌ Pas de réponse</SelectItem>
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
            <Label className="text-slate-700 font-semibold text-sm">Notes détaillées</Label>
            <Textarea
              value={callNotes}
              onChange={(e) => onCallNotesChange(e.target.value)}
              placeholder="Ajoutez vos notes détaillées ici..."
              className="min-h-[120px] border-slate-300 focus:border-[#E24218] text-base resize-none bg-white/80 backdrop-blur-sm rounded-xl shadow-sm"
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