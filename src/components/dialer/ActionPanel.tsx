import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, SkipForward } from 'lucide-react';

interface ActionPanelProps {
  isCallActive: boolean;
  currentIndex: number;
  totalRecords: number;
  showResultForm: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  onNextRecord: () => void;
}

const ActionPanel = ({
  isCallActive,
  currentIndex,
  totalRecords,
  showResultForm,
  onStartCall,
  onEndCall,
  onNextRecord
}: ActionPanelProps) => {
  return (
    <Card className="rounded-2xl shadow-xl border-0 bg-white/90 backdrop-blur-xl overflow-hidden">
      <CardContent className="relative p-8">
        <div className="flex flex-wrap gap-4 justify-center">
          <Button
            onClick={onStartCall}
            disabled={isCallActive || currentIndex < 0}
            className="bg-[#E24218] hover:bg-[#d03d15] text-white px-8 py-4 flex items-center gap-3 font-semibold text-base h-auto shadow-2xl hover:shadow-[#E24218]/25 transition-all duration-300 transform hover:-translate-y-1 disabled:transform-none disabled:shadow-lg border-0 rounded-xl"
          >
            <Phone className="h-5 w-5" />
            Appeler
          </Button>

          <Button
            onClick={onEndCall}
            disabled={!isCallActive}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-4 flex items-center gap-3 font-semibold text-base h-auto shadow-2xl hover:shadow-red-500/25 transition-all duration-300 transform hover:-translate-y-1 disabled:transform-none disabled:shadow-lg border-0 rounded-xl"
          >
            <PhoneOff className="h-5 w-5" />
            Raccrocher
          </Button>

          <Button
            onClick={onNextRecord}
            disabled={showResultForm || currentIndex >= totalRecords - 1}
            variant="outline"
            className="px-8 py-4 flex items-center gap-3 border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 font-semibold text-base h-auto shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 disabled:transform-none disabled:shadow-lg rounded-xl bg-white/80 backdrop-blur-sm"
          >
            <SkipForward className="h-5 w-5" />
            Suivant
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActionPanel;