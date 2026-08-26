"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { LogOut, QrCode, FileSpreadsheet, Activity, Download, Keyboard, Database, TableProperties, Settings, Radio } from "lucide-react";
import QRScanner from "../../components/QRScanner";
import ManualCheckin from "../../components/ManualCheckin";
import DataUploader from "../../components/DataUploader";
import DatabaseManager from "../../components/DatabaseManager";
import RealTimeDashboard from "../../components/RealTimeDashboard";

export default function StaffDashboard() {
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [usuarioActivo, setUsuarioActivo] = useState<string | null>(null);
  const [rolActivo, setRolActivo] = useState<"Master" | "Admin">("Admin");
  
  const [vistaActiva, setVistaActiva] = useState<"dashboard" | "scanner" | "manual" | "datos" | "registros" | "vivo" | "config">("dashboard");
  
  // Gestión de Módulos (Multi-Eventos)
  const [modulosList, setModulosList] = useState<string[]>(["Ponencias"]);
  const [moduloSeleccionado, setModuloSeleccionado] = useState<string>("Ponencias");
  const [nuevoModulo, setNuevoModulo] = useState("");

  const router = useRouter();

  useEffect(() => {
    const verificarSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.replace("/login");
        return;
      } 
      
      setUsuarioActivo(session.user.email || "Staff");

      // Verificar Rol
      const { data: rolData } = await supabase
        .from("staff_roles")
        .select("rol")
        .eq("correo", session.user.email)
        .single();
      
      if (rolData) setRolActivo(rolData.rol);

      // Cargar Módulos disponibles
      const { data: modulosData } = await supabase.from("modulos").select("nombre");
      if (modulosData && modulosData.length > 0) {
        setModulosList(modulosData.map(m => m.nombre));
      }

      setCargando(false);
    };

    verificarSesion();
  }, [router]);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const crearNuevoModulo = async () => {
    if (!nuevoModulo.trim()) return;
    try {
      const { error } = await supabase.from("modulos").insert([{ nombre: nuevoModulo.trim() }]);
      if (error) throw error;
      setModulosList([...modulosList, nuevoModulo.trim()]);
      setNuevoModulo("");
      alert("Módulo creado exitosamente");
    } catch (err: any) {
      alert("Error al crear módulo: " + err.message);
    }
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
          <span className="font-bold text-lg tracking-wide hidden sm:block">ACOFI {rolActivo}</span>
        </div>
        
        {/* Selector Global de Módulo Activo */}
        <div className="flex items-center bg-white/10 rounded-lg px-3 py-1">
          <span className="text-xs text-gray-300 mr-2 uppercase tracking-wide font-bold hidden md:block">Módulo Activo:</span>
          <select 
            value={moduloSeleccionado} 
            onChange={(e) => setModuloSeleccionado(e.target.value)}
            className="bg-transparent text-white font-bold outline-none cursor-pointer appearance-none"
          >
            {modulosList.map(mod => <option key={mod} value={mod} className="text-black">{mod}</option>)}
          </select>
        </div>

        <div className="flex items-center space-x-4">
          <span className="text-sm hidden lg:block text-gray-300 font-medium">{usuarioActivo}</span>
          <button onClick={cerrarSesion} className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Salir</span>
          </button>
        </div>
      </nav>

      {/* Contenido Principal */}
      <main className="max-w-6xl mx-auto p-4 sm:p-6 mt-4">
        
        {/* Navegación interna con scroll horizontal en móviles */}
        <div className="flex overflow-x-auto gap-2 mb-6 pb-2 hide-scrollbar">
          <button onClick={() => setVistaActiva("dashboard")} className={`whitespace-nowrap px-4 py-2 rounded-lg font-bold text-sm transition-colors ${vistaActiva === "dashboard" ? "bg-white text-[#311b42] shadow-sm border border-gray-200" : "text-gray-500 hover:bg-gray-200"}`}>
            Panel Principal
          </button>
          
          <button onClick={() => setVistaActiva("scanner")} className={`whitespace-nowrap px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center space-x-1 ${vistaActiva === "scanner" ? "bg-[#c81474] text-white shadow-md" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>
            <QrCode className="w-4 h-4" /> <span>Lector QR</span>
          </button>
          <button onClick={() => setVistaActiva("manual")} className={`whitespace-nowrap px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center space-x-1 ${vistaActiva === "manual" ? "bg-[#c81474] text-white shadow-md" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>
            <Keyboard className="w-4 h-4" /> <span>Registro Manual</span>
          </button>

          {rolActivo === "Master" && (
            <>
              <button onClick={() => setVistaActiva("vivo")} className={`whitespace-nowrap px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center space-x-1 ${vistaActiva === "vivo" ? "bg-emerald-600 text-white shadow-md" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>
                <Radio className="w-4 h-4" /> <span>En Vivo</span>
              </button>
              <button onClick={() => setVistaActiva("registros")} className={`whitespace-nowrap px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center space-x-1 ${vistaActiva === "registros" ? "bg-emerald-600 text-white shadow-md" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>
                <TableProperties className="w-4 h-4" /> <span>Registros</span>
              </button>
              <button onClick={() => setVistaActiva("datos")} className={`whitespace-nowrap px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center space-x-1 ${vistaActiva === "datos" ? "bg-blue-600 text-white shadow-md" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>
                <Database className="w-4 h-4" /> <span>Cargar Excels</span>
              </button>
              <button onClick={() => setVistaActiva("config")} className={`whitespace-nowrap px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center space-x-1 ${vistaActiva === "config" ? "bg-gray-800 text-white shadow-md" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>
                <Settings className="w-4 h-4" /> <span>Ajustes Master</span>
              </button>
            </>
          )}
        </div>

        {/* VISTAS */}
        
        {vistaActiva === "dashboard" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
              <div className="bg-pink-100 p-4 rounded-full mb-4">
                <QrCode className="w-10 h-10 text-[#c81474]" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Punto de Ingreso</h3>
              <p className="text-gray-500 text-sm mb-6">Operando actualmente en el módulo: <strong>{moduloSeleccionado}</strong></p>
              <div className="flex space-x-2 w-full">
                <button onClick={() => setVistaActiva("scanner")} className="flex-1 bg-[#c81474] hover:bg-pink-800 text-white font-bold py-3 px-2 rounded-xl transition-colors shadow-md text-sm">Cámara</button>
                <button onClick={() => setVistaActiva("manual")} className="flex-1 bg-white border-2 border-[#c81474] text-[#c81474] hover:bg-pink-50 font-bold py-3 px-2 rounded-xl transition-colors shadow-sm text-sm">Manual</button>
              </div>
            </div>

            {rolActivo === "Master" && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div className="bg-purple-100 p-4 rounded-full mb-4">
                  <FileSpreadsheet className="w-10 h-10 text-[#311b42]" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Consolidado Excel</h3>
                <p className="text-gray-500 text-sm mb-6">Descarga los resultados matemáticos de las evaluaciones.</p>
                <button onClick={descargarExcel} disabled={descargando} className="w-full bg-[#311b42] hover:bg-purple-950 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md disabled:opacity-70 flex items-center justify-center space-x-2">
                  {descargando ? <span className="animate-pulse">Generando reporte...</span> : <><Download className="w-5 h-5" /><span>Descargar .xlsx</span></>}
                </button>
              </div>
            )}
          </div>
        )}

        {vistaActiva === "scanner" && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800 mb-4">Lector de Ingreso</h2>
            <QRScanner moduloSeleccionado={moduloSeleccionado} />
          </div>
        )}

        {vistaActiva === "manual" && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800 mb-4">Búsqueda Manual</h2>
            <ManualCheckin moduloSeleccionado={moduloSeleccionado} />
          </div>
        )}

        {vistaActiva === "vivo" && rolActivo === "Master" && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800 mb-4">Dashboard en Vivo</h2>
            <p className="text-gray-600 mb-6 text-sm">Monitor de evaluaciones en tiempo real conectado a Supabase.</p>
            <RealTimeDashboard />
          </div>
        )}

        {vistaActiva === "registros" && rolActivo === "Master" && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800 mb-4">Gestor de Base de Datos</h2>
            <DatabaseManager />
          </div>
        )}

        {vistaActiva === "datos" && rolActivo === "Master" && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800 mb-4">Administración de Datos</h2>
            <DataUploader />
          </div>
        )}

        {vistaActiva === "config" && rolActivo === "Master" && (
          <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-extrabold text-gray-800 mb-4">Crear Nuevo Módulo (Evento)</h2>
            <p className="text-sm text-gray-500 mb-4">Agrega eventos como "Fiesta", "Almuerzo" para tener puntos de escaneo independientes.</p>
            <div className="flex space-x-2">
              <input type="text" value={nuevoModulo} onChange={(e) => setNuevoModulo(e.target.value)} placeholder="Nombre del evento..." className="flex-1 border p-2 rounded-xl outline-none focus:ring-2 focus:ring-[#311b42]" />
              <button onClick={crearNuevoModulo} className="bg-gray-800 text-white font-bold px-4 rounded-xl">Crear</button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}