"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Edit2, Save, X, RefreshCw, Search, Trash2, ChevronLeft, ChevronRight, User, FileText } from "lucide-react";

type TabType = "participantes" | "ponencias" | "checkins";

export default function DatabaseManager({ moduloSeleccionado }: { moduloSeleccionado: string }) {
  const [activeTab, setActiveTab] = useState<TabType>("participantes");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Estados del Modal de Edición Moderno
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

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
  }, [activeTab, moduloSeleccionado]);

  useEffect(() => {
    setPaginaActual(1);
  }, [searchTerm]);

  const iniciarEdicion = (item: any) => { 
    setEditForm({ ...item });
    setIsEditModalOpen(true);
  };

  const guardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (activeTab === "participantes") {
        // Enviar SOLAMENTE los campos permitidos para evitar errores de base de datos
        const { error } = await supabase
          .from("base_datos_participantes")
          .update({
            nombre: editForm.nombre,
            apellido: editForm.apellido,
            rol: editForm.rol,
            numero_documento: editForm.numero_documento
          })
          .eq("correo", editForm.correo)
          .eq("modulo", moduloSeleccionado);
          
        if (error) throw error;
      } else if (activeTab === "ponencias") {
        const { error } = await supabase
          .from("ponencias")
          .update({
            nombre_ponencia: editForm.nombre_ponencia,
            fecha_programada: editForm.fecha_programada
          })
          .eq("codigo_ponencia", editForm.codigo_ponencia);
          
        if (error) throw error;
      }
      
      setIsEditModalOpen(false);
      fetchData(); 
    } catch (error: any) { 
      console.error("Error al guardar:", error);
      alert("Error guardando los cambios: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const allFilteredData = data.filter((item) => 
    JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
  );
  
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
      
      setSelectedIds(new Set());
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

      <div className="overflow-x-auto min-h-75">
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
                      {item.nombre || "-"} {item.apellido || ""}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{item.correo}</td>
                    <td className="px-4 py-3">
                      <span className="bg-pink-100 text-[#c81474] px-2 py-1 rounded-full text-xs font-bold">
                        {item.rol || "Participante"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {item.numero_documento || "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => iniciarEdicion(item)} 
                        className="text-gray-500 hover:text-[#c81474] transition-colors p-2 bg-gray-100 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4"/>
                      </button>
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
                      {item.nombre_ponencia || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                      {item.fecha_programada || "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => iniciarEdicion(item)} 
                        className="text-gray-500 hover:text-[#c81474] transition-colors p-2 bg-gray-100 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4"/>
                      </button>
                    </td>
                  </>
                )}
                
                {/* Tabla de Check-ins (No editable directamente) */}
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
                  No se encontraron registros válidos.
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

      {/* MODAL DE EDICIÓN MODERNO */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center bg-[#311b42] p-5 text-white">
              <h3 className="font-extrabold text-lg flex items-center space-x-2">
                {activeTab === "participantes" ? <User className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                <span>Editar {activeTab === "participantes" ? "Participante" : "Ponencia"}</span>
              </h3>
              <button 
                onClick={() => setIsEditModalOpen(false)} 
                className="text-gray-300 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={guardarEdicion} className="p-6 space-y-4">
              
              {activeTab === "participantes" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Nombre</label>
                      <input 
                        type="text" 
                        required 
                        value={editForm.nombre || ""} 
                        onChange={e => setEditForm({...editForm, nombre: e.target.value})} 
                        className="w-full border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#c81474] text-gray-900 bg-gray-50" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Apellido</label>
                      <input 
                        type="text" 
                        required 
                        value={editForm.apellido || ""} 
                        onChange={e => setEditForm({...editForm, apellido: e.target.value})} 
                        className="w-full border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#c81474] text-gray-900 bg-gray-50" 
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Correo (Identificador)</label>
                    <input 
                      type="email" 
                      disabled 
                      value={editForm.correo} 
                      className="w-full border border-gray-200 p-3 rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Documento</label>
                      <input 
                        type="text" 
                        value={editForm.numero_documento || ""} 
                        onChange={e => setEditForm({...editForm, numero_documento: e.target.value})} 
                        className="w-full border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#c81474] text-gray-900 bg-gray-50" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Rol</label>
                      <select 
                        value={editForm.rol || "Participante"} 
                        onChange={e => setEditForm({...editForm, rol: e.target.value})} 
                        className="w-full border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#c81474] text-gray-900 bg-gray-50"
                      >
                        <option value="Participante">Participante</option>
                        <option value="Moderador">Moderador</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "ponencias" && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Código (Identificador)</label>
                    <input 
                      type="text" 
                      disabled 
                      value={editForm.codigo_ponencia} 
                      className="w-full border border-gray-200 p-3 rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed uppercase" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Título de la Ponencia</label>
                    <textarea 
                      required 
                      rows={3}
                      value={editForm.nombre_ponencia || ""} 
                      onChange={e => setEditForm({...editForm, nombre_ponencia: e.target.value})} 
                      className="w-full border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#c81474] text-gray-900 bg-gray-50 resize-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Fecha Programada</label>
                    <input 
                      type="date" 
                      required 
                      value={editForm.fecha_programada || ""} 
                      onChange={e => setEditForm({...editForm, fecha_programada: e.target.value})} 
                      className="w-full border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#c81474] text-gray-900 bg-gray-50" 
                    />
                  </div>
                </>
              )}

              <div className="flex space-x-3 pt-4 border-t border-gray-100 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex-1 bg-[#c81474] hover:bg-pink-800 text-white font-bold py-3 rounded-xl transition-colors shadow-md disabled:opacity-70"
                >
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}