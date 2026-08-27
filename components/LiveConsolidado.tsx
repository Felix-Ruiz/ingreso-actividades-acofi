"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { RefreshCw, FileSpreadsheet, Layers, Search } from "lucide-react";

interface Evaluacion {
  email: string;
  ponencia: string;
  nota: number;
  fecha: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  rol: string;
}

export default function LiveConsolidado() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("Consolidado");
  const [searchTerm, setSearchTerm] = useState("");

  const [sheets, setSheets] = useState<{
    resultados: Evaluacion[];
    mods: Evaluacion[];
    parts: Evaluacion[];
    uniqueParticipants: string[];
    modNames: string[];
    consolidadoRows: any[];
  } | null>(null);

  const average = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const stdevp = (arr: number[]) => {
    if (arr.length < 2) return 0;
    const avg = average(arr);
    const variance = arr.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / arr.length;
    return Math.sqrt(variance);
  };

  const calcularConsolidado = async () => {
    setLoading(true);
    try {
      const { data: ponenciasData } = await supabase.from('ponencias').select('*');
      const { data: partData } = await supabase.from('base_datos_participantes').select('*').eq('modulo', 'Ponencias');
      const { data: evalData } = await supabase.from('evaluaciones').select('*');

      if (!ponenciasData || !evalData || !partData) return;

      const mapUsuarios: Record<string, any> = {};
      partData.forEach(p => {
        mapUsuarios[(p.correo || "").trim().toLowerCase()] = {
          nombre: (p.nombre || "").trim(),
          apellido: (p.apellido || "").trim(),
          rol: (p.rol || "Participante").trim()
        };
      });

      const resultados: Evaluacion[] = evalData.map(ev => {
        const u = (ev.correo_usuario || "").trim().toLowerCase();
        const pData = mapUsuarios[u] || { nombre: "Sin", apellido: "Registro", rol: "Participante" };
        
        let rolLimpio = pData.rol.toLowerCase();
        let tipoEvaluador = "Participante";
        if (rolLimpio === "moderador") tipoEvaluador = "Moderador";

        return {
          email: u,
          ponencia: (ev.codigo_ponencia || "").trim(),
          nota: Number(ev.calificacion) || 0,
          fecha: ev.created_at ? new Date(ev.created_at).toLocaleString('es-CO') : new Date().toLocaleString('es-CO'),
          nombre: pData.nombre,
          apellido: pData.apellido,
          nombreCompleto: `${pData.nombre} ${pData.apellido}`.trim() || u,
          rol: tipoEvaluador
        };
      });

      const mods = resultados.filter(r => r.rol === "Moderador");
      const parts = resultados.filter(r => r.rol === "Participante");
      const modNames = Array.from(new Set(mods.map(m => m.nombreCompleto)));
      const uniqueParticipants = Array.from(new Set(parts.map(p => p.nombreCompleto)));

      const modScoresGral = mods.map(m => m.nota);
      const desvGralMod = stdevp(modScoresGral);
      const promGralMod = average(modScoresGral);

      const rowsTemp = ponenciasData.map(pon => {
        const ponId = (pon.codigo_ponencia || "").trim();
        const ponCompare = ponId.toLowerCase();

        const modVote = mods.find(m => m.ponencia.toLowerCase() === ponCompare);
        const pVotes = parts.filter(p => p.ponencia.toLowerCase() === ponCompare);

        let C = modVote ? modVote.nota : 0;
        let modIndScores = modVote ? mods.filter(m => m.nombreCompleto === modVote.nombreCompleto).map(v => v.nota) : [];

        let D = desvGralMod;
        let E = stdevp(modIndScores);
        let F = promGralMod;
        let G = average(modIndScores);
        let H = 0.8;

        let I = 0;
        if (modVote) {
          let calc = E === 0 ? F : F + H * (D / E) * (C - G); 
          I = Math.max(0, Math.min(1000, calc));
        }

        let J = pVotes.length;
        let M = J > 0 ? average(pVotes.map(v => v.nota)) : 0;

        return { 
          ponId, titulo: pon.nombre_ponencia, hasMod: !!modVote, modName: modVote?.nombreCompleto || "Sin Moderador",
          C, D, E, F, G, H, I, J, M, pVotes 
        };
      });

      const validJ = rowsTemp.filter(r => r.J > 0).map(r => r.J);
      const avgJ = validJ.length > 0 ? average(validJ) : 0;
      
      const validM = rowsTemp.filter(r => r.J > 0).map(r => r.M);
      const avgM_excel = validM.length > 0 ? average(validM) : 0;

      const consolidadoRows = rowsTemp.map(r => {
        let K = avgJ;
        let L = K * 2;
        let N = avgM_excel;
        let O = 2.0;
        let P = 30.0;

        let Q = 0;
        let den = r.J + L;
        if (den === 0) den = 1;
        Q = N + Math.pow(r.J / den, O) * (r.M - N) - P * (L / den);

        let R = (Q * 0.4) + (0.6 * r.I);

        return { ...r, K, L, N, O, P, Q, R };
      });

      consolidadoRows.sort((a, b) => a.ponId.localeCompare(b.ponId));

      setSheets({ resultados, mods, parts, modNames, uniqueParticipants, consolidadoRows });
      setActiveTab("Consolidado");

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calcularConsolidado();
  }, []);

  const renderStandardSheet = (datos: Evaluacion[], isStats = false) => {
    const datosFiltrados = datos.filter(d => 
      d.ponencia.toLowerCase().includes(searchTerm.toLowerCase()) || 
      d.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stdev = stdevp(datosFiltrados.map(d => d.nota));
    const avg = average(datosFiltrados.map(d => d.nota));

    return (
      <div className="w-full">
        {isStats && (
          <div className="flex gap-4 mb-4">
            <div className="bg-pink-50 p-4 border border-pink-200 rounded-xl">
              <p className="text-xs text-pink-600 font-bold uppercase">Desviación Estándar</p>
              <p className="text-2xl font-extrabold text-pink-900">{stdev.toFixed(2)}</p>
            </div>
            <div className="bg-pink-50 p-4 border border-pink-200 rounded-xl">
              <p className="text-xs text-pink-600 font-bold uppercase">Promedio</p>
              <p className="text-2xl font-extrabold text-pink-900">{avg.toFixed(2)}</p>
            </div>
          </div>
        )}
        <div className="overflow-x-auto max-h-125 border border-gray-200 rounded-xl shadow-sm">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-[#c81474] text-white font-extrabold sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Código Ponencia</th>
                <th className="px-4 py-3">Calificación</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Apellido</th>
                <th className="px-4 py-3">Rol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {datosFiltrados.map((d, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2 font-medium text-gray-900">{d.email}</td>
                  <td className="px-4 py-2 font-bold text-gray-900">{d.ponencia}</td>
                  <td className="px-4 py-2 font-mono font-bold text-[#c81474]">{d.nota}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{d.fecha}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{d.nombre}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{d.apellido}</td>
                  <td className="px-4 py-2 font-bold text-gray-900">{d.rol}</td>
                </tr>
              ))}
              {datosFiltrados.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 font-bold">No se encontraron resultados para la búsqueda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const getConsolidadoFiltrado = () => {
    if (!sheets) return [];
    return sheets.consolidadoRows.filter(r => 
      r.ponId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.modName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 bg-[#311b42] text-white flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <FileSpreadsheet className="w-5 h-5 text-[#c81474]" />
          <h3 className="font-bold text-lg">Emulador Excel: Consolidado en Vivo</h3>
        </div>
        <button onClick={calcularConsolidado} className="p-2 text-white hover:text-[#c81474] transition-colors" title="Recalcular Fórmulas">
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading || !sheets ? (
        <div className="p-12 text-center text-gray-500 font-bold animate-pulse">
          Calculando matrices y fórmulas matemáticas...
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Barra de Búsqueda Universal */}
          <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar por código de ponencia, nombre, moderador..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#c81474] text-gray-900 bg-gray-50"
              />
            </div>
          </div>

          <div className="flex overflow-x-auto bg-gray-100 border-b border-gray-300 p-2 gap-2 hide-scrollbar">
            <button 
              onClick={() => setActiveTab("Consolidado")}
              className={`px-4 py-2 font-bold text-sm rounded-t-lg transition-colors flex items-center space-x-1 ${activeTab === "Consolidado" ? "bg-white text-[#311b42] border-t-2 border-[#311b42] shadow-sm" : "text-gray-600 hover:bg-gray-200"}`}
            >
              <Layers className="w-4 h-4" /> <span>Consolidado</span>
            </button>
            <button 
              onClick={() => setActiveTab("Resultados")}
              className={`px-4 py-2 font-bold text-sm rounded-t-lg transition-colors ${activeTab === "Resultados" ? "bg-white text-[#c81474] border-t-2 border-[#c81474] shadow-sm" : "text-gray-600 hover:bg-gray-200"}`}
            >
              Resultados
            </button>
            <button 
              onClick={() => setActiveTab("Moderadores")}
              className={`px-4 py-2 font-bold text-sm rounded-t-lg transition-colors ${activeTab === "Moderadores" ? "bg-white text-[#c81474] border-t-2 border-[#c81474] shadow-sm" : "text-gray-600 hover:bg-gray-200"}`}
            >
              Moderadores
            </button>
            <button 
              onClick={() => setActiveTab("Participantes")}
              className={`px-4 py-2 font-bold text-sm rounded-t-lg transition-colors ${activeTab === "Participantes" ? "bg-white text-[#c81474] border-t-2 border-[#c81474] shadow-sm" : "text-gray-600 hover:bg-gray-200"}`}
            >
              Participantes
            </button>
            
            {sheets.modNames.map(name => (
              <button 
                key={name}
                onClick={() => setActiveTab(name)}
                className={`px-4 py-2 font-bold text-sm rounded-t-lg transition-colors ${activeTab === name ? "bg-white text-blue-700 border-t-2 border-blue-700 shadow-sm" : "text-gray-600 hover:bg-gray-200"}`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="p-4 bg-gray-50">
            {activeTab === "Resultados" && renderStandardSheet(sheets.resultados, false)}
            {activeTab === "Moderadores" && renderStandardSheet(sheets.mods, true)}
            {activeTab === "Participantes" && renderStandardSheet(sheets.parts, true)}
            {sheets.modNames.includes(activeTab) && renderStandardSheet(sheets.mods.filter(m => m.nombreCompleto === activeTab), true)}

            {activeTab === "Consolidado" && (
              <div className="overflow-x-auto max-h-150 border border-gray-200 rounded-xl shadow-sm">
                <table className="w-full text-xs text-left whitespace-nowrap bg-white">
                  <thead className="sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#c81474] text-white">Ponencia</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#c81474] text-white">Moderador</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#c81474] text-white">Nota Mod</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#c81474] text-white">Desv Gral Mod</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#c81474] text-white">Desv Ind Mod</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#c81474] text-white">Prom Gral Mod</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#c81474] text-white">Prom Ind Mod</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#c81474] text-white">Corrección</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#c81474] text-white">Nota Norm Mod</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#311b42] text-white">Núm Calif</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#311b42] text-white">Prom Calif</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#311b42] text-white">Prom Calif x2</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#311b42] text-white">Prom Original</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#311b42] text-white">Prom Global Asist</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#311b42] text-white">Factor 1</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#311b42] text-white">Factor 2</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#311b42] text-white">Norm Asistentes</th>
                      <th className="px-3 py-3 border-r border-gray-200 bg-[#1ba829] text-white font-extrabold text-sm">Nota Final</th>
                      
                      {sheets.uniqueParticipants.map(name => (
                        <th key={name} className="hidden px-3 py-3 border-r border-gray-200 bg-gray-500 text-white font-normal">{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {getConsolidadoFiltrado().map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 font-bold text-gray-900 border-r border-gray-100">{r.ponId}</td>
                        <td className="px-3 py-2 font-bold border-r border-gray-100 text-[#c81474]">{r.modName}</td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-900 border-r border-gray-100">{r.hasMod ? r.C.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-900 border-r border-gray-100">{r.hasMod ? r.D.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-900 border-r border-gray-100">{r.hasMod ? r.E.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-900 border-r border-gray-100">{r.hasMod ? r.F.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-900 border-r border-gray-100">{r.hasMod ? r.G.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-900 border-r border-gray-100">{r.hasMod ? r.H.toFixed(1) : "-"}</td>
                        <td className="px-3 py-2 font-mono font-bold text-gray-900 bg-pink-50 border-r border-gray-100">{r.hasMod ? r.I.toFixed(2) : "-"}</td>
                        
                        <td className="px-3 py-2 font-mono font-bold text-gray-900 border-r border-gray-100">{r.J}</td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-900 border-r border-gray-100">{r.hasMod ? r.K.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-900 border-r border-gray-100">{r.hasMod ? r.L.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono font-bold text-gray-900 bg-purple-50 border-r border-gray-100">{r.J > 0 ? r.M.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-900 border-r border-gray-100">{r.hasMod ? r.N.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-900 border-r border-gray-100">{r.hasMod ? r.O.toFixed(1) : "-"}</td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-900 border-r border-gray-100">{r.hasMod ? r.P.toFixed(1) : "-"}</td>
                        <td className="px-3 py-2 font-mono font-bold text-gray-900 bg-purple-50 border-r border-gray-100">{r.hasMod ? r.Q.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono font-extrabold text-green-800 bg-green-100 border-r border-gray-200 text-sm">{r.hasMod ? r.R.toFixed(2) : "-"}</td>
                        
                        {sheets.uniqueParticipants.map(name => {
                          const pVote = r.pVotes.find((v: any) => v.nombreCompleto === name);
                          return <td key={name} className="hidden px-3 py-2 font-mono border-r border-gray-100 text-gray-900">{pVote ? pVote.nota.toFixed(2) : "-"}</td>;
                        })}
                      </tr>
                    ))}
                    {getConsolidadoFiltrado().length === 0 && (
                      <tr><td colSpan={18} className="px-4 py-8 text-center text-gray-500 font-bold">No se encontraron ponencias para la búsqueda.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}