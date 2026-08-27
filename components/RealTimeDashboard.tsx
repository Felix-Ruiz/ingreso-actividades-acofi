"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Activity, Clock, AlertCircle, Trash2, Edit2, Save, X, CheckCircle, XCircle } from "lucide-react";

export default function RealTimeDashboard() {
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [estadisticas, setEstadisticas] = useState({ total: 0 });
  const [error, setError] = useState<string | null>(null);
  
  // Estados para Edición y Eliminación
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNota, setEditNota] = useState<string>("");
  const [procesando, setProcesando] = useState<string | null>(null);

  // Estados para UI Premium (Toast y Modal)
  const [toast, setToast] = useState<{ tipo: "exito" | "error"; mensaje: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ id: string; titulo: string; mensaje: string } | null>(null);

  const mostrarToast = (tipo: "exito" | "error", mensaje: string) => {
    setToast({ tipo, mensaje });
    setTimeout(() => setToast(null), 4000);
  };

  const cargarDatosIniciales = async () => {
    try {
      setError(null);
      
      const { data: rawEvData, error: evError } = await supabase
        .from("evaluaciones")
        .select("*")
        .limit(2000); 
      
      if (evError) throw evError;
      if (!rawEvData || rawEvData.length === 0) {
        setEvaluaciones([]);
        setEstadisticas({ total: 0 });
        return;
      }

      const evDataSorted = rawEvData.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      }).slice(0, 50);

      const correos = evDataSorted.map(e => e.correo_usuario);
      
      const { data: partData, error: partError } = await supabase
        .from("base_datos_participantes")
        .select("correo, nombre, apellido, rol")
        .in("correo", correos)
        .eq("modulo", "Ponencias");
        
      if (partError) throw partError;

      const mapParticipantes: Record<string, any> = {};
      if (partData) {
        partData.forEach(p => {
          mapParticipantes[p.correo] = p;
        });
      }

      const dataUnida = evDataSorted.map(ev => ({
        ...ev,
        participante: mapParticipantes[ev.correo_usuario] || { nombre: "Desconocido", apellido: "", rol: "Participante" }
      }));

      setEvaluaciones(dataUnida);
      setEstadisticas({ total: rawEvData.length });
      
    } catch (err: any) {
      console.error("Error en dashboard:", err);
      setError("Error cargando los datos en vivo. " + err.message);
    }
  };

  useEffect(() => {
    cargarDatosIniciales();

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

  const iniciarEdicion = (ev: any) => {
    setEditingId(ev.id);
    setEditNota(String(ev.calificacion));
  };

  const guardarEdicion = async (id: string) => {
    setProcesando(id);
    try {
      const { error } = await supabase
        .from("evaluaciones")
        .update({ calificacion: Number(editNota) })
        .eq("id", id);
        
      if (error) throw error;
      
      setEditingId(null);
      mostrarToast("exito", "Calificación actualizada correctamente.");
      cargarDatosIniciales();
    } catch (err: any) {
      mostrarToast("error", "Error al editar: " + err.message);
    } finally {
      setProcesando(null);
    }
  };

  const confirmarYeliminar = async () => {
    if (!confirmModal) return;
    const id = confirmModal.id;
    setProcesando(id);
    setConfirmModal(null);

    try {
      const { error } = await supabase
        .from("evaluaciones")
        .delete()
        .eq("id", id);
        
      if (error) throw error;
      
      mostrarToast("exito", "Calificación eliminada correctamente.");
      cargarDatosIniciales();
    } catch (err: any) {
      mostrarToast("error", "Error al eliminar: " + err.message);
    } finally {
      setProcesando(null);
    }
  };

  return (
    <div className="w-full space-y-6 relative">
      
      {/* Notificación Toast Premium */}
      {toast && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-70 px-6 py-3 rounded-full shadow-2xl flex items-center space-x-2 font-bold text-sm animate-in fade-in slide-in-from-top-5 ${toast.tipo === "exito" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.tipo === "exito" ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span>{toast.mensaje}</span>
        </div>
      )}

      {/* Modal de Confirmación Nativo */}
      {confirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-6 mx-auto">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-extrabold text-center text-gray-900 mb-2">{confirmModal.titulo}</h3>
              <p className="text-center text-gray-600 text-sm mb-8 font-medium leading-relaxed">{confirmModal.mensaje}</p>
              <div className="flex space-x-3">
                <button 
                  onClick={() => setConfirmModal(null)} 
                  className="flex-1 bg-white border-2 border-gray-200 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmarYeliminar} 
                  className="flex-1 bg-red-600 text-white font-bold py-3.5 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-800 p-4 rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-bold text-sm">{error}</span>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-4 max-w-md">
        <div className="bg-emerald-100 p-4 rounded-full">
          <Activity className="w-8 h-8 text-emerald-600 animate-pulse" />
        </div>
        <div>
          <p className="text-gray-500 text-sm font-bold uppercase tracking-wide">Evaluaciones Totales</p>
          <h3 className="text-3xl font-extrabold text-gray-900">{estadisticas.total}</h3>
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
                <th className="px-4 py-3 text-right">Acciones</th>
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
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">
                    {editingId === ev.id ? (
                      <input 
                        type="number" 
                        min="0" 
                        max="1000" 
                        value={editNota} 
                        onChange={(e) => setEditNota(e.target.value)} 
                        className="w-20 border border-gray-400 p-1.5 rounded text-gray-900 bg-white shadow-sm focus:ring-2 focus:ring-[#c81474] outline-none" 
                      />
                    ) : (
                      ev.calificacion
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {ev.created_at ? new Date(ev.created_at).toLocaleString() : 'Reciente'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === ev.id ? (
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => guardarEdicion(ev.id)} 
                          disabled={procesando === ev.id}
                          className="text-green-600 hover:text-green-800 transition-colors p-1.5 bg-green-50 hover:bg-green-100 rounded-lg shadow-sm"
                          title="Guardar"
                        >
                          <Save className="w-5 h-5"/>
                        </button>
                        <button 
                          onClick={() => setEditingId(null)} 
                          disabled={procesando === ev.id}
                          className="text-red-500 hover:text-red-700 transition-colors p-1.5 bg-red-50 hover:bg-red-100 rounded-lg shadow-sm"
                          title="Cancelar"
                        >
                          <X className="w-5 h-5"/>
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => iniciarEdicion(ev)} 
                          disabled={procesando === ev.id}
                          className="text-gray-500 hover:text-[#c81474] transition-colors p-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg shadow-sm"
                          title="Editar calificación"
                        >
                          <Edit2 className="w-4 h-4"/>
                        </button>
                        <button 
                          onClick={() => setConfirmModal({
                            id: ev.id,
                            titulo: "Eliminar Calificación",
                            mensaje: `¿Eliminar permanentemente la evaluación de ${ev.participante.nombre} para la ponencia ${ev.codigo_ponencia}?`
                          })} 
                          disabled={procesando === ev.id}
                          className="text-gray-500 hover:text-red-600 transition-colors p-1.5 bg-white border border-gray-200 hover:bg-red-50 rounded-lg shadow-sm"
                          title="Eliminar calificación"
                        >
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {evaluaciones.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 font-medium">
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