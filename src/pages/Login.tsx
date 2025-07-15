import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import Logo from "/texion-logo.svg";

export default function Login() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !pass) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setError("");
    localStorage.setItem("texion_agent", user.trim());
    navigate("/select");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] via-[#fff] to-[#f3f4f6] py-12">
      <div className="rounded-2xl shadow-2xl bg-white/95 px-8 py-12 w-full max-w-lg flex flex-col items-center">
        {/* Logo crop */}
        <div className="h-[80px] overflow-hidden mb-6">
          <img
            src={Logo}
            alt="texion"
            className="w-[260px] object-contain mx-auto"
          />
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mb-1">
          Connexion au portail texion.app
        </h2>
        <p className="text-slate-500 mb-6 text-center">
          Accédez à vos outils d'excellence manufacturière.
        </p>

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1" htmlFor="user">
              Nom d'utilisateur
            </label>
            <input
              id="user"
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="Entrez votre nom d'utilisateur"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base bg-slate-50 focus:border-[#E24218] focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1" htmlFor="pass">
              Mot de passe
            </label>
            <input
              id="pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Entrez votre mot de passe"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base bg-slate-50 focus:border-[#E24218] focus:outline-none"
              required
            />
          </div>

          {error && <div className="text-red-600 text-sm text-center">{error}</div>}

          <Button
            type="submit"
            className="w-full bg-[#E24218] hover:bg-[#d03d15] text-white font-bold h-12 text-base rounded-xl shadow-lg transition-all mt-2"
          >
            Se connecter
          </Button>
        </form>

        <footer className="mt-8 text-center text-slate-400 text-xs">
          © 2025 TEXION. Tous droits réservés.
        </footer>
      </div>
    </div>
  );
}