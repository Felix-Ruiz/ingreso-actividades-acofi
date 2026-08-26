"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { LogOut, QrCode, FileSpreadsheet, Activity, Search } from "lucide-react";
import QRScanner from "../../components/QRScanner";

export default function StaffDashboard() {
  const [cargando, setCargando] = useState(true);
  const [usuarioActivo, setUsuarioActivo] = useState<string | null>(null);
  const [vistaActiva, setVistaActiva] = useState<"dashboard" | "scanner">("dashboard");
  const router = useRouter();

  useEffect(() => {
    const verificarSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.replace("/login");
      } else {
        setUsuarioActivo(session.user.email || "Staff");
        setCargando(false);
      }
    };

    verificarSesion();
  }, [router]);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#311b42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {/* Navbar Superior */}
      <nav className="bg-[#311b42] text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setVistaActiva("dashboard")}>
          <Activity className="w-6 h-6 text-[#c81474]" />
          <span className="font-bold text-lg tracking-wide hidden sm:block">ACOFI Staff</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm hidden md:block text-gray-300 font-medium">{usuarioActivo}</span>
          <button 
            onClick={cerrarSesion}
            className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Salir</span>
          </button>
        </div>
      </nav>

      {/* Contenido Principal */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6 mt-4">
        
        {/* Navegación interna */}
        <div className="flex space-x-2 mb-6">
          <button 
            onClick={() => setVistaActiva("dashboard")}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
              vistaActiva === "dashboard" ? "bg-white text-[#311b42] shadow-sm border border-gray-200" : "text-gray-500 hover:bg-gray-200"
            }`}
          >
            Panel Principal
          </button>
          <button 
            onClick={() => setVistaActiva("scanner")}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center space-x-1 ${
              vistaActiva === "scanner" ? "bg-[#c81474] text-white shadow-md" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Lector QR</span>
          </button>
        </div>

        {/* Vista: DASHBOARD */}
        {vistaActiva === "dashboard" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
              <div className="bg-pink-100 p-4 rounded-full mb-4">
                <QrCode className="w-10 h-10 text-[#c81474]" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Ingreso de Participantes</h3>
              <p className="text-gray-500 text-sm mb-6">
                Lee los códigos QR en las escarapelas para habilitar las evaluaciones diarias.
              </p>
              <button 
                onClick={() => setVistaActiva("scanner")}
                className="w-full bg-[#c81474] hover:bg-pink-800 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md"
              >
                Abrir Cámara
              </button>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center opacity-70 cursor-not-allowed">
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <FileSpreadsheet className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Consolidado Excel</h3>
              <p className="text-gray-500 text-sm mb-6">
                Descarga los resultados de las evaluaciones con fórmulas y ponderaciones (Módulo final).
              </p>
              <button disabled className="w-full bg-gray-300 text-gray-500 font-bold py-3 px-4 rounded-xl cursor-not-allowed">
                En desarrollo
              </button>
            </div>
          </div>
        )}

        {/* Vista: SCANNER */}
        {vistaActiva === "scanner" && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800 mb-4">Lector de Ingreso</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Apunta la cámara al código QR de la escarapela del participante. El sistema registrará el ingreso automáticamente.
            </p>
            <QRScanner />
          </div>
        )}

      </main>
    </div>
  );
}