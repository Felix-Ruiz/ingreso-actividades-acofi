"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { LogOut, QrCode, FileSpreadsheet, Activity } from "lucide-react";

export default function StaffDashboard() {
  const [cargando, setCargando] = useState(true);
  const [usuarioActivo, setUsuarioActivo] = useState<string | null>(null);
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
        <div className="flex items-center space-x-2">
          <Activity className="w-6 h-6 text-[#c81474]" />
          <span className="font-bold text-lg tracking-wide">ACOFI Control</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm hidden sm:block text-gray-300">{usuarioActivo}</span>
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
      <main className="max-w-4xl mx-auto p-6 mt-6">
        <h2 className="text-2xl font-extrabold text-gray-800 mb-6">Panel de Control</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tarjeta de Escáner (Próximo paso) */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
            <div className="bg-purple-100 p-4 rounded-full mb-4">
              <QrCode className="w-10 h-10 text-[#311b42]" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Escáner de Ingreso</h3>
            <p className="text-gray-500 text-sm mb-6">
              Registra la asistencia de los participantes leyendo su código QR en puerta.
            </p>
            <button className="w-full bg-[#c81474] hover:bg-pink-800 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md">
              Abrir Escáner QR
            </button>
          </div>

          {/* Tarjeta de Reportes (Futuro paso) */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center opacity-70 cursor-not-allowed">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <FileSpreadsheet className="w-10 h-10 text-gray-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Consolidado Excel</h3>
            <p className="text-gray-500 text-sm mb-6">
              Descarga los resultados de las evaluaciones con fórmulas y ponderaciones calculadas.
            </p>
            <button disabled className="w-full bg-gray-300 text-gray-500 font-bold py-3 px-4 rounded-xl cursor-not-allowed">
              Módulo en desarrollo
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}