import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const LoadingScreen = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] via-[#fff] to-[#f3f4f6]">
      <Card className="w-full max-w-md rounded-2xl shadow-2xl border-0 bg-white/95 backdrop-blur-xl">
        <CardContent className="p-12 text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#E24218]/20 to-blue-500/20 rounded-full blur-xl"></div>
            <Loader2 className="relative h-12 w-12 animate-spin mx-auto mb-6 text-[#E24218]" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Initialisation</h3>
          <p className="text-slate-600">Connexion à votre file d'appels...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoadingScreen;