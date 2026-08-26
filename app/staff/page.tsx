"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { LogOut, QrCode, FileSpreadsheet, Activity, Download, Keyboard, Database } from "lucide-react";
import QRScanner from "../../components/QRScanner";
import ManualCheckin from "../../components/ManualCheckin";
import DataUploader from "../../components/DataUploader";

export default function StaffDashboard() {
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [usuarioActivo, setUsuarioActivo] = useState<string | null>(null);
  const [vistaActiva, setVistaActiva] = useState<"dashboard" | "scanner" | "manual" | "datos">("dashboard");
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

  const descargarExcel = async () => {
    try {
      setDescargando(true);
      const response = await fetch("/api/exportar");
      
      if (!response.ok) throw new Error("Error al generar el archivo");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Evaluaciones_ACOFI.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert("Hubo un problema descargando el Excel. Por favor, intenta de nuevo.");
      console.error(error);
    } finally {
      setDescargando(false);
    }
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
        <div className="flex flex-wrap gap-2 mb-6">
          <button 
            onClick={() => setVistaActiva("dashboard")}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
              vistaActiva === "dashboard" ? "bg-white text-[#311b42] shadow-sm border border-gray-200" : "text-gray-500 hover:bg-gray-200"
            }`}
          >
            Panel Principal
          </button>
          <button 
            onClick={() => setVistaActiva("datos")}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center space-x-1 ${
              vistaActiva === "datos" ? "bg-blue-600 text-white shadow-md" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Carga de Datos</span>
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
          <button 
            onClick={() => setVistaActiva("manual")}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center space-x-1 ${
              vistaActiva === "manual" ? "bg-[#c81474] text-white shadow-md" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Registro Manual</span>
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
                Lee códigos QR o registra asistentes manualmente para habilitar sus evaluaciones.
              </p>
              <div className="flex space-x-2 w-full">
                <button 
                  onClick={() => setVistaActiva("scanner")}
                  className="flex-1 bg-[#c81474] hover:bg-pink-800 text-white font-bold py-3 px-2 rounded-xl transition-colors shadow-md text-sm"
                >
                  Cámara
                </button>
                <button 
                  onClick={() => setVistaActiva("manual")}
                  className="flex-1 bg-white border-2 border-[#c81474] text-[#c81474] hover:bg-pink-50 font-bold py-3 px-2 rounded-xl transition-colors shadow-sm text-sm"
                >
                  Manual
                </button>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
              <div className="bg-purple-100 p-4 rounded-full mb-4">
                <FileSpreadsheet className="w-10 h-10 text-[#311b42]" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Consolidado Excel</h3>
              <p className="text-gray-500 text-sm mb-6">
                Descarga los resultados con las fórmulas matemáticas y ponderaciones calculadas.
              </p>
              <button 
                onClick={descargarExcel}
                disabled={descargando}
                className="w-full bg-[#311b42] hover:bg-purple-950 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md disabled:opacity-70 flex items-center justify-center space-x-2"
              >
                {descargando ? (
                   <span className="animate-pulse">Generando reporte...</span>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Descargar .xlsx</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Vista: CARGA DE DATOS */}
        {vistaActiva === "datos" && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800 mb-4">Administración de Datos</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Sube tus archivos Excel para nutrir el sistema con los participantes inscritos y las ponencias programadas.
            </p>
            <DataUploader />
          </div>
        )}

        {/* Vista: SCANNER */}
        {vistaActiva === "scanner" && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800 mb-4">Lector de Ingreso</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Apunta la cámara al código QR de la escarapela del participante.
            </p>
            <QRScanner />
          </div>
        )}

        {/* Vista: MANUAL */}
        {vistaActiva === "manual" && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800 mb-4">Búsqueda Manual</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Busca a un participante por su correo electrónico registrado para confirmar su asistencia de forma manual.
            </p>
            <ManualCheckin />
          </div>
        )}

      </main>
    </div>
  );
}