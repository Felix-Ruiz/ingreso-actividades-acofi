"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { RefreshCw, FileSpreadsheet } from "lucide-react";

export default function LiveConsolidado() {
  const [dataFinal, setDataFinal] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

      const mapRoles: Record<string, string> = {};
      partData.forEach(p => {
        let r = (p.rol || "").toLowerCase();
        mapRoles[(p.correo || "").toLowerCase()] = r === "moderador" ? "Moderador" : "Participante";
      });

      const mods = evalData.filter(e => mapRoles[(e.correo_usuario || "").toLowerCase()] === "Moderador");
      const parts = evalData.filter(e => mapRoles[(e.correo_usuario || "").toLowerCase()] === "Participante");

      const modScoresGral = mods.map(m => Number(m.calificacion) || 0);
      const desvGralMod = stdevp(modScoresGral);
      const promGralMod = average(modScoresGral);

      // Primer Pase: Cálculos por fila
      const rowsTemp = ponenciasData.map(pon => {
        const ponId = pon.codigo_ponencia;
        const modVote = mods.find(m => m.codigo_ponencia === ponId);
        const pVotes = parts.filter(p => p.codigo_ponencia === ponId);

        let C = modVote ? Number(modVote.calificacion) : 0;
        let modIndScores = modVote ? mods.filter(m => m.correo_usuario === modVote.correo_usuario).map(v => Number(v.calificacion)) : [];

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
        let M = J > 0 ? average(pVotes.map(v => Number(v.calificacion))) : 0;

        return { ponId, titulo: pon.nombre_ponencia, hasMod: !!modVote, C, D, E, F, G, H, I, J, M };
      });

      // Cálculos Globales de Columna (Equivalente a AVERAGE($J$2:$J))
      const avgJ = average(rowsTemp.map(r => r.J));
      const validM = rowsTemp.filter(r => r.J > 0).map(r => r.M);
      const avgM_excel = validM.length > 0 ? average(validM) : 0;

      // Segundo Pase: Fórmulas Finales
      const rowsFinal = rowsTemp.map(r => {
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

      // Ordenar por ID de ponencia alfabéticamente
      rowsFinal.sort((a, b) => a.ponId.localeCompare(b.ponId));
      setDataFinal(rowsFinal);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calcularConsolidado();
  }, []);

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 bg-[#311b42] text-white flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <FileSpreadsheet className="w-5 h-5 text-[#c81474]" />
          <h3 className="font-bold">Vista Previa: Consolidado Maestro</h3>
        </div>
        <button onClick={calcularConsolidado} className="p-2 text-white hover:text-[#c81474] transition-colors">
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="overflow-x-auto max-h-150">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <thead className="bg-gray-100 text-gray-900 font-extrabold sticky top-0 shadow-sm z-10">
            <tr>
              <th className="px-3 py-3 border-r border-gray-200">ID Ponencia</th>
              <th className="px-3 py-3 border-r border-gray-200">Nota Mod</th>
              <th className="px-3 py-3 border-r border-gray-200">Desv Gral Mod</th>
              <th className="px-3 py-3 border-r border-gray-200">Desv Ind Mod</th>
              <th className="px-3 py-3 border-r border-gray-200">Prom Gral Mod</th>
              <th className="px-3 py-3 border-r border-gray-200">Prom Ind Mod</th>
              <th className="px-3 py-3 border-r border-gray-200">Nota Norm Mod</th>
              <th className="px-3 py-3 border-r border-gray-200">Núm Calif</th>
              <th className="px-3 py-3 border-r border-gray-200">Prom Orig Asist</th>
              <th className="px-3 py-3 border-r border-gray-200 bg-green-100 text-green-900">Nota Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500 font-bold animate-pulse">Calculando matriz de datos...</td></tr>
            ) : dataFinal.map((r, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 font-bold text-[#c81474] border-r border-gray-100">{r.ponId}</td>
                <td className="px-3 py-2 font-mono border-r border-gray-100">{r.hasMod ? r.C.toFixed(2) : "-"}</td>
                <td className="px-3 py-2 font-mono border-r border-gray-100 text-gray-500">{r.hasMod ? r.D.toFixed(2) : "-"}</td>
                <td className="px-3 py-2 font-mono border-r border-gray-100 text-gray-500">{r.hasMod ? r.E.toFixed(2) : "-"}</td>
                <td className="px-3 py-2 font-mono border-r border-gray-100 text-gray-500">{r.hasMod ? r.F.toFixed(2) : "-"}</td>
                <td className="px-3 py-2 font-mono border-r border-gray-100 text-gray-500">{r.hasMod ? r.G.toFixed(2) : "-"}</td>
                <td className="px-3 py-2 font-mono border-r border-gray-100 font-bold">{r.hasMod ? r.I.toFixed(2) : "-"}</td>
                <td className="px-3 py-2 font-mono border-r border-gray-100 font-bold">{r.J}</td>
                <td className="px-3 py-2 font-mono border-r border-gray-100">{r.J > 0 ? r.M.toFixed(2) : "-"}</td>
                <td className="px-3 py-2 font-mono font-extrabold text-green-700 bg-green-50 border-r border-gray-100">{r.R.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}