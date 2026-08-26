"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Activity, BarChart3, Clock } from "lucide-react";

export default function RealTimeDashboard() {
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [estadisticas, setEstadisticas] = useState({ total: 0, promedioGral: 0 });

  const cargarDatosIniciales = async () => {
    const { data } = await supabase
      .from("evaluaciones")
      .select("*, base_datos_participantes(nombre, apellido, rol)")
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (data) {
      setEvaluaciones(data);
      calcularEstadisticas(data);
    }
  };

  const calcularEstadisticas = (datos: any[]) => {
    if (datos.length === 0) return;
    const total = datos.length;
    const suma = datos.reduce((acc, curr) => acc + curr.calificacion, 0);
    setEstadisticas({ total, promedioGral: Math.round(suma / total) });
  };

  useEffect(() => {
    cargarDatosIniciales();

    // Suscripción en Tiempo Real
    const canal = supabase
      .channel("evaluaciones-db")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "evaluaciones" },
        (payload) => {
          // Cuando entra una nueva evaluación, recargamos para traer los joins de nombres
          cargarDatosIniciales();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-4">
          <div className="bg-emerald-100 p-4 rounded-full">
            <Activity className="w-8 h-8 text-emerald-600 animate-pulse" />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-bold">Evaluaciones Totales</p>
            <h3 className="text-3xl font-extrabold text-gray-800">{estadisticas.total}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-4">
          <div className="bg-blue-100 p-4 rounded-full">
            <BarChart3 className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-bold">Promedio Global (Bruto)</p>
            <h3 className="text-3xl font-extrabold text-gray-800">{estadisticas.promedioGral}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center space-x-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <h3 className="font-bold text-gray-700">Últimas 50 Evaluaciones (En Vivo)</h3>
        </div>
        <div className="overflow-x-auto max-h-100 overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-gray-600 font-bold sticky top-0 border-b border-gray-200 shadow-sm z-10">
              <tr>
                <th className="px-4 py-3">Ponencia</th>
                <th className="px-4 py-3">Evaluador</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Calificación</th>
                <th className="px-4 py-3">Fecha/Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {evaluaciones.map((ev, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-[#c81474]">{ev.codigo_ponencia}</td>
                  <td className="px-4 py-3">
                    {ev.base_datos_participantes ? `${ev.base_datos_participantes.nombre} ${ev.base_datos_participantes.apellido}` : ev.correo_usuario}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="bg-gray-200 px-2 py-1 rounded-full">{ev.base_datos_participantes?.rol || "N/A"}</span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold">{ev.calificacion}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(ev.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}