"use client";

import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import ExcelJS from "exceljs";
import { UploadCloud, Users, FileText, AlertCircle, CheckCircle, FileWarning, X } from "lucide-react";

export default function DataUploader({ moduloSeleccionado }: { moduloSeleccionado: string }) {
  const [cargando, setCargando] = useState<"participantes" | "ponencias" | "checkins" | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);
  
  const fileInputParticipantes = useRef<HTMLInputElement>(null);
  const fileInputPonencias = useRef<HTMLInputElement>(null);
  const fileInputCheckins = useRef<HTMLInputElement>(null);

  const [modalDuplicados, setModalDuplicados] = useState(false);
  const [conflictos, setConflictos] = useState<Record<string, any[]>>({});
  const [seleccionados, setSeleccionados] = useState<Record<string, number>>({});
  const [listosParaSubir, setListosParaSubir] = useState<any[]>([]);

  const procesarParticipantes = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCargando("participantes");
    setMensaje(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];

      const headerMap: { [key: string]: number } = {};

      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        const text = cell.text?.trim().toLowerCase() || "";
        if (text.includes("correo") || text.includes("email") || text.includes("electrónico")) headerMap.correo = colNumber;
        else if (text.includes("nombre")) headerMap.nombre = colNumber;
        else if (text.includes("apellido")) headerMap.apellido = colNumber;
        else if (text.includes("rol")) headerMap.rol = colNumber;
        else if (text.includes("tel") || text.includes("móvil") || text.includes("celular")) headerMap.telefono = colNumber;
        else if (text.includes("documento") || text.includes("doc")) headerMap.documento = colNumber;
      });

      if (!headerMap.correo || !headerMap.nombre || !headerMap.apellido) {
        throw new Error("El archivo no contiene las columnas necesarias (CORREO ELECTRÓNICO, NOMBRE, APELLIDOS).");
      }

      const mapParticipantes = new Map<string, any[]>();

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        
        const correo = row.getCell(headerMap.correo).text?.trim().toLowerCase();
        const nombre = row.getCell(headerMap.nombre).text?.trim();
        const apellido = row.getCell(headerMap.apellido).text?.trim();
        
        if (correo && nombre && apellido) {
          const rolOriginal = headerMap.rol ? (row.getCell(headerMap.rol).text?.trim() || "Participante") : "Participante";
          const telefono = headerMap.telefono ? row.getCell(headerMap.telefono).text?.trim() : null;
          const documento = headerMap.documento ? row.getCell(headerMap.documento).text?.trim() : null;
          
          const participante = { 
            fila: rowNumber,
            correo, 
            nombre, 
            apellido, 
            rol: rolOriginal, 
            telefono, 
            numero_documento: documento, 
            modulo: moduloSeleccionado 
          };

          if (!mapParticipantes.has(correo)) {
            mapParticipantes.set(correo, []);
          }
          mapParticipantes.get(correo)?.push(participante);
        }
      });

      const unicos: any[] = [];
      const repetidos: Record<string, any[]> = {};
      const seleccionesIniciales: Record<string, number> = {};

      mapParticipantes.forEach((filas, correo) => {
        if (filas.length === 1) {
          unicos.push(filas[0]);
        } else {
          repetidos[correo] = filas;
          seleccionesIniciales[correo] = filas[filas.length - 1].fila;
        }
      });

      if (Object.keys(repetidos).length > 0) {
        setListosParaSubir(unicos);
        setConflictos(repetidos);
        setSeleccionados(seleccionesIniciales);
        setModalDuplicados(true);
        setCargando(null); 
      } else {
        if (unicos.length === 0) throw new Error("No se encontraron registros válidos de participantes.");
        await finalizarSubidaParticipantes(unicos);
      }

    } catch (error: any) {
      setMensaje({ tipo: "error", texto: `Error: ${error.message}` });
      setCargando(null);
      if (fileInputParticipantes.current) fileInputParticipantes.current.value = "";
    }
  };

  const resolverConflictosYSubir = async () => {
    setModalDuplicados(false);
    setCargando("participantes");
    
    try {
      const resolucion: any[] = [];
      Object.entries(conflictos).forEach(([correo, filas]) => {
        const filaSeleccionada = seleccionados[correo];
        if (filaSeleccionada !== -1) {
          const rowToKeep = filas.find(f => f.fila === filaSeleccionada);
          if (rowToKeep) resolucion.push(rowToKeep);
        }
      });

      const datosFinales = [...listosParaSubir, ...resolucion];

      if (datosFinales.length === 0) {
        throw new Error("Se omitieron todos los registros y no quedó ninguno válido para subir.");
      }

      await finalizarSubidaParticipantes(datosFinales);
    } catch (error: any) {
      setMensaje({ tipo: "error", texto: `Error: ${error.message}` });
      setCargando(null);
    }
  };

  const finalizarSubidaParticipantes = async (datosPuros: any[]) => {
    try {
      const datosFinales = datosPuros.map(({ fila, ...resto }) => resto);

      // 1. TRAER ID, CORREO, MODULO Y ROL
      let todosExistentes: any[] = [];
      let pFrom = 0;
      let pStep = 999;
      let pFetchMore = true;

      while (pFetchMore) {
        const { data: partData, error: errPart } = await supabase
          .from("base_datos_participantes")
          .select("id, correo, modulo, rol") // ¡AQUÍ ESTÁ LA MAGIA, AHORA TRAEMOS EL ID!
          .range(pFrom, pFrom + pStep);
          
        if (errPart) throw errPart;

        if (partData && partData.length > 0) {
          todosExistentes = [...todosExistentes, ...partData];
          pFrom += pStep + 1;
          if (partData.length <= pStep) pFetchMore = false;
        } else {
          pFetchMore = false;
        }
      }

      // 2. AUTO-LIMPIEZA DE DUPLICADOS EN LA BASE DE DATOS
      const idsABorrar: number[] = [];
      const mapaExistentes = new Map();

      todosExistentes.forEach(e => {
        const correo = e.correo.toLowerCase();
        if (mapaExistentes.has(correo)) {
          // Si ya vimos este correo, este ID es un clon duplicado. Lo marcamos para borrar.
          idsABorrar.push(e.id);
        } else {
          mapaExistentes.set(correo, e);
        }
      });

      // Si hay basura duplicada, la borramos silenciosamente antes de continuar
      if (idsABorrar.length > 0) {
        const BATCH_DELETE = 200;
        for (let i = 0; i < idsABorrar.length; i += BATCH_DELETE) {
          await supabase
            .from("base_datos_participantes")
            .delete()
            .in("id", idsABorrar.slice(i, i + BATCH_DELETE));
        }
        console.log(`Se limpiaron ${idsABorrar.length} clones duplicados.`);
      }

      // 3. BLINDAJE Y COMBINACIÓN (Añadiendo el ID para forzar el Update)
      const datosProtegidos = datosFinales.map(p => {
        const existente = mapaExistentes.get(p.correo.toLowerCase());
        let nuevoModulo = moduloSeleccionado;
        let nuevoRol = p.rol;
        let idExistente = null;

        if (existente) {
          idExistente = existente.id; // Capturamos su ID real
          if (existente.rol === "Moderador") nuevoRol = "Moderador";
          
          if (existente.modulo) {
            const modulosPrevios = existente.modulo.split(",").map((m: string) => m.trim());
            if (!modulosPrevios.includes(moduloSeleccionado)) {
              modulosPrevios.push(moduloSeleccionado);
            }
            nuevoModulo = modulosPrevios.join(", ");
          }
        }

        const objFinal: any = { ...p, rol: nuevoRol, modulo: nuevoModulo };
        // Si ya existía, le inyectamos su ID original para que Supabase sepa que NO debe clonarlo
        if (idExistente) {
          objFinal.id = idExistente;
        }
        return objFinal;
      });

      // 4. SUBIDA POR LOTES
      const BATCH_SIZE = 500;
      for (let i = 0; i < datosProtegidos.length; i += BATCH_SIZE) {
        const lote = datosProtegidos.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from("base_datos_participantes")
          .upsert(lote);
          
        if (error) throw error;
      }

      setMensaje({ tipo: "exito", texto: `Se cargaron y blindaron ${datosProtegidos.length} participantes únicos exitosamente en el módulo: ${moduloSeleccionado}.` });
    } catch (error: any) {
      setMensaje({ tipo: "error", texto: `Error al subir a base de datos: ${error.message}` });
    } finally {
      setCargando(null);
      if (fileInputParticipantes.current) fileInputParticipantes.current.value = "";
    }
  };

  const procesarPonencias = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCargando("ponencias");
    setMensaje(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];

      const mapPonencias = new Map();
      const headerMap: { [key: string]: number } = {};

      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        const text = cell.text?.trim().toLowerCase() || "";
        if (text.includes("id") || text.includes("codigo") || text.includes("envío")) headerMap.codigo = colNumber;
        else if (text.includes("titulo") || text.includes("título") || text.includes("nombre")) headerMap.nombre = colNumber;
        else if (text.includes("fecha")) headerMap.fecha = colNumber;
      });

      if (!headerMap.codigo || !headerMap.nombre || !headerMap.fecha) {
        throw new Error("El archivo no contiene las columnas necesarias (ID envío, Título, Fecha).");
      }

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        
        const codigo = row.getCell(headerMap.codigo).text?.trim();
        const nombre = row.getCell(headerMap.nombre).text?.trim();
        const celdaFecha = row.getCell(headerMap.fecha).value;

        let fechaStr = "";
        if (celdaFecha instanceof Date) {
          fechaStr = celdaFecha.toISOString().split("T")[0];
        } else if (typeof celdaFecha === "string") {
          const partes = celdaFecha.split("/");
          if (partes.length === 3) {
            fechaStr = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
          } else {
            fechaStr = celdaFecha;
          }
        }

        if (codigo && nombre && fechaStr) {
          mapPonencias.set(codigo, { 
            codigo_ponencia: codigo, 
            nombre_ponencia: nombre, 
            fecha_programada: fechaStr 
          });
        }
      });

      const ponenciasFinales = Array.from(mapPonencias.values());

      if (ponenciasFinales.length === 0) {
        throw new Error("No se encontraron ponencias válidas.");
      }

      const { error } = await supabase
        .from("ponencias")
        .upsert(ponenciasFinales);
        
      if (error) throw error;

      setMensaje({ tipo: "exito", texto: `Se cargaron ${ponenciasFinales.length} ponencias exitosamente.` });
    } catch (error: any) {
      setMensaje({ tipo: "error", texto: `Error: ${error.message}` });
    } finally {
      setCargando(null);
      if (fileInputPonencias.current) fileInputPonencias.current.value = "";
    }
  };

  const procesarCheckinsMasivos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCargando("checkins");
    setMensaje(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];

      let colCorreo = -1;
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        const text = cell.text?.trim().toLowerCase() || "";
        if (text.includes("correo") || text.includes("email") || text.includes("electrónico")) {
          colCorreo = colNumber;
        }
      });

      if (colCorreo === -1) {
        throw new Error("El archivo no contiene la columna necesaria (CORREO ELECTRÓNICO).");
      }

      const correosExcel: string[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const correo = row.getCell(colCorreo).text?.trim().toLowerCase();
        if (correo) correosExcel.push(correo);
      });

      if (correosExcel.length === 0) {
        throw new Error("No se encontraron correos válidos en el archivo.");
      }

      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

      let allCheckins: any[] = [];
      let cFrom = 0;
      let cStep = 999;
      let cFetchMore = true;

      while (cFetchMore) {
        const { data: checkinData, error: errCheck } = await supabase
          .from("check_ins")
          .select("correo_usuario")
          .eq("dia_evento", todayStr)
          .eq("modulo", moduloSeleccionado)
          .range(cFrom, cFrom + cStep);
          
        if (errCheck) throw errCheck;

        if (checkinData && checkinData.length > 0) {
          allCheckins = [...allCheckins, ...checkinData];
          cFrom += cStep + 1;
          if (checkinData.length <= cStep) cFetchMore = false;
        } else {
          cFetchMore = false;
        }
      }

      const setCheckinsExistentes = new Set(allCheckins.map(c => c.correo_usuario.toLowerCase()));
      const correosUnicos = [...new Set(correosExcel)];
      const correosParaCheckin = correosUnicos.filter(c => !setCheckinsExistentes.has(c));

      if (correosParaCheckin.length === 0) {
        setMensaje({ tipo: "exito", texto: "Todos los correos del archivo ya tenían su ingreso registrado hoy." });
        return;
      }

      const nuevosCheckins = correosParaCheckin.map(correo => ({
        correo_usuario: correo,
        dia_evento: todayStr,
        estado: "ingresó",
        modulo: moduloSeleccionado
      }));

      const BATCH_SIZE = 500;
      for (let i = 0; i < nuevosCheckins.length; i += BATCH_SIZE) {
        const lote = nuevosCheckins.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from("check_ins")
          .insert(lote);
          
        if (error) throw error;
      }

      setMensaje({ tipo: "exito", texto: `Se registraron ${nuevosCheckins.length} nuevos ingresos (Check-ins) masivos exitosamente.` });
    } catch (error: any) {
      setMensaje({ tipo: "error", texto: `Error al procesar ingresos: ${error.message}` });
    } finally {
      setCargando(null);
      if (fileInputCheckins.current) fileInputCheckins.current.value = "";
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative">
      <div className="absolute top-4 right-6 z-20 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
        Módulo: {moduloSeleccionado}
      </div>

      {mensaje && (
        <div className={`mt-8 p-4 rounded-xl mb-6 flex items-center space-x-2 ${mensaje.tipo === "error" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
          {mensaje.tipo === "error" ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
          <span className="font-bold text-sm">{mensaje.texto}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        
        <div className="border border-gray-200 rounded-xl p-6 bg-gray-50 flex flex-col items-center text-center hover:border-[#c81474] transition-colors">
          <div className="bg-pink-100 p-4 rounded-full mb-4">
            <Users className="w-8 h-8 text-[#c81474]" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Base de Datos Participantes</h3>
          
          <p className="text-gray-500 text-xs mb-4">
            Las columnas necesitadas en el Excel se llaman (sin importar el orden):<br/>
            <strong className="text-gray-800">APELLIDOS, NOMBRE, CORREO ELECTRÓNICO, TELÉFONO MÓVIL, NÚMERO DE DOCUMENTO, ROL</strong>
          </p>
          
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            className="hidden" 
            ref={fileInputParticipantes} 
            onChange={procesarParticipantes}
          />
          <button 
            onClick={() => fileInputParticipantes.current?.click()} 
            disabled={cargando !== null} 
            className="w-full mt-auto bg-[#c81474] hover:bg-pink-800 text-white font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center space-x-2 disabled:opacity-70 transition-colors"
          >
            {cargando === "participantes" ? (
              <span className="animate-pulse">Procesando...</span>
            ) : (
              <>
                <UploadCloud className="w-5 h-5" />
                <span>Subir Participantes</span>
              </>
            )}
          </button>
        </div>

        <div className="border border-gray-200 rounded-xl p-6 bg-gray-50 flex flex-col items-center text-center hover:border-green-600 transition-colors">
          <div className="bg-green-100 p-4 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Ingreso Masivo (Check-in)</h3>
          
          <p className="text-gray-500 text-xs mb-4">
            Sube un Excel con los participantes que ya llegaron.<br/>
            La columna necesaria es:<br/>
            <strong className="text-gray-800">CORREO ELECTRÓNICO</strong>
          </p>
          
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            className="hidden" 
            ref={fileInputCheckins} 
            onChange={procesarCheckinsMasivos}
          />
          <button 
            onClick={() => fileInputCheckins.current?.click()} 
            disabled={cargando !== null} 
            className="w-full mt-auto bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center space-x-2 disabled:opacity-70 transition-colors"
          >
            {cargando === "checkins" ? (
              <span className="animate-pulse">Procesando...</span>
            ) : (
              <>
                <UploadCloud className="w-5 h-5" />
                <span>Subir Ingresos Masivos</span>
              </>
            )}
          </button>
        </div>

        {moduloSeleccionado === "Ponencias" && (
          <div className="border border-gray-200 rounded-xl p-6 bg-gray-50 flex flex-col items-center text-center hover:border-[#311b42] transition-colors md:col-span-2 lg:col-span-1">
            <div className="bg-purple-100 p-4 rounded-full mb-4">
              <FileText className="w-8 h-8 text-[#311b42]" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Cronograma de Ponencias</h3>
            
            <p className="text-gray-500 text-xs mb-4">
              Las columnas necesitadas en el Excel se llaman (sin importar el orden):<br/>
              <strong className="text-gray-800">ID envío, Título, Fecha (Formato DD/MM/YYYY)</strong>
            </p>
            
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              ref={fileInputPonencias} 
              onChange={procesarPonencias}
            />
            <button 
              onClick={() => fileInputPonencias.current?.click()} 
              disabled={cargando !== null} 
              className="w-full mt-auto bg-[#311b42] hover:bg-purple-950 text-white font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center space-x-2 disabled:opacity-70 transition-colors"
            >
              {cargando === "ponencias" ? (
                <span className="animate-pulse">Procesando...</span>
              ) : (
                <>
                  <UploadCloud className="w-5 h-5" />
                  <span>Subir Cronograma</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {modalDuplicados && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center bg-[#311b42] p-5 text-white shrink-0">
              <h3 className="font-extrabold text-lg flex items-center space-x-2">
                <FileWarning className="w-5 h-5" />
                <span>Conflictos Detectados en el Excel</span>
              </h3>
              <button 
                onClick={() => {
                  setModalDuplicados(false);
                  if (fileInputParticipantes.current) fileInputParticipantes.current.value = "";
                }} 
                className="text-gray-300 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto grow bg-gray-50">
              <p className="text-sm text-gray-600 font-medium mb-6">
                El archivo Excel contiene participantes con el mismo correo electrónico en distintas filas. Por favor, selecciona cuál versión deseas guardar, o elige omitirlos.
              </p>

              <div className="space-y-6">
                {Object.entries(conflictos).map(([correo, filas]) => (
                  <div key={correo} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <h4 className="font-extrabold text-[#c81474] mb-3 text-sm">{correo}</h4>
                    <div className="space-y-3">
                      {filas.map(f => (
                        <label key={f.fila} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-100 transition-colors">
                          <input 
                            type="radio" 
                            name={`radio-${correo}`}
                            checked={seleccionados[correo] === f.fila} 
                            onChange={() => setSeleccionados({...seleccionados, [correo]: f.fila})}
                            className="mt-1 w-4 h-4 text-[#c81474] focus:ring-[#c81474] border-gray-300"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900">
                              Fila {f.fila}: {f.nombre} {f.apellido}
                            </span>
                            <span className="text-xs text-gray-500 mt-0.5">
                              Doc: {f.numero_documento || "N/A"} • Rol: {f.rol}
                            </span>
                          </div>
                        </label>
                      ))}
                      <div className="border-t border-gray-100 my-2"></div>
                      <label className="flex items-center space-x-3 p-2 rounded-lg hover:bg-red-50 cursor-pointer transition-colors text-red-600">
                        <input 
                          type="radio" 
                          name={`radio-${correo}`}
                          checked={seleccionados[correo] === -1} 
                          onChange={() => setSeleccionados({...seleccionados, [correo]: -1})}
                          className="w-4 h-4 text-red-600 focus:ring-red-600 border-red-300"
                        />
                        <span className="text-sm font-bold">Omitir (No subir este correo)</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 bg-white shrink-0 flex space-x-3">
              <button 
                onClick={() => {
                  setModalDuplicados(false);
                  if (fileInputParticipantes.current) fileInputParticipantes.current.value = "";
                }}
                className="flex-1 bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 font-bold py-3.5 rounded-xl transition-colors"
              >
                Cancelar Subida
              </button>
              <button 
                onClick={resolverConflictosYSubir}
                className="flex-1 bg-[#c81474] hover:bg-pink-800 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md"
              >
                Confirmar y Subir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}