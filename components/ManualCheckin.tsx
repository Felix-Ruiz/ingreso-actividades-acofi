"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Search, AlertCircle, CheckCircle } from "lucide-react";

export default function ManualCheckin({ moduloSeleccionado }: { moduloSeleccionado: string }) {
  const [terminoBusqueda, setTerminoBusqueda] = useState("");
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [checkinsHoy, setCheckinsHoy] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const { data: partData, error: errPart } = await supabase
        .from("base_datos_participantes")
        .select("*")
        .eq("modulo", moduloSeleccionado)
        .limit(500);
        
      if (errPart) throw errPart;

      const { data: checkinData, error: errCheck } = await supabase
        .from("check_ins")
        .select("correo_usuario")
        .eq("dia_evento", todayStr)
        .eq("modulo", moduloSeleccionado);
        
      if (errCheck) throw errCheck;

      setParticipantes(partData || []);
      setCheckinsHoy(new Set(checkinData?.map(c => c.correo_usuario) || []));
    } catch (error: any) {
      setMensaje({ tipo: "error", texto: error.message });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { 
    cargarDatos(); 
  }, [moduloSeleccionado]);

  const toggleCheckin = async (correo: string, isCheckedIn: boolean) => {
    setProcesandoId(correo);
    setMensaje(null);
    try {
      if (isCheckedIn) {
        const { error } = await supabase
          .from("check_ins")
          .delete()
          .eq("correo_usuario", correo)
          .eq("dia_evento", todayStr)
          .eq("modulo", moduloSeleccionado);
          
        if (error) throw error;
        
        const newSet = new Set(checkinsHoy);
        newSet.delete(correo);
        setCheckinsHoy(newSet);
      } else {
        const { error } = await supabase
          .from("check_ins")
          .insert([{ 
            correo_usuario: correo, 
            dia_evento: todayStr, 
            estado: "ingresó", 
            modulo: moduloSeleccionado 
          }]);
          
        if (error) throw error;
        
        const newSet = new Set(checkinsHoy);
        newSet.add(correo);
        setCheckinsHoy(newSet);
      }
    } catch (error: any) {
      setMensaje({ tipo: "error", texto: error.message });
    } finally {
      setProcesandoId(null);
    }
  };

  const participantesFiltrados = participantes.filter(p => 
    terminoBusqueda === "" || 
    `${p.nombre} ${p.apellido} ${p.correo} ${p.numero_documento}`.toLowerCase().includes(terminoBusqueda.toLowerCase())
  );

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative">
      <div className="absolute top-4 right-6 z-20 bg-[#311b42] text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
        Módulo: {moduloSeleccionado}
      </div>

      <div className="flex space-x-2 mb-6 mt-6">
        <div className="relative grow">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            <Search className="w-5 h-5" />
          </div>
          <input 
            type="text" 
            value={terminoBusqueda} 
            onChange={(e) => setTerminoBusqueda(e.target.value)} 
            placeholder="Buscar participante por nombre, documento o correo..." 
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#311b42] outline-none text-gray-900 bg-white placeholder-gray-500" 
          />
        </div>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-xl mb-6 flex items-center space-x-2 ${mensaje.tipo === "error" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
          {mensaje.tipo === "error" ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
          <span className="font-bold text-sm text-gray-900">{mensaje.texto}</span>
        </div>
      )}

      {cargando ? (
        <div className="p-8 text-center text-gray-500 font-bold animate-pulse">
          Cargando lista...
        </div>
      ) : (
        <div className="space-y-3 max-h-125 overflow-y-auto pr-2">
          {participantesFiltrados.map((p) => {
            const isCheckedIn = checkinsHoy.has(p.correo);
            return (
              <div 
                key={p.correo} 
                className="border rounded-xl p-4 flex justify-between items-center bg-white border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {p.nombre} {p.apellido}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {p.correo} {p.numero_documento ? `| Doc: ${p.numero_documento}` : ""}
                  </p>
                </div>
                
                {/* Toggle UI */}
                <button 
                  onClick={() => toggleCheckin(p.correo, isCheckedIn)} 
                  disabled={procesandoId === p.correo}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors disabled:opacity-50 focus:outline-none ${
                    isCheckedIn ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span 
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      isCheckedIn ? 'translate-x-7' : 'translate-x-1'
                    }`} 
                  />
                </button>
              </div>
            );
          })}
          {participantesFiltrados.length === 0 && (
            <p className="text-center text-gray-500 py-4">No se encontraron resultados.</p>
          )}
        </div>
      )}
    </div>
  );
}