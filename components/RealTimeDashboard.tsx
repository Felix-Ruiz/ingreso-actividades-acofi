"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Activity, BarChart3, Clock, AlertCircle } from "lucide-react";

export default function RealTimeDashboard() {
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [estadisticas, setEstadisticas] = useState({ total: 0, promedioGral: 0 });
  const [error, setError] = useState<string | null>(null);

  const cargarDatosIniciales = async () => {
    try {
      setError(null);
      
      // 1. Cargar las evaluaciones SIN ordenamiento SQL para evitar colapso si falta la columna
      const { data: rawEvData, error: evError } = await supabase
        .from("evaluaciones")
        .select("*")
        .limit(1000); // Traemos una muestra segura para ordenar en memoria
      
      if (evError) throw evError;
      if (!rawEvData || rawEvData.length === 0) {
        setEvaluaciones([]);
        setEstadisticas({ total: 0, promedioGral: 0 });
        return;
      }

      // 2. Ordenar de forma segura en JavaScript (Si no hay created_at asume 0 y no colapsa)
      const evDataSorted = rawEvData.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      }).slice(0, 50); // Tomamos solo las 50 más recientes para la tabla visual

      // 3. Extraer correos y buscar sus nombres en base de datos de "Ponencias"
      const correos = evDataSorted.map(e => e.correo_usuario);
      
      const { data: partData, error: partError } = await supabase
        .from("base_datos_participantes")
        .select("correo, nombre, apellido, rol")
        .in("correo", correos)
        .eq("modulo", "Ponencias");
        
      if (partError) throw partError;

      // 4. Crear mapa de nombres para evitar errores de JOIN
      const mapParticipantes: Record<string, any> = {};
      if (partData) {
        partData.forEach(p => {
          mapParticipantes[p.correo] = p;
        });
      }

      // 5. Ensamblar los datos para mostrar
      const dataUnida = evDataSorted.map(ev => ({
        ...ev,
        participante: mapParticipantes[ev.correo_usuario] || { nombre: "Desconocido", apellido: "", rol: "N/A" }
      }));

      setEvaluaciones(dataUnida);
      
      // Estadísticas Globales (Calculadas sobre todo el set, no solo sobre los 50 visuales)
      calcularEstadisticas(rawEvData);
      
    } catch (err: any) {
      console.error("Error en dashboard:", err);
      setError(err.message);
    }
  };

  const calcularEstadisticas = (datos: any[]) => {
    if (datos.length === 0) return;
    const total = datos.length;
    const suma = datos.reduce((acc, curr) => acc + (Number(curr.calificacion) || 0), 0);
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
      
      {error && (
        <div className="bg-red-100 text-red-800 p-4 rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-bold text-sm">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-4">
          <div className="bg-emerald-100 p-4 rounded-full">
            <Activity className="w-8 h-8 text-emerald-600 animate-pulse" />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-wide">Evaluaciones Totales</p>
            <h3 className="text-3xl font-extrabold text-gray-900">{estadisticas.total}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-4">
          <div className="bg-blue-100 p-4 rounded-full">
            <BarChart3 className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-wide">Promedio Global</p>
            <h3 className="text-3xl font-extrabold text-gray-900">{estadisticas.promedioGral}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center space-x-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <h3 className="font-bold text-gray-900">Últimas 50 Evaluaciones (En Vivo)</h3>
        </div>
        <div className="overflow-x-auto max-h-100 overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-gray-900 font-extrabold sticky top-0 border-b border-gray-200 shadow-sm z-10">
              <tr>
                <th className="px-4 py-3">Ponencia</th>
                <th className="px-4 py-3">Evaluador</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Calificación</th>
                <th className="px-4 py-3">Fecha/Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {evaluaciones.map((ev, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-[#c81474]">{ev.codigo_ponencia}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {ev.participante.nombre} {ev.participante.apellido}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded-full font-bold">
                      {ev.participante.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">{ev.calificacion}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {ev.created_at ? new Date(ev.created_at).toLocaleString() : 'Reciente'}
                  </td>
                </tr>
              ))}
              {evaluaciones.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 font-medium">
                    Aún no hay evaluaciones registradas en el sistema.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}