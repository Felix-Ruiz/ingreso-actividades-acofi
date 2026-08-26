"use client";

import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import ExcelJS from "exceljs";
import { UploadCloud, Users, FileText, AlertCircle, CheckCircle } from "lucide-react";

export default function DataUploader() {
  const [cargando, setCargando] = useState<"participantes" | "ponencias" | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);
  
  const fileInputParticipantes = useRef<HTMLInputElement>(null);
  const fileInputPonencias = useRef<HTMLInputElement>(null);

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

      const participantes: any[] = [];
      const headerMap: { [key: string]: number } = {};

      // 1. Mapeo Inteligente de Columnas (Lee la primera fila)
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        const headerName = cell.text?.trim().toUpperCase();
        if (headerName === "CORREO ELECTRÓNICO") headerMap.correo = colNumber;
        else if (headerName === "NOMBRE") headerMap.nombre = colNumber;
        else if (headerName === "APELLIDOS") headerMap.apellido = colNumber;
        else if (headerName === "ROL") headerMap.rol = colNumber;
        else if (headerName === "TELÉFONO MÓVIL") headerMap.telefono = colNumber;
        else if (headerName === "NÚMERO DE DOCUMENTO") headerMap.documento = colNumber;
      });

      // Validar columnas estrictamente necesarias
      if (!headerMap.correo || !headerMap.nombre || !headerMap.apellido) {
        throw new Error("El archivo no contiene las columnas obligatorias exactas: CORREO ELECTRÓNICO, NOMBRE, APELLIDOS.");
      }

      // 2. Extracción dinámica de datos
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Saltamos los encabezados

        const correo = row.getCell(headerMap.correo).text?.trim().toLowerCase();
        const nombre = row.getCell(headerMap.nombre).text?.trim();
        const apellido = row.getCell(headerMap.apellido).text?.trim();
        
        // Campos opcionales (dependen de si la columna existe en el excel)
        const rol = headerMap.rol ? (row.getCell(headerMap.rol).text?.trim() || "Participante") : "Participante";
        const telefono = headerMap.telefono ? row.getCell(headerMap.telefono).text?.trim() : null;
        const documento = headerMap.documento ? row.getCell(headerMap.documento).text?.trim() : null;

        if (correo && nombre && apellido) {
          participantes.push({ 
            correo, 
            nombre, 
            apellido, 
            rol, 
            telefono, 
            numero_documento: documento 
          });
        }
      });

      if (participantes.length === 0) throw new Error("No se encontraron registros válidos de participantes.");

      // 3. Inserción o actualización masiva en Supabase
      const { error } = await supabase.from("base_datos_participantes").upsert(participantes);
      if (error) throw error;

      setMensaje({ tipo: "exito", texto: `Se procesaron inteligentemente ${participantes.length} participantes con éxito.` });
    } catch (error: any) {
      setMensaje({ tipo: "error", texto: `Error: ${error.message}` });
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

      const ponencias: any[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const codigo = row.getCell(1).text?.trim();
        const nombre = row.getCell(2).text?.trim();
        let fecha = row.getCell(3).value;

        // Formatear fecha a YYYY-MM-DD
        let fechaStr = "";
        if (fecha instanceof Date) {
          fechaStr = fecha.toISOString().split("T")[0];
        } else if (typeof fecha === "string") {
          const partes = fecha.split("/");
          if (partes.length === 3) {
            fechaStr = new Date(fecha).toISOString().split("T")[0];
          } else {
            fechaStr = fecha;
          }
        }

        if (codigo && nombre && fechaStr) {
          ponencias.push({ codigo_ponencia: codigo, nombre_ponencia: nombre, fecha_programada: fechaStr });
        }
      });

      if (ponencias.length === 0) throw new Error("No se encontraron ponencias válidas. Verifica las columnas.");

      const { error } = await supabase.from("ponencias").upsert(ponencias);
      if (error) throw error;

      setMensaje({ tipo: "exito", texto: `Se cargaron/actualizaron ${ponencias.length} ponencias con éxito.` });
    } catch (error: any) {
      setMensaje({ tipo: "error", texto: `Error procesando el archivo: ${error.message}` });
    } finally {
      setCargando(null);
      if (fileInputPonencias.current) fileInputPonencias.current.value = "";
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      
      {/* Alertas */}
      {mensaje && (
        <div className={`p-4 rounded-xl mb-6 flex items-center space-x-2 ${
          mensaje.tipo === "error" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
        }`}>
          {mensaje.tipo === "error" ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
          <span className="font-bold text-sm">{mensaje.texto}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card: Participantes */}
        <div className="border border-gray-200 rounded-xl p-6 bg-gray-50 flex flex-col items-center text-center hover:border-[#c81474] transition-colors">
          <div className="bg-pink-100 p-4 rounded-full mb-4">
            <Users className="w-8 h-8 text-[#c81474]" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Base de Datos Participantes</h3>
          <p className="text-gray-500 text-xs mb-4">
            Lectura inteligente habilitada. El sistema detectará las columnas obligatorias sin importar el orden:<br/>
            <strong>CORREO ELECTRÓNICO, NOMBRE, APELLIDOS, ROL, TELÉFONO MÓVIL, NÚMERO DE DOCUMENTO</strong>
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
            className="w-full bg-[#c81474] hover:bg-pink-800 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md flex items-center justify-center space-x-2 disabled:opacity-70"
          >
            {cargando === "participantes" ? (
              <span className="animate-pulse">Procesando...</span>
            ) : (
              <>
                <UploadCloud className="w-5 h-5" />
                <span>Subir Archivo Excel</span>
              </>
            )}
          </button>
        </div>

        {/* Card: Ponencias */}
        <div className="border border-gray-200 rounded-xl p-6 bg-gray-50 flex flex-col items-center text-center hover:border-[#311b42] transition-colors">
          <div className="bg-purple-100 p-4 rounded-full mb-4">
            <FileText className="w-8 h-8 text-[#311b42]" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Cronograma de Ponencias</h3>
          <p className="text-gray-500 text-xs mb-4">
            Columnas esperadas (sin importar nombre, en este orden):<br/>
            <strong>1: Código, 2: Nombre, 3: Fecha (YYYY-MM-DD)</strong>
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
            className="w-full bg-[#311b42] hover:bg-purple-950 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md flex items-center justify-center space-x-2 disabled:opacity-70"
          >
            {cargando === "ponencias" ? (
              <span className="animate-pulse">Procesando...</span>
            ) : (
              <>
                <UploadCloud className="w-5 h-5" />
                <span>Subir Archivo Excel</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}