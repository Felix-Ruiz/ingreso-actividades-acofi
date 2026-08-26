"use client";

import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import ExcelJS from "exceljs";
import { UploadCloud, Users, FileText, AlertCircle, CheckCircle } from "lucide-react";

export default function DataUploader({ moduloSeleccionado }: { moduloSeleccionado: string }) {
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

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        
        const correo = row.getCell(headerMap.correo).text?.trim().toLowerCase();
        const nombre = row.getCell(headerMap.nombre).text?.trim();
        const apellido = row.getCell(headerMap.apellido).text?.trim();
        
        if (correo && nombre && apellido) {
          const rol = headerMap.rol ? (row.getCell(headerMap.rol).text?.trim() || "Participante") : "Participante";
          const telefono = headerMap.telefono ? row.getCell(headerMap.telefono).text?.trim() : null;
          const documento = headerMap.documento ? row.getCell(headerMap.documento).text?.trim() : null;
          
          participantes.push({ 
            correo, 
            nombre, 
            apellido, 
            rol, 
            telefono, 
            numero_documento: documento, 
            modulo: moduloSeleccionado 
          });
        }
      });

      if (participantes.length === 0) {
        throw new Error("No se encontraron registros válidos de participantes.");
      }

      const { error } = await supabase
        .from("base_datos_participantes")
        .upsert(participantes);
        
      if (error) throw error;

      setMensaje({ tipo: "exito", texto: `Se cargaron ${participantes.length} participantes para el módulo: ${moduloSeleccionado}.` });
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
          ponencias.push({ 
            codigo_ponencia: codigo, 
            nombre_ponencia: nombre, 
            fecha_programada: fechaStr 
          });
        }
      });

      if (ponencias.length === 0) {
        throw new Error("No se encontraron ponencias válidas.");
      }

      const { error } = await supabase
        .from("ponencias")
        .upsert(ponencias);
        
      if (error) throw error;

      setMensaje({ tipo: "exito", texto: `Se cargaron ${ponencias.length} ponencias exitosamente.` });
    } catch (error: any) {
      setMensaje({ tipo: "error", texto: `Error: ${error.message}` });
    } finally {
      setCargando(null);
      if (fileInputPonencias.current) fileInputPonencias.current.value = "";
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
        {/* Card Participantes */}
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

        {/* Card Ponencias (Solo visible si el módulo es Ponencias) */}
        {moduloSeleccionado === "Ponencias" && (
          <div className="border border-gray-200 rounded-xl p-6 bg-gray-50 flex flex-col items-center text-center hover:border-[#311b42] transition-colors">
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
    </div>
  );
}