import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

export async function GET() {
  try {
    // 1. Inicializar cliente de Supabase desde las variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Faltan las credenciales de Supabase en el entorno del servidor.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Extraer todos los datos necesarios (Ponencias, Evaluaciones y Participantes)
    const { data: ponencias, error: errPonencias } = await supabase
      .from('ponencias')
      .select('*')
      .order('fecha_programada', { ascending: true });
      
    if (errPonencias) throw errPonencias;

    const { data: evaluaciones, error: errEvaluaciones } = await supabase
      .from('evaluaciones')
      .select('*')
      .order('created_at', { ascending: true });
      
    if (errEvaluaciones) throw errEvaluaciones;

    // Extraemos participantes del módulo de Ponencias para saber quién es el evaluador
    const { data: participantes, error: errParticipantes } = await supabase
      .from('base_datos_participantes')
      .select('correo, nombre, apellido, rol, numero_documento')
      .eq('modulo', 'Ponencias');
      
    if (errParticipantes) throw errParticipantes;

    // Mapeo rápido de participantes por correo para cruce de datos eficiente
    const mapParticipantes: Record<string, any> = {};
    participantes?.forEach(p => {
      mapParticipantes[p.correo] = p;
    });

    // 3. Crear el archivo Excel y sus propiedades
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Gestión ACOFI';
    workbook.created = new Date();

    // =========================================================================
    // HOJA 1: CONSOLIDADO DE PONENCIAS (Con Fórmulas Matemáticas y Ponderaciones)
    // =========================================================================
    const sheetConsolidado = workbook.addWorksheet('Consolidado Ponencias', {
      views: [{ state: 'frozen', ySplit: 1 }] // Congelar la primera fila
    });

    // Configurar Columnas
    sheetConsolidado.columns = [
      { header: 'Código Ponencia', key: 'codigo', width: 20 },
      { header: 'Título de la Ponencia', key: 'titulo', width: 50 },
      { header: 'Fecha Programada', key: 'fecha', width: 20 },
      { header: 'Total Votos', key: 'total', width: 15 },
      { header: 'Suma de Calificaciones', key: 'suma', width: 25 },
      { header: 'Promedio Matemático', key: 'promedio', width: 25 },
      { header: 'Ponderación (100%)', key: 'ponderacion', width: 25 },
    ];

    // Estilo de la Cabecera (Hoja 1)
    const headerRow1 = sheetConsolidado.getRow(1);
    headerRow1.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    headerRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF311B42' } };
    headerRow1.alignment = { vertical: 'middle', horizontal: 'center' };

    // Insertar datos de ponencias e inyectar fórmulas de Excel
    ponencias?.forEach((p, index) => {
      const rowNumber = index + 2; // Fila real en Excel (la 1 es cabecera)
      
      // Pre-calcular sumas para tener el dato en bruto
      const evsDePonencia = evaluaciones?.filter(e => e.codigo_ponencia === p.codigo_ponencia) || [];
      const totalVotos = evsDePonencia.length;
      const sumaCalificaciones = evsDePonencia.reduce((acc, curr) => acc + (Number(curr.calificacion) || 0), 0);

      sheetConsolidado.addRow({
        codigo: p.codigo_ponencia,
        titulo: p.nombre_ponencia,
        fecha: p.fecha_programada,
        total: totalVotos,
        suma: sumaCalificaciones,
        // Inyección de Fórmulas Matemáticas (Se calculan en tiempo real en el Excel del usuario)
        // Promedio = Suma / Total (Con control de división por cero IF(D2>0, E2/D2, 0))
        promedio: totalVotos > 0 ? { formula: `IF(D${rowNumber}>0, E${rowNumber}/D${rowNumber}, 0)` } : 0,
        // Ponderación (Ejemplo: Asumiendo que el máximo es 1000, calculamos el porcentaje sobre 100%)
        ponderacion: totalVotos > 0 ? { formula: `IF(F${rowNumber}>0, (F${rowNumber}/1000)*100, 0)` } : 0
      });
      
      // Formato numérico a las celdas de promedio y ponderación
      sheetConsolidado.getCell(`F${rowNumber}`).numFmt = '0.00';
      sheetConsolidado.getCell(`G${rowNumber}`).numFmt = '0.00"%"';
    });

    // =========================================================================
    // HOJA 2: DATOS CRUDOS (Historial detallado de cada evaluación y evaluador)
    // =========================================================================
    const sheetDetalle = workbook.addWorksheet('Auditoría Evaluaciones', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    sheetDetalle.columns = [
      { header: 'Fecha de Registro', key: 'fecha_reg', width: 25 },
      { header: 'Código Ponencia', key: 'codigo_pon', width: 20 },
      { header: 'Calificación Asignada', key: 'calificacion', width: 25 },
      { header: 'Nombre del Evaluador', key: 'nombre_ev', width: 40 },
      { header: 'Correo del Evaluador', key: 'correo_ev', width: 35 },
      { header: 'Documento Evaluador', key: 'doc_ev', width: 25 },
      { header: 'Rol del Evaluador', key: 'rol_ev', width: 20 },
      { header: 'ID Evaluación (Sistema)', key: 'id_ev', width: 40 },
    ];

    // Estilo de la Cabecera (Hoja 2)
    const headerRow2 = sheetDetalle.getRow(1);
    headerRow2.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    headerRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC81474' } };
    headerRow2.alignment = { vertical: 'middle', horizontal: 'center' };

    // Insertar cada voto cruzando los datos con la tabla de participantes
    evaluaciones?.forEach((ev) => {
      const part = mapParticipantes[ev.correo_usuario] || {};
      
      sheetDetalle.addRow({
        fecha_reg: new Date(ev.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
        codigo_pon: ev.codigo_ponencia,
        calificacion: Number(ev.calificacion),
        nombre_ev: `${part.nombre || 'Participante'} ${part.apellido || 'No Registrado'}`.trim(),
        correo_ev: ev.correo_usuario,
        doc_ev: part.numero_documento || 'N/A',
        rol_ev: part.rol || 'N/A',
        id_ev: ev.id
      });
    });

    // 4. Generar Buffer final
    const buffer = await workbook.xlsx.writeBuffer();

    // 5. Retornar archivo al navegador con los headers correctos de descarga
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Consolidado_Final_ACOFI.xlsx"',
      },
    });
    
  } catch (error: any) {
    console.error('Error generando reporte Excel:', error);
    return NextResponse.json(
      { error: 'Error del sistema procesando el reporte: ' + error.message }, 
      { status: 500 }
    );
  }
}