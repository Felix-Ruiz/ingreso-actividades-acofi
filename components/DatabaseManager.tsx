"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Edit2, Save, X, RefreshCw, Search, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

type TabType = "participantes" | "ponencias" | "checkins";

export default function DatabaseManager({ moduloSeleccionado }: { moduloSeleccionado: string }) {
  const [activeTab, setActiveTab] = useState<TabType>("participantes");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const ELEMENTOS_POR_PAGINA = 100;

  const fetchData = async () => {
    setLoading(true);
    setSelectedIds(new Set());
    setPaginaActual(1);
    try {
      let table = "";
      let orderCol = "";
      let isAscending = true;

      if (activeTab === "participantes") {
        table = "base_datos_participantes";
        orderCol = "nombre";
        isAscending = true;
      } else if (activeTab === "ponencias") {
        table = "ponencias";
        orderCol = "fecha_programada";
        isAscending = false;
      } else if (activeTab === "checkins") {
        table = "check_ins";
        orderCol = "id";
        isAscending = false;
      }

      let query = supabase.from(table).select("*");
      
      if (activeTab !== "ponencias") {
        query = query.eq("modulo", moduloSeleccionado);
      }
      
      const { data: result, error } = await query
        .order(orderCol, { ascending: isAscending })
        .limit(5000);
        
      if (error) throw error;
      
      if (activeTab === "checkins" && result && result.length > 0) {
        const correos = result.map(r => r.correo_usuario);
        const { data: participantesData } = await supabase
          .from("base_datos_participantes")
          .select("correo, nombre, apellido")
          .in("correo", correos)
          .eq("modulo", moduloSeleccionado);
          
        const mapNombres: Record<string, string> = {};
        if (participantesData) {
          participantesData.forEach(p => {
            mapNombres[p.correo] = `${p.nombre || ""} ${p.apellido || ""}`.trim();
          });
        }
        
        const resultConNombres = result.map(r => ({
          ...r,
          nombre_completo: mapNombres[r.correo_usuario] || "-"
        }));
        
        setData(resultConNombres);
      } else {
        setData(result || []);
      }
      
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
  }, [activeTab, moduloSeleccionado]);

  useEffect(() => {
    setPaginaActual(1);
  }, [searchTerm]);

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
      fetchData(); 
    } catch (error) { 
      console.error("Error al guardar:", error); 
    }
  };

  // Filtrado general
  const allFilteredData = data.filter((item) => 
    JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Paginación de 100 en 100
  const totalPaginas = Math.ceil(allFilteredData.length / ELEMENTOS_POR_PAGINA);
  const paginatedData = allFilteredData.slice(
    (paginaActual - 1) * ELEMENTOS_POR_PAGINA, 
    paginaActual * ELEMENTOS_POR_PAGINA
  );

  const getIdKey = () => {
    if (activeTab === "participantes") return "correo";
    if (activeTab === "ponencias") return "codigo_ponencia";
    return "id";
  };

  const toggleSelectAll = () => {
    // Si la selección abarca toda la página actual, la limpiamos. Si no, seleccionamos toda la página.
    const currentPageIds = paginatedData.map(item => item[getIdKey()]);
    const areAllCurrentSelected = currentPageIds.every(id => selectedIds.has(id));

    if (areAllCurrentSelected && currentPageIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      const newSet = new Set<string>(selectedIds);
      currentPageIds.forEach(id => newSet.add(id));
      setSelectedIds(newSet);
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const eliminarSeleccionados = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente ${selectedIds.size} registro(s)?`)) return;

    setLoading(true);
    try {
      let table = "";
      if (activeTab === "participantes") table = "base_datos_participantes";
      if (activeTab === "ponencias") table = "ponencias";
      if (activeTab === "checkins") table = "check_ins";

      const idKey = getIdKey();
      const idsArray = Array.from(selectedIds);

      const { error } = await supabase
        .from(table)
        .delete()
        .in(idKey, idsArray);

      if (error) throw error;
      
      alert(`${selectedIds.size} registros eliminados con éxito.`);
      fetchData();
    } catch (error: any) {
      alert("Error al eliminar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
      <div className="absolute top-4 right-4 z-20 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
        Datos de: {moduloSeleccionado}
      </div>
      
      <div className="flex border-b border-gray-200 mt-10">
        <button 
          onClick={() => setActiveTab("participantes")} 
          className={`flex-1 py-4 text-sm font-bold transition-colors ${
            activeTab === "participantes" ? "bg-[#311b42] text-white" : "bg-gray-50 text-gray-900 hover:bg-gray-100"
          }`}
        >
          Participantes
        </button>
        
        {moduloSeleccionado === "Ponencias" && (
          <button 
            onClick={() => setActiveTab("ponencias")} 
            className={`flex-1 py-4 text-sm font-bold transition-colors ${
              activeTab === "ponencias" ? "bg-[#311b42] text-white" : "bg-gray-50 text-gray-900 hover:bg-gray-100"
            }`}
          >
            Ponencias
          </button>
        )}
        
        <button 
          onClick={() => setActiveTab("checkins")} 
          className={`flex-1 py-4 text-sm font-bold transition-colors ${
            activeTab === "checkins" ? "bg-[#311b42] text-white" : "bg-gray-50 text-gray-900 hover:bg-gray-100"
          }`}
        >
          Historial Check-ins
        </button>
      </div>

      <div className="p-4 bg-white border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input 
            type="text" 
            placeholder="Filtrar..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#c81474] text-gray-900 placeholder-gray-500" 
          />
        </div>
        
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          {selectedIds.size > 0 && (
            <button 
              onClick={eliminarSeleccionados}
              className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar ({selectedIds.size})</span>
            </button>
          )}
          <button 
            onClick={fetchData} 
            className="p-2 text-gray-600 hover:text-[#c81474] transition-colors bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-900 font-extrabold border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-10">
                <input 
                  type="checkbox" 
                  checked={paginatedData.length > 0 && paginatedData.every(item => selectedIds.has(item[getIdKey()]))}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded text-[#c81474] focus:ring-[#c81474]"
                />
              </th>
              {activeTab === "participantes" && (
                <>
                  <th className="px-4 py-3">Nombre Completo</th>
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
                  <th className="px-4 py-3">Fecha/Hora</th>
                  <th className="px-4 py-3">Estado</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedData.map((item, index) => {
              const rowId = item[getIdKey()];
              const isSelected = selectedIds.has(rowId);
              
              return (
              <tr key={index} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-pink-50' : ''}`}>
                <td className="px-4 py-3">
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={() => toggleSelectOne(rowId)}
                    className="w-4 h-4 rounded text-[#c81474] focus:ring-[#c81474]"
                  />
                </td>
                
                {/* Tabla de Participantes */}
                {activeTab === "participantes" && (
                  <>
                    <td className="px-4 py-3 font-bold text-gray-900">
                      {editingId === item.correo ? (
                        <div className="flex space-x-1">
                          <input 
                            type="text" 
                            value={editForm.nombre || ""} 
                            onChange={e => setEditForm({...editForm, nombre: e.target.value})} 
                            className="w-24 border border-gray-400 p-1 rounded text-gray-900" 
                          />
                          <input 
                            type="text" 
                            value={editForm.apellido || ""} 
                            onChange={e => setEditForm({...editForm, apellido: e.target.value})} 
                            className="w-24 border border-gray-400 p-1 rounded text-gray-900" 
                          />
                        </div>
                      ) : (
                        `${item.nombre || "-"} ${item.apellido || ""}`
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{item.correo}</td>
                    <td className="px-4 py-3">
                      {editingId === item.correo ? (
                        <select 
                          value={editForm.rol} 
                          onChange={e => setEditForm({...editForm, rol: e.target.value})} 
                          className="border border-gray-400 p-1 rounded text-gray-900"
                        >
                          <option value="Participante">Participante</option>
                          <option value="Moderador">Moderador</option>
                        </select>
                      ) : (
                        <span className="bg-pink-100 text-[#c81474] px-2 py-1 rounded-full text-xs font-bold">
                          {item.rol || "Participante"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {editingId === item.correo ? (
                        <input 
                          type="text" 
                          value={editForm.numero_documento || ""} 
                          onChange={e => setEditForm({...editForm, numero_documento: e.target.value})} 
                          className="w-full border border-gray-400 p-1 rounded text-gray-900" 
                        />
                      ) : (
                        item.numero_documento || "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === item.correo ? (
                        <div className="flex justify-end space-x-2">
                          <button onClick={() => guardarEdicion("correo", "base_datos_participantes")} className="text-green-600">
                            <Save className="w-5 h-5"/>
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-red-500">
                            <X className="w-5 h-5"/>
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => iniciarEdicion(item, "correo")} className="text-gray-500 hover:text-[#311b42]">
                          <Edit2 className="w-5 h-5"/>
                        </button>
                      )}
                    </td>
                  </>
                )}
                
                {/* Tabla de Ponencias */}
                {activeTab === "ponencias" && (
                  <>
                    <td className="px-4 py-3 font-bold text-gray-900">
                      {item.codigo_ponencia || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {editingId === item.codigo_ponencia ? (
                        <input 
                          type="text" 
                          value={editForm.nombre_ponencia || ""} 
                          onChange={e => setEditForm({...editForm, nombre_ponencia: e.target.value})} 
                          className="w-full border border-gray-400 p-1 rounded text-gray-900" 
                        />
                      ) : (
                        item.nombre_ponencia || "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                      {editingId === item.codigo_ponencia ? (
                        <input 
                          type="date" 
                          value={editForm.fecha_programada || ""} 
                          onChange={e => setEditForm({...editForm, fecha_programada: e.target.value})} 
                          className="border border-gray-400 p-1 rounded text-gray-900" 
                        />
                      ) : (
                        item.fecha_programada || "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === item.codigo_ponencia ? (
                        <div className="flex justify-end space-x-2">
                          <button onClick={() => guardarEdicion("codigo_ponencia", "ponencias")} className="text-green-600">
                            <Save className="w-5 h-5"/>
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-red-500">
                            <X className="w-5 h-5"/>
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => iniciarEdicion(item, "codigo_ponencia")} className="text-gray-500 hover:text-[#311b42]">
                          <Edit2 className="w-5 h-5"/>
                        </button>
                      )}
                    </td>
                  </>
                )}
                
                {/* Tabla de Check-ins */}
                {activeTab === "checkins" && (
                  <>
                    <td className="px-4 py-3 font-bold text-gray-900">
                      {item.nombre_completo}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {item.correo_usuario || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {item.created_at ? new Date(item.created_at).toLocaleString() : item.dia_evento}
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold capitalize">
                        {item.estado}
                      </span>
                    </td>
                  </>
                )}
              </tr>
            )})}
            
            {allFilteredData.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No se encontraron registros válidos para este módulo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CONTROLES DE PAGINACIÓN */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between p-4 bg-gray-50 border-t border-gray-200">
          <span className="text-sm text-gray-600 font-medium">
            Mostrando {((paginaActual - 1) * ELEMENTOS_POR_PAGINA) + 1} - {Math.min(paginaActual * ELEMENTOS_POR_PAGINA, allFilteredData.length)} de {allFilteredData.length} registros
          </span>
          <div className="flex space-x-2">
            <button 
              onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
              disabled={paginaActual === 1}
              className="p-2 rounded-lg bg-white border border-gray-300 text-gray-700 disabled:opacity-50 hover:bg-gray-100 transition-colors shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaActual === totalPaginas}
              className="p-2 rounded-lg bg-white border border-gray-300 text-gray-700 disabled:opacity-50 hover:bg-gray-100 transition-colors shadow-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}