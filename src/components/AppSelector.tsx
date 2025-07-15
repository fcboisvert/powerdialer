import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PhoneCall,
  BarChart3,
  Settings,
  AppWindow,
} from "lucide-react";

import Logo from "/texion-logo.svg";

const apps = [
  {
    name: "Power Dialer",
    icon: PhoneCall,
    route: "/powerdialer",
  },
  {
    name: "Rapports",
    icon: BarChart3,
    route: "/rapports",
  },
  {
    name: "Paramètres",
    icon: Settings,
    route: "/settings",
  },
];

export default function AppSelector() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#f8fafc] via-white to-[#f3f4f6]">
      {/* Header */}
      <header className="px-6 pt-10 text-center">
        <img
          src={Logo}
          alt="texion"
          className="w-[220px] h-auto mx-auto mb-6 object-contain"
        />
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
          Bienvenue au tableau de bord <span className="text-[#E24218]">texion.app</span>
        </h1>
        <p className="text-slate-500 mt-2">
          Accédez à vos outils en un clic.
        </p>
      </header>

      {/* App grid */}
      <main className="flex-1 px-6 py-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {apps.map((app) => (
          <Card
            key={app.name}
            onClick={() => navigate(app.route)}
            className="hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
          >
            <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
              <app.icon className="h-10 w-10 text-[#E24218]" />
              <span className="font-semibold text-lg text-slate-800">
                {app.name}
              </span>
            </CardContent>
          </Card>
        ))}
      </main>

      {/* Footer */}
      <footer className="text-center text-slate-400 text-sm pb-8">
        TEXION — Votre partenaire en excellence manufacturière
      </footer>
    </div>
  );
}
