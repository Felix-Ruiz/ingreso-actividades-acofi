import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Faltan credenciales de Supabase en el servidor.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Helpers Matemáticos (El cerebro)
    const average = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const stdevp = (arr: number[]) => {
      if (arr.length < 2) return 0;
      const avg = average(arr);
      const variance = arr.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / arr.length;
      return Math.sqrt(variance);
    };

    // FUNCIÓN EXTRACTORA BLINDADA (Bypass del límite de 1000 de Supabase)
    const fetchAllData = async (table: string, matchCondition?: Record<string, any>) => {
      let result: any[] = [];
      let from = 0;
      while (true) {
        let query = supabase.from(table).select('*').range(from, from + 999);
        if (matchCondition) {
          query = query.match(matchCondition);
        }
        const { data, error } = await query;
        if (error) {
          console.error(`Error extrayendo ${table}:`, error);
          break;
        }
        if (!data || data.length === 0) break;
        result = [...result, ...data];
        if (data.length < 1000) break;
        from += 1000;
      }
      return result;
    };

    // 1. DESCARGA GLOBAL (Sin límites)
    const partDataRaw = await fetchAllData('base_datos_participantes');
    const evalData = await fetchAllData('evaluaciones');
    const ponenciasData = await fetchAllData('ponencias');

    if (!partDataRaw || !evalData || !ponenciasData) throw new Error("Error extrayendo datos completos de Supabase");

    // 2. MAPEO INTELIGENTE (LA CURA PARA CLONES Y CORREOS VACÍOS)
    const mapUnicos = new Map();
    
    partDataRaw.forEach(p => {
      const modString = String(p.modulo || "").toLowerCase();
      if (modString.includes("ponencias")) {
        const correo = String(p.correo || "").trim().toLowerCase();
        const nombre = String(p.nombre || "").trim().toLowerCase();
        const apellido = String(p.apellido || "").trim().toLowerCase();
        const rolActual = String(p.rol || "Participante").trim();

        const claveUnica = `${correo}-${nombre}-${apellido}`;

        if (!mapUnicos.has(claveUnica)) {
          mapUnicos.set(claveUnica, p);
        } else {
          // Jerarquía de Moderador
          if (rolActual.toLowerCase() === "moderador") {
            mapUnicos.set(claveUnica, p);
          }
        }
      }
    });

    const participantesDeduplicados = Array.from(mapUnicos.values());

    const usuariosPorCorreo: Record<string, any> = {};
    participantesDeduplicados.forEach(p => {
      const correoLimpio = String(p.correo || "").trim().toLowerCase();
      if (!usuariosPorCorreo[correoLimpio] || String(p.rol).toLowerCase() === "moderador") {
         usuariosPorCorreo[correoLimpio] = p;
      }
    });

    const resultados = (evalData || []).map(ev => {
      const u = (ev.correo_usuario || "").trim().toLowerCase();
      const pData = usuariosPorCorreo[u] || { nombre: "Sin", apellido: "Registro", rol: "Participante", numero_documento: "N/A" };
      
      let rolBD = String(pData.rol || "Participante").trim().toLowerCase();
      let tipoEvaluador = "Participante";
      
      if (rolBD === "moderador") tipoEvaluador = "Moderador";

      return {
        email: u,
        ponencia: (ev.codigo_ponencia || "").trim(),
        nota: Number(ev.calificacion),
        fecha: ev.created_at ? new Date(ev.created_at) : new Date(),
        nombre: pData.nombre,
        apellido: pData.apellido,
        nombreCompleto: `${pData.nombre} ${pData.apellido}`.trim() || u,
        numero_documento: pData.numero_documento,
        rol: tipoEvaluador,
        id_ev: ev.id
      };
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ACOFI';
    workbook.created = new Date();

    const shR = workbook.addWorksheet('Resultados');
    shR.addRow(["Email", "Código Ponencia", "Calificación", "Fecha", "Nombre", "Apellido", "Rol"]);
    resultados.forEach(r => {
      shR.addRow([r.email, r.ponencia, r.nota, r.fecha, r.nombre, r.apellido, r.rol]);
    });

    const crearHojaConEstadisticas = (nombreHoja: string, datos: any[]) => {
      const sh = workbook.addWorksheet(nombreHoja.substring(0, 31));
      const headers = ["Email", "Código Ponencia", "Calificación", "Fecha", "Nombre", "Apellido", "Rol"];
      sh.addRow(headers);
      
      const headerRow = sh.getRow(1);
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC81474' } };
      headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      sh.views = [{ state: 'frozen', ySplit: 1 }];

      const statScores = datos.map(d => d.nota);
      const calculatedStdev = stdevp(statScores);
      const calculatedAvg = average(statScores);

      datos.forEach(r => {
        sh.addRow([r.email, r.ponencia, r.nota, r.fecha, r.nombre, r.apellido, r.rol]);
      });

      // VALORES PLANOS PARA EVITAR ERRORES DE EXCEL
      sh.getCell('H1').value = "Desviación Estándar";
      sh.getCell('H1').font = { bold: true };
      sh.getCell('H2').value = calculatedStdev; // Número directo, sin fórmulas

      sh.getCell('I1').value = "Promedio";
      sh.getCell('I1').font = { bold: true };
      sh.getCell('I2').value = calculatedAvg; // Número directo, sin fórmulas

      sh.getCell('H2').numFmt = '0.00';
      sh.getCell('I2').numFmt = '0.00';
      sh.getCell('H2').font = { bold: true, color: { argb: 'FFC81474' } };
      sh.getCell('I2').font = { bold: true, color: { argb: 'FFC81474' } };
    };

    const mods = resultados.filter(r => r.rol === "Moderador");
    const parts = resultados.filter(r => r.rol === "Participante");

    crearHojaConEstadisticas("Moderadores", mods);
    crearHojaConEstadisticas("Participantes", parts);

    const modNames = Array.from(new Set(mods.map(m => m.nombreCompleto)));
    modNames.forEach(name => {
      const modVotes = mods.filter(m => m.nombreCompleto === name);
      crearHojaConEstadisticas(name, modVotes);
    });

    const shC = workbook.addWorksheet('Consolidado');
    const ponenciasDB = ponenciasData || [];
    const uniqueParticipants = Array.from(new Set(parts.map(p => p.nombreCompleto)));

    // PRE-CÁLCULO MATEMÁTICO EN EL BACKEND
    const modScoresGral = mods.map(m => m.nota);
    const desvGralMod = stdevp(modScoresGral);
    const promGralMod = average(modScoresGral);

    const rowsTemp = ponenciasDB.map(ponDB => {
      const ponId = (ponDB.codigo_ponencia || "").trim();
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
        ponId, hasMod: !!modVote, modName: modVote?.nombreCompleto || "Sin Moderador",
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

    const headersC = [
      "Número Ponencia", "Moderador", "Nota Mod", "Desv. Gral Mod",
      "Desv. Individual Mod", "Promedio Gral Mod", "Promedio Individual Mod",
      "Corrección", "Nota Normalizada Mod", "Número de calificaciones",
      "Promedio de calificaciones", "Promedio de calificaciones x2",
      "Promedio Original", "Promedio de asistentes Gobal",
      "Factor de corrección 1", "Factor de corrección 2", "Normalizada Asistentes", "Nota Final"
    ];
    
    headersC.push(...uniqueParticipants);
    shC.addRow(headersC);
    
    const headerRowC = shC.getRow(1);
    for(let i = 1; i <= 9; i++) {
      headerRowC.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC81474' } };
      headerRowC.getCell(i).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    }
    for(let i = 10; i <= 17; i++) {
      headerRowC.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF311B42' } };
      headerRowC.getCell(i).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    }
    headerRowC.getCell(18).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1BA829' } };
    headerRowC.getCell(18).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    for(let i = 19; i <= 18 + uniqueParticipants.length; i++) {
      headerRowC.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5C5C5C' } };
      headerRowC.getCell(i).font = { color: { argb: 'FFFFFFFF' }, bold: true };
      shC.getColumn(i).hidden = true; 
    }
    shC.views = [{ state: 'frozen', ySplit: 1 }];

    consolidadoRows.forEach((r) => {
      const rRow = new Array(headersC.length).fill(null);
      rRow[0] = r.ponId; 

      // VALORES PLANOS (Inyección directa del número sin usar fórmulas para evitar errores de compatibilidad)
      if (r.hasMod) {
        const nomEval = r.modName.substring(0, 31);
        rRow[1] = nomEval; 
        rRow[2] = r.C; 
        rRow[3] = r.D; 
        rRow[4] = r.E; 
        rRow[5] = r.F; 
        rRow[6] = r.G; 
        rRow[7] = r.H; 
        rRow[8] = r.I; 
      } else {
        rRow[1] = "Sin Moderador";
        rRow[2] = 0; rRow[3] = 0; rRow[4] = 0; rRow[5] = 0; rRow[6] = 0; rRow[7] = 0.8; rRow[8] = 0;
      }

      r.pVotes.forEach(pv => {
        const cIdx = 18 + uniqueParticipants.indexOf(pv.nombreCompleto);
        rRow[cIdx] = pv.nota;
      });

      const row = shC.addRow(rRow);

      // INYECCIÓN DE VALORES PLANOS RESTANTES
      row.getCell(10).value = r.J; 
      row.getCell(11).value = r.K; 
      row.getCell(12).value = r.L; 
      row.getCell(13).value = r.J > 0 ? r.M : ""; 
      row.getCell(14).value = r.N; 
      row.getCell(15).value = r.O; 
      row.getCell(16).value = r.P; 
      row.getCell(17).value = r.Q; 
      row.getCell(18).value = r.R; 

      // Formato a dos decimales
      row.getCell(3).numFmt = '0.00';
      row.getCell(4).numFmt = '0.00';
      row.getCell(5).numFmt = '0.00';
      row.getCell(6).numFmt = '0.00';
      row.getCell(7).numFmt = '0.00';
      row.getCell(8).numFmt = '0.0';
      row.getCell(9).numFmt = '0.00';
      row.getCell(10).numFmt = '0';
      row.getCell(11).numFmt = '0.00';
      row.getCell(12).numFmt = '0.00';
      row.getCell(13).numFmt = '0.00';
      row.getCell(14).numFmt = '0.00';
      row.getCell(15).numFmt = '0.0';
      row.getCell(16).numFmt = '0.0';
      row.getCell(17).numFmt = '0.00';
      row.getCell(18).numFmt = '0.00';
      
      for(let i = 19; i <= 18 + uniqueParticipants.length; i++) {
         row.getCell(i).numFmt = '0.00';
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Evaluacion_WEEF_2026.xlsx"',
      },
    });
    
  } catch (error: any) {
    console.error('Error generando Excel:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}