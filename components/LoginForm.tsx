"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { Lock, Mail } from "lucide-react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw new Error("Credenciales incorrectas. Verifique su acceso.");

      // Si es exitoso, redirigimos al dashboard del staff
      router.push("/staff");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 flex flex-col items-center pt-24 px-4 w-full max-w-md mx-auto">
      {/* Título Administrativo */}
      <div className="bg-white p-4 rounded-full shadow-md mb-6">
        <Lock className="w-12 h-12 text-[#311b42]" />
      </div>
      <h1 className="text-3xl font-extrabold text-[#311b42] mb-2 text-center">
        Acceso Staff
      </h1>
      <p className="text-gray-600 mb-8 text-center font-medium">
        Sistema de Ingreso a Actividades ACOFI
      </p>

      {/* Alerta de Error */}
      {error && (
        <div className="w-full p-4 mb-4 rounded-xl shadow-sm text-sm font-semibold text-center bg-red-100 text-red-700">
          {error}
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleLogin} className="w-full space-y-4">
        <div className="relative">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            <Mail className="w-5 h-5" />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico"
            disabled={loading}
            className="w-full pl-12 pr-5 py-4 rounded-xl shadow-md border-0 focus:ring-2 focus:ring-[#311b42] outline-none text-gray-700 bg-white disabled:opacity-70"
            required
          />
        </div>

        <div className="relative">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            <Lock className="w-5 h-5" />
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            disabled={loading}
            className="w-full pl-12 pr-5 py-4 rounded-xl shadow-md border-0 focus:ring-2 focus:ring-[#311b42] outline-none text-gray-700 bg-white disabled:opacity-70"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#311b42] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-purple-950 transition-colors mt-4 disabled:opacity-70 flex justify-center items-center"
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            "Iniciar Sesión"
          )}
        </button>
      </form>
    </div>
  );
}