"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Search, AlertCircle, CheckCircle, UserPlus, X, ChevronLeft, ChevronRight } from "lucide-react";

export default function ManualCheckin({ moduloSeleccionado }: { moduloSeleccionado: string }) {
  const [terminoBusqueda, setTerminoBusqueda] = useState("");
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [checkinsHoy, setCheckinsHoy] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const ELEMENTOS_POR_PAGINA = 100;

  // Formulario de Registro en Sitio
  const [mostrarModal, setMostrarModal] = useState(false);
  const [nuevoForm, setNuevoForm] = useState({
    nombre: "",
    apellido: "",
    correo: "",
    numero_documento: "",
    rol: "Participante"
  });
  const [registrandoNuevo, setRegistrandoNuevo] = useState(false);

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const { data: partData, error: errPart } = await supabase
        .from("base_datos_participantes")
        .select("*")
        .eq("modulo", moduloSeleccionado)
        .limit(5000);
        
      if (errPart) throw errPart;

      const { data: checkinData, error: errCheck } = await supabase
        .from("check_ins")
        .select("correo_usuario")
        .eq("dia_evento", todayStr)
        .eq("modulo", moduloSeleccionado)
        .limit(5000);
        
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
    setPaginaActual(1);
  }, [moduloSeleccionado]);

  useEffect(() => {
    setPaginaActual(1);
  }, [terminoBusqueda]);

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

  const registrarEnSitio = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistrandoNuevo(true);
    setMensaje(null);

    const correoLimpio = nuevoForm.correo.trim().toLowerCase();

    try {
      // 1. Insertar en participantes
      const { error: errPart } = await supabase
        .from("base_datos_participantes")
        .upsert([{
          correo: correoLimpio,
          nombre: nuevoForm.nombre.trim(),
          apellido: nuevoForm.apellido.trim(),
          numero_documento: nuevoForm.numero_documento.trim() || null,
          rol: nuevoForm.rol,
          modulo: moduloSeleccionado
        }]);

      if (errPart) throw errPart;

      // 2. Dar ingreso automático (Check-in) para hoy
      const { error: errCheck } = await supabase
        .from("check_ins")
        .insert([{ 
          correo_usuario: correoLimpio, 
          dia_evento: todayStr, 
          estado: "ingresó", 
          modulo: moduloSeleccionado 
        }]);

      if (errCheck) throw errCheck;

      // 3. Actualizar estado local para que aparezca inmediatamente
      setParticipantes(prev => [{
        correo: correoLimpio,
        nombre: nuevoForm.nombre.trim(),
        apellido: nuevoForm.apellido.trim(),
        numero_documento: nuevoForm.numero_documento.trim() || null,
        rol: nuevoForm.rol,
        modulo: moduloSeleccionado
      }, ...prev]);

      const newSet = new Set(checkinsHoy);
      newSet.add(correoLimpio);
      setCheckinsHoy(newSet);

      setMensaje({ tipo: "exito", texto: `Participante registrado e ingresado con éxito.` });
      setMostrarModal(false);
      setNuevoForm({ nombre: "", apellido: "", correo: "", numero_documento: "", rol: "Participante" });
      setTerminoBusqueda(correoLimpio); // Autofiltrar para mostrarlo
      
    } catch (error: any) {
      setMensaje({ tipo: "error", texto: "Error al registrar: " + error.message });
    } finally {
      setRegistrandoNuevo(false);
    }
  };

  // Filtrado
  const todosFiltrados = participantes.filter(p => 
    terminoBusqueda === "" || 
    `${p.nombre} ${p.apellido} ${p.correo} ${p.numero_documento}`.toLowerCase().includes(terminoBusqueda.toLowerCase())
  );

  // Paginación
  const totalPaginas = Math.ceil(todosFiltrados.length / ELEMENTOS_POR_PAGINA);
  const participantesPaginados = todosFiltrados.slice(
    (paginaActual - 1) * ELEMENTOS_POR_PAGINA, 
    paginaActual * ELEMENTOS_POR_PAGINA
  );

  // Cálculos de Estadísticas
  const totalInscritos = participantes.length;
  const totalIngresados = checkinsHoy.size;
  const totalFaltantes = totalInscritos > 0 ? (totalInscritos - totalIngresados) : 0;

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative">
      <div className="absolute top-4 right-6 z-20 bg-[#311b42] text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
        Módulo: {moduloSeleccionado}
      </div>

      {/* PANEL DE ESTADÍSTICAS */}
      <div className="grid grid-cols-3 gap-4 mt-8 mb-6">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex flex-col items-center justify-center">
          <p className="text-blue-600 text-[10px] sm:text-xs font-bold uppercase text-center">Total Inscritos</p>
          <h3 className="text-xl sm:text-3xl font-extrabold text-blue-900">{totalInscritos}</h3>
        </div>
        <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex flex-col items-center justify-center">
          <p className="text-green-600 text-[10px] sm:text-xs font-bold uppercase text-center">Ya Ingresaron</p>
          <h3 className="text-xl sm:text-3xl font-extrabold text-green-900">{totalIngresados}</h3>
        </div>
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex flex-col items-center justify-center">
          <p className="text-orange-600 text-[10px] sm:text-xs font-bold uppercase text-center">Faltan Llegar</p>
          <h3 className="text-xl sm:text-3xl font-extrabold text-orange-900">{totalFaltantes}</h3>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y BOTÓN NUEVO */}
      <div className="flex flex-col md:flex-row gap-2 mb-6">
        <div className="relative grow">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            <Search className="w-5 h-5" />
          </div>
          <input 
            type="text" 
            value={terminoBusqueda} 
            onChange={(e) => setTerminoBusqueda(e.target.value)} 
            placeholder="Buscar por nombre, documento o correo..." 
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#311b42] outline-none text-gray-900 bg-white placeholder-gray-500" 
          />
        </div>
        <button 
          onClick={() => setMostrarModal(true)}
          className="bg-[#c81474] hover:bg-pink-800 text-white font-bold px-6 py-3 rounded-xl transition-colors shadow-sm flex items-center justify-center space-x-2"
        >
          <UserPlus className="w-5 h-5" />
          <span>Registrar en Sitio</span>
        </button>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-xl mb-6 flex items-center space-x-2 ${mensaje.tipo === "error" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
          {mensaje.tipo === "error" ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
          <span className="font-bold text-sm text-gray-900">{mensaje.texto}</span>
        </div>
      )}

      {/* LISTA DE PARTICIPANTES */}
      {cargando ? (
        <div className="p-8 text-center text-gray-500 font-bold animate-pulse">
          Cargando lista y calculando estadísticas...
        </div>
      ) : (
        <div className="space-y-3">
          {participantesPaginados.map((p) => {
            const isCheckedIn = checkinsHoy.has(p.correo);
            return (
              <div 
                key={p.correo} 
                className={`border rounded-xl p-4 flex justify-between items-center transition-colors ${isCheckedIn ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}
              >
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {p.nombre} {p.apellido}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {p.correo} {p.numero_documento ? `| Doc: ${p.numero_documento}` : ""}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md font-semibold">
                    {p.rol}
                  </span>
                </div>
                
                {/* Toggle UI */}
                <button 
                  onClick={() => toggleCheckin(p.correo, isCheckedIn)} 
                  disabled={procesandoId === p.correo}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors disabled:opacity-50 focus:outline-none shrink-0 ${
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
          
          {participantesPaginados.length === 0 && (
            <p className="text-center text-gray-500 py-8 font-medium">No se encontraron resultados.</p>
          )}
          
          {/* CONTROLES DE PAGINACIÓN */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 pt-6 mt-4">
              <span className="text-sm text-gray-600 font-medium">
                Mostrando página {paginaActual} de {totalPaginas}
              </span>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                  disabled={paginaActual === 1}
                  className="p-2 rounded-lg bg-gray-100 text-gray-700 disabled:opacity-50 hover:bg-gray-200"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                  disabled={paginaActual === totalPaginas}
                  className="p-2 rounded-lg bg-gray-100 text-gray-700 disabled:opacity-50 hover:bg-gray-200"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL NUEVO PARTICIPANTE */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center bg-[#311b42] p-4 text-white">
              <h3 className="font-bold text-lg">Registrar e Ingresar</h3>
              <button onClick={() => setMostrarModal(false)} className="text-gray-300 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={registrarEnSitio} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Nombre *</label>
                  <input required type="text" value={nuevoForm.nombre} onChange={e => setNuevoForm({...nuevoForm, nombre: e.target.value})} className="w-full border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#c81474] text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Apellido *</label>
                  <input required type="text" value={nuevoForm.apellido} onChange={e => setNuevoForm({...nuevoForm, apellido: e.target.value})} className="w-full border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#c81474] text-gray-900" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Correo Electrónico *</label>
                <input required type="email" value={nuevoForm.correo} onChange={e => setNuevoForm({...nuevoForm, correo: e.target.value})} className="w-full border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#c81474] text-gray-900" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Documento (Opcional)</label>
                  <input type="text" value={nuevoForm.numero_documento} onChange={e => setNuevoForm({...nuevoForm, numero_documento: e.target.value})} className="w-full border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#c81474] text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Rol</label>
                  <select value={nuevoForm.rol} onChange={e => setNuevoForm({...nuevoForm, rol: e.target.value})} className="w-full border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#c81474] text-gray-900 bg-white">
                    <option value="Participante">Participante</option>
                    <option value="Moderador">Moderador</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={registrandoNuevo}
                className="w-full bg-[#c81474] hover:bg-pink-800 text-white font-bold py-4 rounded-xl shadow-md mt-4 disabled:opacity-70 transition-colors"
              >
                {registrandoNuevo ? "Guardando y dando ingreso..." : "Guardar y Marcar Ingreso"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}