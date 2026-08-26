"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Search, UserCheck, AlertCircle, CheckCircle } from "lucide-react";

export default function ManualCheckin() {
  const [correoBusqueda, setCorreoBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [resultadoBusqueda, setResultadoBusqueda] = useState<any | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);

  const buscarParticipante = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuscando(true);
    setMensaje(null);
    setResultadoBusqueda(null);

    const correoLimpio = correoBusqueda.trim().toLowerCase();

    try {
      const { data, error } = await supabase
        .from("base_datos_participantes")
        .select("*")
        .eq("correo", correoLimpio)
        .single();

      if (error || !data) {
        throw new Error("No se encontró ningún participante con ese correo.");
      }

      setResultadoBusqueda(data);
    } catch (error: any) {
      setMensaje({ tipo: "error", texto: error.message });
    } finally {
      setBuscando(false);
    }
  };

  const registrarIngreso = async () => {
    if (!resultadoBusqueda) return;
    
    setRegistrando(true);
    setMensaje(null);
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

    try {
      // Verificar si ya ingresó hoy
      const { data: checkinPrevio } = await supabase
        .from("check_ins")
        .select("id")
        .eq("correo_usuario", resultadoBusqueda.correo)
        .eq("dia_evento", todayStr)
        .single();

      if (checkinPrevio) {
        throw new Error("El participante ya tiene un registro de ingreso para el día de hoy.");
      }

      // Registrar
      const { error: errInsert } = await supabase
        .from("check_ins")
        .insert([{ 
          correo_usuario: resultadoBusqueda.correo, 
          dia_evento: todayStr, 
          estado: "ingresó" 
        }]);

      if (errInsert) throw errInsert;

      setMensaje({ tipo: "exito", texto: "Ingreso registrado correctamente." });
      setResultadoBusqueda(null);
      setCorreoBusqueda("");

    } catch (error: any) {
      setMensaje({ tipo: "error", texto: error.message });
    } finally {
      setRegistrando(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <form onSubmit={buscarParticipante} className="flex space-x-2 mb-6">
        <div className="relative grow">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="email"
            value={correoBusqueda}
            onChange={(e) => setCorreoBusqueda(e.target.value)}
            placeholder="Buscar por correo electrónico..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#311b42] outline-none text-gray-700"
            required
          />
        </div>
        <button
          type="submit"
          disabled={buscando}
          className="bg-[#311b42] hover:bg-purple-950 text-white font-bold px-6 py-3 rounded-xl transition-colors disabled:opacity-70 flex items-center"
        >
          {buscando ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {/* Alertas */}
      {mensaje && (
        <div className={`p-4 rounded-xl mb-6 flex items-center space-x-2 ${
          mensaje.tipo === "error" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
        }`}>
          {mensaje.tipo === "error" ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span className="font-bold text-sm">{mensaje.texto}</span>
        </div>
      )}

      {/* Tarjeta de Resultado */}
      {resultadoBusqueda && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0 text-center md:text-left">
            <h3 className="text-xl font-bold text-gray-800">
              {resultadoBusqueda.nombre} {resultadoBusqueda.apellido}
            </h3>
            <p className="text-gray-500 text-sm">{resultadoBusqueda.correo}</p>
            <div className="mt-2 inline-block bg-[#c81474] text-white text-xs font-bold px-3 py-1 rounded-full">
              {resultadoBusqueda.rol || "Participante"}
            </div>
          </div>
          
          <button
            onClick={registrarIngreso}
            disabled={registrando}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-md flex items-center space-x-2 disabled:opacity-70"
          >
            <UserCheck className="w-5 h-5" />
            <span>{registrando ? "Registrando..." : "Confirmar Ingreso"}</span>
          </button>
        </div>
      )}
    </div>
  );
}