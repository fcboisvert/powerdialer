import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Play, Pause } from 'lucide-react';

interface StatusDashboardProps {
  status: string;
  isCallActive: boolean;
}

const StatusDashboard = ({ status, isCallActive }: StatusDashboardProps) => {
  return (
    <Card className="rounded-2xl shadow-xl border-0 bg-white/90 backdrop-blur-xl overflow-hidden">
      <CardContent className="relative p-6">
        <Alert className="border-0 bg-gradient-to-r from-slate-900/5 to-slate-900/10 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {isCallActive ? (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
                <Play className="h-5 w-5 text-red-500" />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-emerald-500 rounded-full"></div>
                <Pause className="h-5 w-5 text-emerald-500" />
              </div>
            )}
            <AlertDescription className="text-slate-900 font-medium text-lg">
              {status}
            </AlertDescription>
          </div>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default StatusDashboard;