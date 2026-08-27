"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { RefreshCw, FileSpreadsheet, Layers } from "lucide-react";

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

  // Estado que guardará todas las "Hojas" como en Excel
  const [sheets, setSheets] = useState<{
    resultados: Evaluacion[];
    mods: Evaluacion[];
    parts: Evaluacion[];
    uniqueParticipants: string[];
    modNames: string[];
    consolidadoRows: any[];
  } | null>(null);

  // Funciones Matemáticas Emuladoras de Excel
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

      // 1. Mapeo de Usuarios seguro
      const mapUsuarios: Record<string, any> = {};
      partData.forEach(p => {
        mapUsuarios[(p.correo || "").trim().toLowerCase()] = {
          nombre: (p.nombre || "").trim(),
          apellido: (p.apellido || "").trim(),
          rol: (p.rol || "Participante").trim()
        };
      });

      // 2. Construir Resultados (Raw Data)
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

      // 3. Separar por Roles
      const mods = resultados.filter(r => r.rol === "Moderador");
      const parts = resultados.filter(r => r.rol === "Participante");
      const modNames = Array.from(new Set(mods.map(m => m.nombreCompleto)));
      const uniqueParticipants = Array.from(new Set(parts.map(p => p.nombreCompleto)));

      // 4. Cálculos para Consolidado Maestro
      const modScoresGral = mods.map(m => m.nota);
      const desvGralMod = stdevp(modScoresGral);
      const promGralMod = average(modScoresGral);

      // Primer Pase
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
          let calc = E === 0 ? F : F + H * (D / E) * (C - G); // Si E es 0, evitamos división por 0
          I = Math.max(0, Math.min(1000, calc));
        }

        let J = pVotes.length;
        let M = J > 0 ? average(pVotes.map(v => v.nota)) : 0;

        return { 
          ponId, titulo: pon.nombre_ponencia, hasMod: !!modVote, modName: modVote?.nombreCompleto || "Sin Moderador",
          C, D, E, F, G, H, I, J, M, pVotes 
        };
      });

      // Cálculos Globales para Participantes
      const validJ = rowsTemp.filter(r => r.J > 0).map(r => r.J);
      const avgJ = validJ.length > 0 ? average(validJ) : 0;
      
      const validM = rowsTemp.filter(r => r.J > 0).map(r => r.M);
      const avgM_excel = validM.length > 0 ? average(validM) : 0;

      // Segundo Pase
      const consolidadoRows = rowsTemp.map(r => {
        let K = avgJ;
        let L = K * 2;
        let N = avgM_excel;
        let O = 2.0;
        let P = 30.0;

        let Q = 0;
        if (r.J > 0) {
          let den = r.J + L;
          if (den === 0) den = 1;
          Q = N + Math.pow(r.J / den, O) * (r.M - N) - P * (L / den);
        }

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

  // Función para renderizar hojas estándar (Resultados, Moderador, Juan, etc.)
  const renderStandardSheet = (datos: Evaluacion[], isStats = false) => {
    const stdev = stdevp(datos.map(d => d.nota));
    const avg = average(datos.map(d => d.nota));

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
        <div className="overflow-x-auto max-h-125 border border-gray-200 rounded-xl">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-[#c81474] text-white font-extrabold sticky top-0 z-10">
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
              {datos.map((d, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{d.email}</td>
                  <td className="px-4 py-2 font-bold">{d.ponencia}</td>
                  <td className="px-4 py-2 font-mono font-bold text-[#c81474]">{d.nota}</td>
                  <td className="px-4 py-2 text-gray-500">{d.fecha}</td>
                  <td className="px-4 py-2">{d.nombre}</td>
                  <td className="px-4 py-2">{d.apellido}</td>
                  <td className="px-4 py-2 font-bold">{d.rol}</td>
                </tr>
              ))}
              {datos.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No hay datos para esta hoja.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
          {/* Pestañas de Hojas (Sheet Tabs) */}
          <div className="flex overflow-x-auto bg-gray-100 border-b border-gray-300 p-2 gap-2 hide-scrollbar">
            <button 
              onClick={() => setActiveTab("Consolidado")}
              className={`px-4 py-2 font-bold text-sm rounded-t-lg transition-colors flex items-center space-x-1 ${activeTab === "Consolidado" ? "bg-white text-[#311b42] border-t-2 border-[#311b42] shadow-sm" : "text-gray-600 hover:bg-gray-200"}`}
            >
              <Layers className="w-4 h-4" /> <span>Consolidado Maestro</span>
            </button>
            <button 
              onClick={() => setActiveTab("Resultados")}
              className={`px-4 py-2 font-bold text-sm rounded-t-lg transition-colors ${activeTab === "Resultados" ? "bg-white text-[#c81474] border-t-2 border-[#c81474] shadow-sm" : "text-gray-600 hover:bg-gray-200"}`}
            >
              Resultados (Crudos)
            </button>
            <button 
              onClick={() => setActiveTab("Moderador")}
              className={`px-4 py-2 font-bold text-sm rounded-t-lg transition-colors ${activeTab === "Moderador" ? "bg-white text-[#c81474] border-t-2 border-[#c81474] shadow-sm" : "text-gray-600 hover:bg-gray-200"}`}
            >
              Global Moderadores
            </button>
            <button 
              onClick={() => setActiveTab("Participante")}
              className={`px-4 py-2 font-bold text-sm rounded-t-lg transition-colors ${activeTab === "Participante" ? "bg-white text-[#c81474] border-t-2 border-[#c81474] shadow-sm" : "text-gray-600 hover:bg-gray-200"}`}
            >
              Global Participantes
            </button>
            
            {/* Pestañas dinámicas por moderador */}
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
            {activeTab === "Moderador" && renderStandardSheet(sheets.mods, true)}
            {activeTab === "Participante" && renderStandardSheet(sheets.parts, true)}
            {sheets.modNames.includes(activeTab) && renderStandardSheet(sheets.mods.filter(m => m.nombreCompleto === activeTab), true)}

            {/* TABLA PRINCIPAL CONSOLIDADO */}
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
                      
                      {/* Columnas dinámicas de Participantes */}
                      {sheets.uniqueParticipants.map(name => (
                        <th key={name} className="px-3 py-3 border-r border-gray-200 bg-gray-500 text-white font-normal">{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sheets.consolidadoRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 font-bold text-gray-900 border-r border-gray-100">{r.ponId}</td>
                        <td className="px-3 py-2 font-bold border-r border-gray-100 text-[#c81474]">{r.modName}</td>
                        <td className="px-3 py-2 font-mono border-r border-gray-100">{r.hasMod ? r.C.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono border-r border-gray-100 text-gray-500">{r.hasMod ? r.D.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono border-r border-gray-100 text-gray-500">{r.hasMod ? r.E.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono border-r border-gray-100 text-gray-500">{r.hasMod ? r.F.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono border-r border-gray-100 text-gray-500">{r.hasMod ? r.G.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono border-r border-gray-100 text-gray-500">{r.hasMod ? r.H.toFixed(1) : "-"}</td>
                        <td className="px-3 py-2 font-mono border-r border-gray-100 font-bold bg-pink-50">{r.hasMod ? r.I.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono border-r border-gray-100 font-bold">{r.J > 0 ? r.J : "-"}</td>
                        <td className="px-3 py-2 font-mono border-r border-gray-100">{r.J > 0 ? r.K.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono border-r border-gray-100">{r.J > 0 ? r.L.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono border-r border-gray-100 font-bold bg-purple-50">{r.J > 0 ? r.M.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono border-r border-gray-100">{r.J > 0 ? r.N.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono border-r border-gray-100 text-gray-500">{r.J > 0 ? r.O.toFixed(1) : "-"}</td>
                        <td className="px-3 py-2 font-mono border-r border-gray-100 text-gray-500">{r.J > 0 ? r.P.toFixed(1) : "-"}</td>
                        <td className="px-3 py-2 font-mono border-r border-gray-100 font-bold bg-purple-50">{r.J > 0 ? r.Q.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 font-mono font-extrabold text-green-700 bg-green-100 border-r border-gray-200 text-sm">{r.R > 0 ? r.R.toFixed(2) : "-"}</td>
                        
                        {/* Notas individuales de participantes en esta ponencia */}
                        {sheets.uniqueParticipants.map(name => {
                          const pVote = r.pVotes.find((v: any) => v.nombreCompleto === name);
                          return <td key={name} className="px-3 py-2 font-mono border-r border-gray-100 text-gray-500">{pVote ? pVote.nota.toFixed(2) : "-"}</td>;
                        })}
                      </tr>
                    ))}
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