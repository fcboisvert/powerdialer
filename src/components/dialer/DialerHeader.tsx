import { Button } from '@/components/ui/button';
import { LogOut, Hash } from 'lucide-react';

interface DialerHeaderProps {
  agent: string;
  currentIndex: number;
  totalRecords: number;
  onLogout: () => void;
}

const DialerHeader = ({ agent, currentIndex, totalRecords, onLogout }: DialerHeaderProps) => {
  return (
    <div className="flex items-center justify-between pb-6">
      <div className="flex items-center gap-6">
        <img src="/texion-logo.svg" alt="Texion logo" className="h-8" />
        <span className="text-xl font-bold text-slate-900">texion</span>
        <div className="h-8 w-px bg-slate-200"></div>
        <div className="flex items-center gap-4">
          <div className="h-3 w-3 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50"></div>
          <span className="text-sm font-medium text-slate-700">Power Dialer Actif</span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        {totalRecords > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 bg-slate-900/5 rounded-xl border border-slate-200/60">
            <Hash className="h-4 w-4 text-slate-600" />
            <span className="text-lg font-bold text-slate-900">
              {currentIndex + 1}
              <span className="text-slate-500 font-normal">/{totalRecords}</span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900 capitalize">{agent}</p>
            <p className="text-xs text-slate-500">Agent connecté</p>
          </div>
          <Button 
            onClick={onLogout}
            variant="outline"
            size="sm"
            className="border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DialerHeader;