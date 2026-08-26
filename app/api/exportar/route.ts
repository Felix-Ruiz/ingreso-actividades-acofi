import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET() {
  try {
    // 1. Obtener datos de Supabase
    const { data: evaluaciones, error: errEval } = await supabase
      .from("evaluaciones")
      .select(`
        calificacion,
        fecha_evaluacion,
        codigo_ponencia,
        correo_usuario,
        base_datos_participantes (nombre, apellido, rol)
      `);

    if (errEval) throw errEval;

    // 2. Crear el libro de Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistema ACOFI";
    workbook.created = new Date();

    // --- HOJA 1: RESULTADOS CRUDOS ---
    const sheetResultados = workbook.addWorksheet("Resultados");
    sheetResultados.columns = [
      { header: "Email", key: "email", width: 25 },
      { header: "Código Ponencia", key: "ponencia", width: 20 },
      { header: "Calificación", key: "calificacion", width: 15 },
      { header: "Fecha", key: "fecha", width: 20 },
      { header: "Nombre", key: "nombre", width: 20 },
      { header: "Apellido", key: "apellido", width: 20 },
      { header: "Rol", key: "rol", width: 15 }
    ];

    // Estilo encabezado Resultados
    sheetResultados.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC81474" } };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    });

    // Llenar datos en Resultados
    evaluaciones?.forEach((ev) => {
      const p = ev.base_datos_participantes as any;
      const rolDefinitivo = p?.rol ? String(p.rol).trim() : "Participante";
      
      sheetResultados.addRow({
        email: ev.correo_usuario,
        ponencia: ev.codigo_ponencia,
        calificacion: ev.calificacion,
        fecha: new Date(ev.fecha_evaluacion).toLocaleDateString(),
        nombre: p?.nombre || "",
        apellido: p?.apellido || "",
        rol: rolDefinitivo
      });
    });

    // --- HOJA 2: CONSOLIDADO MATEMÁTICO ---
    const sheetConsolidado = workbook.addWorksheet("Consolidado");
    sheetConsolidado.columns = [
      { header: "Número Ponencia", key: "ponencia", width: 20 },
      { header: "Moderador", key: "mod", width: 20 },
      { header: "Nota Mod", key: "nota_mod", width: 15 },
      { header: "Desv. Gral Mod", key: "desv_gral", width: 20 },
      { header: "Desv. Individual Mod", key: "desv_ind", width: 20 },
      { header: "Promedio Gral Mod", key: "prom_gral", width: 20 },
      { header: "Promedio Individual Mod", key: "prom_ind", width: 25 },
      { header: "Corrección", key: "correccion", width: 15 },
      { header: "Nota Normalizada Mod", key: "nota_norm", width: 25 }
    ];

    // Estilo encabezado Consolidado
    sheetConsolidado.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF311B42" } };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    });

    // Agrupar ponencias únicas para el Consolidado
    const ponenciasUnicas = Array.from(new Set(evaluaciones?.map(e => e.codigo_ponencia)));
    
    ponenciasUnicas.forEach((cod, index) => {
      const fila = index + 2; // Fila en excel (1 es encabezado)
      // Buscar si hay un moderador para esta ponencia
      const evalMod = evaluaciones?.find(e => 
        e.codigo_ponencia === cod && 
        ((e.base_datos_participantes as any)?.rol === "Moderador")
      );

      sheetConsolidado.addRow({
        ponencia: cod,
        mod: evalMod ? `${(evalMod.base_datos_participantes as any).nombre} ${(evalMod.base_datos_participantes as any).apellido}` : "Sin Moderador",
        nota_mod: evalMod ? evalMod.calificacion : 0,
        correccion: 0.8
      });

      // Inyectar fórmulas (Simulación estructural del App Script)
      sheetConsolidado.getCell(`D${fila}`).value = { formula: `STDEV.P(Resultados!C2:C100)`, date1904: false };
      sheetConsolidado.getCell(`F${fila}`).value = { formula: `AVERAGE(Resultados!C2:C100)`, date1904: false };
      sheetConsolidado.getCell(`I${fila}`).value = { formula: `MAX(0, MIN(1000, C${fila}+D${fila}*(0.8)*(C${fila}-F${fila})))`, date1904: false };
    });

    // 3. Convertir a Buffer y enviar al cliente
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Disposition": 'attachment; filename="Evaluaciones_ACOFI.xlsx"',
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}