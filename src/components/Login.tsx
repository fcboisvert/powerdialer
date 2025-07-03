
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { useNavigate } from 'react-router-dom';
import Logo from './ui/logo';

interface LoginProps {
  onLogin: (agent: string) => void;
}

const VALID_AGENTS = {
  'frederic': 'texion2024',
  'simon': 'simoncall'
};

const Login = ({ onLogin }: LoginProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = username.trim().toLowerCase();
    
    if (VALID_AGENTS[user as keyof typeof VALID_AGENTS] && 
        VALID_AGENTS[user as keyof typeof VALID_AGENTS] === password) {
      localStorage.setItem('texion_agent', user);
      onLogin(user);
      navigate(`/appeler/agent-${user}`);
    } else {
      setError('Nom d\'utilisateur ou mot de passe invalide.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 via-white to-gray-100 font-texion">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-texion-orange/5 via-transparent to-texion-orange/10 pointer-events-none" />
          
          <CardHeader className="text-center pb-8 pt-12 relative">
            <div className="mb-10">
              <Logo variant="full" size="lg" className="justify-center" />
            </div>
            <CardTitle className="text-2xl font-semibold text-texion-black tracking-tight">
              Connexion Agent
            </CardTitle>
            <p className="text-texion-gray text-sm mt-2">
              Accédez à votre Power Dialer
            </p>
          </CardHeader>
          
          <CardContent className="px-10 pb-10 relative">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-texion-black font-medium text-sm">
                  Nom d'utilisateur
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Entrez votre nom d'utilisateur"
                  className="border-gray-200 focus:border-texion-orange focus:ring-texion-orange/20 h-12 text-base transition-all duration-200 bg-white/50"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-texion-black font-medium text-sm">
                  Mot de passe
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Entrez votre mot de passe"
                  className="border-gray-200 focus:border-texion-orange focus:ring-texion-orange/20 h-12 text-base transition-all duration-200 bg-white/50"
                  required
                />
              </div>
              
              {error && (
                <Alert className="bg-red-50 border-red-200 animate-fade-in">
                  <AlertDescription className="text-red-700 text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-texion-orange hover:bg-texion-orange/90 text-white font-medium h-12 text-base transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Se connecter
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <div className="text-center mt-6">
          <p className="text-texion-gray text-xs">
            © 2024 TEXION. Tous droits réservés.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
