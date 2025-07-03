import React, { useState } from "react";

export default function Login({
  onLogin,
}: {
  onLogin: (username: string, password: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setError("");
    onLogin(username, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] via-[#fff] to-[#f3f4f6]">
      <div className="rounded-2xl shadow-2xl bg-white/95 px-8 py-12 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src="/texion-logo.svg" alt="Texion logo" className="h-10 mb-2" />
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Connexion Agent</h1>
          <p className="text-slate-500 mb-2">Accédez à votre Power Dialer</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nom d'utilisateur</label>
            <input
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base bg-slate-50 focus:border-[#E24218] focus:outline-none"
              placeholder="Entrez votre nom d'utilisateur"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mot de passe</label>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base bg-slate-50 focus:border-[#E24218] focus:outline-none"
              placeholder="Entrez votre mot de passe"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button
            type="submit"
            className="w-full bg-[#E24218] hover:bg-[#d03d15] text-white font-bold h-12 text-base rounded-xl shadow-lg transition-all"
          >
            Se connecter
          </button>
        </form>
        <footer className="mt-8 text-center text-slate-400 text-xs">
          © 2024 TEXION. Tous droits réservés.
        </footer>
      </div>
    </div>
  );
}