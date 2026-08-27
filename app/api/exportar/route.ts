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

    const { data: partData, error: errPart } = await supabase
      .from('base_datos_participantes')
      .select('*')
      .eq('modulo', 'Ponencias');

    const { data: evalData, error: errEv } = await supabase
      .from('evaluaciones')
      .select('*');

    const { data: ponenciasData, error: errPon } = await supabase
      .from('ponencias')
      .select('*');

    if (errPart || errEv || errPon) throw new Error("Error extrayendo datos de Supabase");

    const usuariosMap: Record<string, any> = {};
    partData?.forEach(p => {
      usuariosMap[(p.correo || "").trim().toLowerCase()] = {
        nombre: (p.nombre || "").trim(),
        apellido: (p.apellido || "").trim(),
        rol: (p.rol || "Participante").trim(),
        numero_documento: (p.numero_documento || "").trim()
      };
    });

    const resultados = (evalData || []).map(ev => {
      const u = (ev.correo_usuario || "").trim().toLowerCase();
      const pData = usuariosMap[u] || { nombre: "Sin", apellido: "Registro", rol: "Participante", numero_documento: "N/A" };
      
      let rolBD = pData.rol.toLowerCase();
      let tipoEvaluador = "Participante";
      
      if (rolBD === "moderador") tipoEvaluador = "Moderador";
      else if (rolBD === "participante") tipoEvaluador = "Participante";
      else tipoEvaluador = pData.rol || "Participante";

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

      datos.forEach(r => {
        sh.addRow([r.email, r.ponencia, r.nota, r.fecha, r.nombre, r.apellido, r.rol]);
      });

      const lastR = datos.length + 1;
      sh.getCell('H1').value = "Desviación Estándar";
      sh.getCell('H1').font = { bold: true };
      sh.getCell('H2').value = { formula: `IF(COUNT(C2:C${lastR})>1, STDEV.P(C2:C${lastR}), 0)` };

      sh.getCell('I1').value = "Promedio";
      sh.getCell('I1').font = { bold: true };
      sh.getCell('I2').value = { formula: `IF(COUNT(C2:C${lastR})>0, AVERAGE(C2:C${lastR}), 0)` };

      sh.getCell('H2').numFmt = '0.00';
      sh.getCell('I2').numFmt = '0.00';
      sh.getCell('H2').font = { bold: true, color: { argb: 'FFC81474' } };
      sh.getCell('I2').font = { bold: true, color: { argb: 'FFC81474' } };
    };

    const mods = resultados.filter(r => r.rol === "Moderador");
    const parts = resultados.filter(r => r.rol === "Participante");

    // Corrección de Nombres: "Moderadores" y "Participantes"
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

    const colNumLetra = (num: number) => {
      let temp = num, letter = '';
      while (temp > 0) {
        let mod = (temp - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        temp = Math.floor((temp - mod) / 26);
      }
      return letter;
    };

    ponenciasDB.forEach((ponDB, idx) => {
      const ponId = (ponDB.codigo_ponencia || "").trim();
      const f = idx + 2;
      const rRow = new Array(headersC.length).fill(null);
      rRow[0] = ponId; 

      const modVote = mods.find(m => m.ponencia.toLowerCase() === ponId.toLowerCase());
      if (modVote) {
        const nomEval = modVote.nombreCompleto.substring(0, 31);
        rRow[1] = nomEval; 
        rRow[2] = modVote.nota; 
        // Corregido: Las fórmulas apuntan a la hoja 'Moderadores'
        rRow[3] = { formula: `IFERROR(Moderadores!$H$2, 0)` }; 
        rRow[4] = { formula: `IFERROR('${nomEval}'!$H$2, 0)` }; 
        rRow[5] = { formula: `IFERROR(Moderadores!$I$2, 0)` }; 
        rRow[6] = { formula: `IFERROR('${nomEval}'!$I$2, 0)` }; 
        rRow[7] = 0.8; 
        rRow[8] = { formula: `IFERROR(MAX(0, MIN(1000, F${f}+H${f}*(D${f}/IF(E${f}=0,1,E${f}))*(C${f}-G${f}))), 0)` }; 
      } else {
        rRow[1] = "Sin Moderador";
        rRow[2] = 0; rRow[3] = 0; rRow[4] = 0; rRow[5] = 0; rRow[6] = 0; rRow[7] = 0.8; rRow[8] = 0;
      }

      const pVotes = parts.filter(p => p.ponencia.toLowerCase() === ponId.toLowerCase());
      pVotes.forEach(pv => {
        const cIdx = 18 + uniqueParticipants.indexOf(pv.nombreCompleto);
        rRow[cIdx] = pv.nota;
      });

      const row = shC.addRow(rRow);

      const lastColLetter = uniqueParticipants.length > 0 ? colNumLetra(18 + uniqueParticipants.length) : 'S';
      const maxRows = ponenciasDB.length + 1;
      
      if (uniqueParticipants.length > 0) {
        row.getCell(10).value = { formula: `COUNT(S${f}:${lastColLetter}${f})` }; 
        row.getCell(13).value = { formula: `IF(J${f}>0, AVERAGE(S${f}:${lastColLetter}${f}), "")` }; 
      } else {
        row.getCell(10).value = 0;
        row.getCell(13).value = "";
      }

      row.getCell(11).value = { formula: `IFERROR(AVERAGE($J$2:$J$${maxRows}), 0)` }; 
      row.getCell(12).value = { formula: `K${f}*2` }; 
      row.getCell(14).value = { formula: `IFERROR(AVERAGE($M$2:$M$${maxRows}), 0)` }; 
      row.getCell(15).value = 2.0; 
      row.getCell(16).value = 30.0; 
      row.getCell(17).value = { formula: `IFERROR(N${f}+(J${f}/IF((J${f}+L${f})=0,1,(J${f}+L${f})))^O${f}*(M${f}-N${f})-P${f}*(L${f}/IF((J${f}+L${f})=0,1,(J${f}+L${f}))), 0)` }; 
      row.getCell(18).value = { formula: `IFERROR((Q${f}*0.4)+(0.6*I${f}), 0)` }; 

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
      row.getCell(15).numFmt = '0.00';
      row.getCell(16).numFmt = '0.00';
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