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

    // 1. Extraer Usuarios y Evaluaciones
    const { data: partData, error: errPart } = await supabase
      .from('base_datos_participantes')
      .select('*');

    const { data: evalData, error: errEv } = await supabase
      .from('evaluaciones')
      .select('*');

    if (errPart || errEv) throw new Error("Error extrayendo datos de Supabase");

    // 2. Mapear Usuarios para búsqueda rápida
    const usuariosMap: Record<string, any> = {};
    partData?.forEach(p => {
      usuariosMap[(p.correo || "").toLowerCase()] = {
        nombre: (p.nombre || "").trim(),
        apellido: (p.apellido || "").trim(),
        rol: (p.rol || "").trim(),
        numero_documento: (p.numero_documento || "").trim()
      };
    });

    // 3. Reconstruir la lógica de "registrarVoto" del App Script
    const resultados = (evalData || []).map(ev => {
      const u = (ev.correo_usuario || "").toLowerCase();
      const pData = usuariosMap[u] || { nombre: "", apellido: "", rol: "Participante", numero_documento: "" };
      
      let rolBD = pData.rol.toLowerCase();
      let tipoEvaluador = "Participante";
      
      if (rolBD === "moderador") tipoEvaluador = "Moderador";
      else if (rolBD === "participante") tipoEvaluador = "Participante";
      else tipoEvaluador = pData.rol || "Participante";

      return {
        email: u,
        ponencia: ev.codigo_ponencia,
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

    // =========================================================
    // HOJA 1: Resultados (Equivalente al shR.appendRow)
    // =========================================================
    const shR = workbook.addWorksheet('Resultados');
    shR.addRow(["Email", "Código Ponencia", "Calificación", "Fecha", "Nombre", "Apellido", "Rol"]);
    resultados.forEach(r => {
      shR.addRow([r.email, r.ponencia, r.nota, r.fecha, r.nombre, r.apellido, r.rol]);
    });

    // Función equivalente a gestionarHojaYDatos
    const crearHojaConEstadisticas = (nombreHoja: string, datos: any[]) => {
      // Excel permite máximo 31 caracteres por nombre de hoja
      const sh = workbook.addWorksheet(nombreHoja.substring(0, 31));
      const headers = ["Email", "Código Ponencia", "Calificación", "Fecha", "Nombre", "Apellido", "Rol"];
      sh.addRow(headers);
      
      const headerRow = sh.getRow(1);
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC81474' } };
      headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      sh.views = [{ state: 'frozen', ySplit: 1 }];

      datos.forEach(r => {
        sh.addRow([r.email, r.ponencia, r.nota, r.fecha, r.nombre, r.apellido, r.rol]);
      });

      const lastR = datos.length + 1;
      sh.getCell('H1').value = "Desviación Estándar";
      sh.getCell('H1').font = { bold: true };
      // Corregido: Asignación de fórmula a través de la propiedad value
      sh.getCell('H2').value = { formula: `IF(COUNTA(C2:C${lastR})>0, STDEV.P(C2:C${lastR}), "")` };

      sh.getCell('I1').value = "Promedio";
      sh.getCell('I1').font = { bold: true };
      sh.getCell('I2').value = { formula: `IF(COUNTA(C2:C${lastR})>0, AVERAGE(C2:C${lastR}), "")` };

      sh.getCell('H2').numFmt = '0.00';
      sh.getCell('I2').numFmt = '0.00';
      sh.getCell('H2').font = { bold: true, color: { argb: 'FFC81474' } };
      sh.getCell('I2').font = { bold: true, color: { argb: 'FFC81474' } };
    };

    // =========================================================
    // HOJAS DE ROLES Y MODERADORES INDIVIDUALES
    // =========================================================
    const mods = resultados.filter(r => r.rol === "Moderador");
    const parts = resultados.filter(r => r.rol === "Participante");

    crearHojaConEstadisticas("Moderador", mods);
    crearHojaConEstadisticas("Participante", parts);

    const modNames = Array.from(new Set(mods.map(m => m.nombreCompleto)));
    modNames.forEach(name => {
      const modVotes = mods.filter(m => m.nombreCompleto === name);
      crearHojaConEstadisticas(name, modVotes);
    });

    // =========================================================
    // HOJA MAESTRA: Consolidado (gestionarConsolidadoDinamico)
    // =========================================================
    const shC = workbook.addWorksheet('Consolidado');
    const uniquePonencias = Array.from(new Set(resultados.map(r => r.ponencia)));
    const uniqueParticipants = Array.from(new Set(parts.map(p => p.nombreCompleto)));

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
    
    // Aplicar Colores del App Script original
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

    // Ocultar Columnas de Participantes
    for(let i = 19; i <= 18 + uniqueParticipants.length; i++) {
      headerRowC.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5C5C5C' } };
      headerRowC.getCell(i).font = { color: { argb: 'FFFFFFFF' }, bold: true };
      shC.getColumn(i).hidden = true; 
    }
    shC.views = [{ state: 'frozen', ySplit: 1 }];

    const colNumLetra = (num: number) => shC.getColumn(num).letter;

    // Procesar cada Ponencia
    uniquePonencias.forEach((pon, idx) => {
      const f = idx + 2;
      const rRow = new Array(headersC.length).fill("");
      rRow[0] = pon; 

      // Data de Moderador
      const modVote = mods.find(m => m.ponencia === pon);
      if (modVote) {
        const nomEval = modVote.nombreCompleto.substring(0, 31);
        rRow[1] = nomEval; // B
        rRow[2] = modVote.nota; // C
        rRow[3] = { formula: `IF(Moderador!H2="", "", Moderador!H2)` }; // D
        rRow[4] = { formula: `IF('${nomEval}'!H2="", "", '${nomEval}'!H2)` }; // E
        rRow[5] = { formula: `IF(Moderador!I2="", "", Moderador!I2)` }; // F
        rRow[6] = { formula: `IF('${nomEval}'!I2="", "", '${nomEval}'!I2)` }; // G
        rRow[7] = 0.8; // H
        rRow[8] = { formula: `MAX(0, MIN(1000, F${f}+H${f}*(D${f}/E${f})*(C${f}-G${f})))` }; // I
      }

      // Data de Participantes
      const pVotes = parts.filter(p => p.ponencia === pon);
      pVotes.forEach(pv => {
        const cIdx = 18 + uniqueParticipants.indexOf(pv.nombreCompleto);
        rRow[cIdx] = pv.nota;
      });

      const row = shC.addRow(rRow);

      // Fórmulas Dinámicas Globales
      const lastColLetter = uniqueParticipants.length > 0 ? colNumLetra(18 + uniqueParticipants.length) : 'S';
      
      if (uniqueParticipants.length > 0) {
        row.getCell(10).value = { formula: `IF(COUNTA(S${f}:${lastColLetter}${f})=0, "", COUNTA(S${f}:${lastColLetter}${f}))` }; // J
        row.getCell(13).value = { formula: `IF(COUNTA(S${f}:${lastColLetter}${f})=0, "", AVERAGE(S${f}:${lastColLetter}${f}))` }; // M
      } else {
        row.getCell(10).value = "";
        row.getCell(13).value = "";
      }

      // Formulación Avanzada Corregida para TypeScript
      row.getCell(11).value = { formula: `AVERAGE($J$2:$J$1000)` }; // K
      row.getCell(12).value = { formula: `K${f}*2` }; // L
      row.getCell(14).value = { formula: `AVERAGE($M$2:$M$1000)` }; // N
      row.getCell(15).value = 2.0; // O
      row.getCell(16).value = 30.0; // P
      row.getCell(17).value = { formula: `N${f}+(J${f}/(J${f}+L${f}))^O${f}*(M${f}-N${f})-P${f}*(L${f}/(J${f}+L${f}))` }; // Q
      row.getCell(18).value = { formula: `(Q${f}*0.4)+(0.6*I${f})` }; // R

      // Formato a dos decimales
      for(let i = 3; i <= 18; i++) {
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