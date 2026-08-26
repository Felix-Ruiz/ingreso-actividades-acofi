"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Edit2, Save, X, RefreshCw, Search } from "lucide-react";

type TabType = "participantes" | "ponencias" | "checkins";

export default function DatabaseManager() {
  const [activeTab, setActiveTab] = useState<TabType>("participantes");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Estados para Edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      let table = "";
      if (activeTab === "participantes") table = "base_datos_participantes";
      if (activeTab === "ponencias") table = "ponencias";
      if (activeTab === "checkins") table = "check_ins";

      const { data: result, error } = await supabase
        .from(table)
        .select(activeTab === "checkins" ? "*, base_datos_participantes(nombre, apellido)" : "*")
        .order(activeTab === "ponencias" ? "fecha_programada" : "created_at", { ascending: false })
        .limit(100); // Límite inicial de visualización

      if (error) throw error;
      setData(result || []);
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setSearchTerm("");
    setEditingId(null);
  }, [activeTab]);

  const iniciarEdicion = (item: any, idKey: string) => {
    setEditingId(item[idKey]);
    setEditForm({ ...item });
  };

  const guardarEdicion = async (idKey: string, table: string) => {
    try {
      const { error } = await supabase
        .from(table)
        .update(editForm)
        .eq(idKey, editingId);

      if (error) throw error;
      
      setEditingId(null);
      fetchData(); // Recargar tabla
    } catch (error) {
      alert("Error al guardar: " + (error as any).message);
    }
  };

  // Filtrado de búsqueda local
  const filteredData = data.filter((item) => 
    JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      
      {/* Pestañas internas */}
      <div className="flex border-b border-gray-200">
        <button onClick={() => setActiveTab("participantes")} className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === "participantes" ? "bg-[#311b42] text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
          Participantes
        </button>
        <button onClick={() => setActiveTab("ponencias")} className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === "ponencias" ? "bg-[#311b42] text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
          Ponencias
        </button>
        <button onClick={() => setActiveTab("checkins")} className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === "checkins" ? "bg-[#311b42] text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
          Historial Check-ins
        </button>
      </div>

      {/* Barra de herramientas */}
      <div className="p-4 bg-white border-b border-gray-100 flex justify-between items-center">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Filtrar en esta tabla..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c81474]"
          />
        </div>
        <button onClick={fetchData} className="ml-4 p-2 text-gray-500 hover:text-[#c81474] transition-colors" title="Actualizar">
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Contenedor de la Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
            <tr>
              {activeTab === "participantes" && (
                <>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Correo</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </>
              )}
              {activeTab === "ponencias" && (
                <>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </>
              )}
              {activeTab === "checkins" && (
                <>
                  <th className="px-4 py-3">Participante</th>
                  <th className="px-4 py-3">Correo</th>
                  <th className="px-4 py-3">Fecha Check-in</th>
                  <th className="px-4 py-3">Estado</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredData.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                
                {/* RENDERIZADO PARTICIPANTES */}
                {activeTab === "participantes" && (
                  <>
                    <td className="px-4 py-3 font-medium">
                      {editingId === item.correo ? (
                        <div className="flex space-x-1">
                          <input type="text" value={editForm.nombre} onChange={e => setEditForm({...editForm, nombre: e.target.value})} className="w-24 border p-1 rounded" />
                          <input type="text" value={editForm.apellido} onChange={e => setEditForm({...editForm, apellido: e.target.value})} className="w-24 border p-1 rounded" />
                        </div>
                      ) : (`${item.nombre} ${item.apellido}`)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.correo}</td>
                    <td className="px-4 py-3">
                      {editingId === item.correo ? (
                        <select value={editForm.rol} onChange={e => setEditForm({...editForm, rol: e.target.value})} className="border p-1 rounded">
                          <option value="Participante">Participante</option>
                          <option value="Moderador">Moderador</option>
                        </select>
                      ) : (
                        <span className="bg-pink-100 text-[#c81474] px-2 py-1 rounded-full text-xs font-bold">{item.rol}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {editingId === item.correo ? (
                        <input type="text" value={editForm.numero_documento || ""} onChange={e => setEditForm({...editForm, numero_documento: e.target.value})} className="w-full border p-1 rounded" />
                      ) : (item.numero_documento || "-")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === item.correo ? (
                        <div className="flex justify-end space-x-2">
                          <button onClick={() => guardarEdicion("correo", "base_datos_participantes")} className="text-green-600 hover:text-green-800"><Save className="w-5 h-5"/></button>
                          <button onClick={() => setEditingId(null)} className="text-red-500 hover:text-red-700"><X className="w-5 h-5"/></button>
                        </div>
                      ) : (
                        <button onClick={() => iniciarEdicion(item, "correo")} className="text-gray-400 hover:text-[#311b42]"><Edit2 className="w-5 h-5"/></button>
                      )}
                    </td>
                  </>
                )}

                {/* RENDERIZADO PONENCIAS */}
                {activeTab === "ponencias" && (
                  <>
                    <td className="px-4 py-3 font-medium text-gray-700">{item.codigo_ponencia}</td>
                    <td className="px-4 py-3">
                      {editingId === item.codigo_ponencia ? (
                        <input type="text" value={editForm.nombre_ponencia} onChange={e => setEditForm({...editForm, nombre_ponencia: e.target.value})} className="w-full border p-1 rounded" />
                      ) : (item.nombre_ponencia)}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === item.codigo_ponencia ? (
                        <input type="date" value={editForm.fecha_programada} onChange={e => setEditForm({...editForm, fecha_programada: e.target.value})} className="border p-1 rounded" />
                      ) : (item.fecha_programada)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === item.codigo_ponencia ? (
                        <div className="flex justify-end space-x-2">
                          <button onClick={() => guardarEdicion("codigo_ponencia", "ponencias")} className="text-green-600 hover:text-green-800"><Save className="w-5 h-5"/></button>
                          <button onClick={() => setEditingId(null)} className="text-red-500 hover:text-red-700"><X className="w-5 h-5"/></button>
                        </div>
                      ) : (
                        <button onClick={() => iniciarEdicion(item, "codigo_ponencia")} className="text-gray-400 hover:text-[#311b42]"><Edit2 className="w-5 h-5"/></button>
                      )}
                    </td>
                  </>
                )}

                {/* RENDERIZADO CHECK-INS (Solo vista) */}
                {activeTab === "checkins" && (
                  <>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {item.base_datos_participantes ? `${item.base_datos_participantes.nombre} ${item.base_datos_participantes.apellido}` : "Desconocido"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.correo_usuario}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{item.dia_evento}</td>
                    <td className="px-4 py-3">
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold capitalize">{item.estado}</span>
                    </td>
                  </>
                )}

              </tr>
            ))}
            
            {filteredData.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No se encontraron registros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}