"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Search, UserCheck, AlertCircle, CheckCircle } from "lucide-react";

export default function ManualCheckin({ moduloSeleccionado }: { moduloSeleccionado: string }) {
  const [terminoBusqueda, setTerminoBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [registrandoId, setRegistrandoId] = useState<string | null>(null);
  const [resultados, setResultados] = useState<any[]>([]);
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);

  const buscarParticipante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminoBusqueda.trim()) return;
    
    setBuscando(true);
    setMensaje(null);
    setResultados([]);

    const termino = terminoBusqueda.trim();

    try {
      const { data, error } = await supabase
        .from("base_datos_participantes")
        .select("*")
        .or(`correo.ilike.%${termino}%,nombre.ilike.%${termino}%,apellido.ilike.%${termino}%,numero_documento.ilike.%${termino}%`)
        .limit(10);

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("No se encontró ningún participante.");

      setResultados(data);
    } catch (error: any) {
      setMensaje({ tipo: "error", texto: error.message });
    } finally {
      setBuscando(false);
    }
  };

  const registrarIngreso = async (participante: any) => {
    setRegistrandoId(participante.correo);
    setMensaje(null);
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

    try {
      const { data: checkinPrevio } = await supabase
        .from("check_ins")
        .select("id")
        .eq("correo_usuario", participante.correo)
        .eq("dia_evento", todayStr)
        .eq("modulo", moduloSeleccionado)
        .single();

      if (checkinPrevio) {
        throw new Error(`El participante ${participante.nombre} ya tiene ingreso para ${moduloSeleccionado} hoy.`);
      }

      const { error: errInsert } = await supabase
        .from("check_ins")
        .insert([{ 
          correo_usuario: participante.correo, 
          dia_evento: todayStr, 
          estado: "ingresó",
          modulo: moduloSeleccionado
        }]);

      if (errInsert) throw errInsert;

      setMensaje({ tipo: "exito", texto: `Ingreso a ${moduloSeleccionado} registrado para ${participante.nombre}.` });
      setResultados(resultados.filter(r => r.correo !== participante.correo));
      if (resultados.length === 1) setTerminoBusqueda("");

    } catch (error: any) {
      setMensaje({ tipo: "error", texto: error.message });
    } finally {
      setRegistrandoId(null);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative">
      <div className="absolute top-4 right-6 z-20 bg-[#311b42] text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
        Módulo: {moduloSeleccionado}
      </div>

      <form onSubmit={buscarParticipante} className="flex space-x-2 mb-6 mt-6">
        <div className="relative grow">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={terminoBusqueda}
            onChange={(e) => setTerminoBusqueda(e.target.value)}
            placeholder="Buscar por nombre, correo o documento..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#311b42] outline-none text-gray-700"
            required
          />
        </div>
        <button type="submit" disabled={buscando} className="bg-[#311b42] hover:bg-purple-950 text-white font-bold px-6 py-3 rounded-xl disabled:opacity-70">
          {buscando ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {mensaje && (
        <div className={`p-4 rounded-xl mb-6 flex items-center space-x-2 ${mensaje.tipo === "error" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {mensaje.tipo === "error" ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
          <span className="font-bold text-sm">{mensaje.texto}</span>
        </div>
      )}

      {resultados.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Resultados:</h4>
          {resultados.map((res) => (
            <div key={res.correo} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center hover:border-[#c81474]">
              <div className="mb-4 md:mb-0 text-center md:text-left w-full md:w-auto">
                <h3 className="text-lg font-bold text-gray-800">{res.nombre} {res.apellido}</h3>
                <p className="text-gray-500 text-sm">{res.correo} {res.numero_documento ? `| Doc: ${res.numero_documento}` : ""}</p>
              </div>
              <button onClick={() => registrarIngreso(res)} disabled={registrandoId === res.correo} className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl flex justify-center space-x-2 disabled:opacity-70">
                <UserCheck className="w-5 h-5" />
                <span>{registrandoId === res.correo ? "Cargando..." : "Dar Ingreso"}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}