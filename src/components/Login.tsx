// src/components/Login.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import Logo from "/texion-logo.svg";

export default function Login() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-100 via-white to-zinc-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl ring-1 ring-zinc-100 p-8">
        {/* logo now 192 px wide → w-48 */}
        <img src="/texion-logo.svg" alt="texion" className="w-56 h-auto mx-auto mb-8" />

        <h2 className="text-center text-xl font-semibold">Connexion Agent</h2>
        <p className="text-center text-sm text-zinc-500 mb-6">
          Accédez à votre Power Dialer
        </p>

        <label className="block text-sm font-medium mb-1" htmlFor="user">
          Nom d'utilisateur
        </label>
        <input
          id="user"
          type="text"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="Entrez votre nom d'utilisateur"
          className="mb-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        />

        <label className="block text-sm font-medium mb-1" htmlFor="pass">
          Mot de passe
        </label>
        <input
          id="pass"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="Entrez votre mot de passe"
          className="mb-6 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        />

        <Button className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600">
          Se connecter
        </Button>

        <footer className="text-[11px] text-center text-zinc-400 mt-8">
          © 2024 TEXION. Tous droits réservés.
        </footer>
      </div>
    </div>
  );
}
