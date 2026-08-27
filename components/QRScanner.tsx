"use client";

import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";
import { CheckCircle, XCircle, WifiOff, RefreshCw, Camera, ScanLine, ArrowRight } from "lucide-react";

export default function QRScanner({ moduloSeleccionado }: { moduloSeleccionado: string }) {
  const [resultado, setResultado] = useState<{ tipo: "exito" | "error" | "offline" | "cargando"; mensaje: string; nombre?: string } | null>(null);
  const [pendientesSync, setPendientesSync] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const offlineData = JSON.parse(localStorage.getItem("offline_checkins") || "[]");
    setPendientesSync(offlineData);
    
    // Limpieza de seguridad al desmontar el componente
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const extraerCorreoVCARD = (vcard: string) => {
    const match = vcard.match(/EMAIL[^:]*:([^\n\r]+)/i);
    return match ? match[1].trim().toLowerCase() : null;
  };

  const onScanSuccess = async (textoDecodificado: string) => {
    let correo = textoDecodificado.includes("BEGIN:VCARD") 
      ? extraerCorreoVCARD(textoDecodificado) 
      : textoDecodificado.trim().toLowerCase();

    if (!correo) {
      mostrarResultadoTemporal({ tipo: "error", mensaje: "QR inválido o no contiene correo electrónico." });
      return;
    }

    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

    if (!navigator.onLine) {
      guardarOffline(correo, todayStr, moduloSeleccionado);
      mostrarResultadoTemporal({ tipo: "offline", mensaje: `Guardado localmente: ${correo}` });
      return;
    }

    try {
      const { data: usuario, error: errUsuario } = await supabase
        .from("base_datos_participantes")
        .select("nombre, apellido")
        .eq("correo", correo)
        .eq("modulo", moduloSeleccionado)
        .single();

      if (!usuario || errUsuario) {
        mostrarResultadoTemporal({ tipo: "error", mensaje: `Correo no registrado en este módulo: ${correo}` });
        return;
      }

      const { data: checkinPrevio } = await supabase
        .from("check_ins")
        .select("id")
        .eq("correo_usuario", correo)
        .eq("dia_evento", todayStr)
        .eq("modulo", moduloSeleccionado)
        .single();

      if (checkinPrevio) {
        mostrarResultadoTemporal({ 
          tipo: "error", 
          mensaje: `Ya ingresó a ${moduloSeleccionado} hoy.`, 
          nombre: `${usuario.nombre} ${usuario.apellido}` 
        });
        return;
      }

      const { error: errInsert } = await supabase
        .from("check_ins")
        .insert([{ 
          correo_usuario: correo, 
          dia_evento: todayStr, 
          estado: "ingresó", 
          modulo: moduloSeleccionado 
        }]);

      if (errInsert) throw errInsert;

      mostrarResultadoTemporal({ 
        tipo: "exito", 
        mensaje: `Ingreso autorizado para ${moduloSeleccionado}`, 
        nombre: `${usuario.nombre} ${usuario.apellido}` 
      });

    } catch (error: any) {
      mostrarResultadoTemporal({ tipo: "error", mensaje: "Error de sistema: " + error.message });
    }
  };

  const mostrarResultadoTemporal = (res: any) => {
    setResultado(res);
    
    // Limpiamos cualquier temporizador anterior para evitar cruces
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Auto-cierre a los 3.5 segundos si el usuario no presiona nada
    timeoutRef.current = setTimeout(() => {
      setResultado(null);
    }, 3500);
  };

  // Función para forzar el escaneo inmediato saltándose la espera
  const forzarSiguienteEscaneo = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setResultado(null);
    fileInputRef.current?.click();
  };

  const procesarFotoNativa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setResultado({ tipo: "cargando", mensaje: "Analizando fotografía..." });
      
      try {
        const html5QrCode = new Html5Qrcode("hidden-qr-reader");
        const decodedText = await html5QrCode.scanFile(file, true);
        await onScanSuccess(decodedText);
      } catch (err) {
        mostrarResultadoTemporal({ 
          tipo: "error", 
          mensaje: "No se detectó ningún QR válido en la foto. Intenta enfocar mejor." 
        });
      }
      // Limpiar el input para permitir tomar otra foto enseguida
      e.target.value = "";
    }
  };

  const guardarOffline = (correo: string, fecha: string, modulo: string) => {
    const offlineData = JSON.parse(localStorage.getItem("offline_checkins") || "[]");
    offlineData.push({ correo, dia_evento: fecha, modulo, timestamp: new Date().toISOString() });
    localStorage.setItem("offline_checkins", JSON.stringify(offlineData));
    setPendientesSync(offlineData);
  };

  const sincronizarDatos = async () => {
    if (!navigator.onLine) {
      alert("Sigues sin conexión a internet.");
      return;
    }
    
    const offlineData = JSON.parse(localStorage.getItem("offline_checkins") || "[]");
    if (offlineData.length === 0) return;

    let sincronizados = 0;
    for (const reg of offlineData) {
      try {
        await supabase
          .from("check_ins")
          .insert([{ 
            correo_usuario: reg.correo, 
            dia_evento: reg.dia_evento, 
            estado: "ingresó", 
            modulo: reg.modulo 
          }]);
        sincronizados++;
      } catch (e) {
        console.error("Error al sincronizar fila offline", e);
      }
    }

    localStorage.removeItem("offline_checkins");
    setPendientesSync([]);
    alert(`Se sincronizaron ${sincronizados} registros exitosamente.`);
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative min-h-125 flex flex-col items-center justify-center">
      
      {/* Contenedor Oculto necesario para procesar la imagen */}
      <div id="hidden-qr-reader" style={{ display: "none" }}></div>

      <div className="absolute top-4 left-6 z-20 bg-[#311b42] text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md">
        Módulo Actual: {moduloSeleccionado}
      </div>

      {pendientesSync.length > 0 && (
        <div className="absolute top-16 left-6 right-6 z-20 bg-orange-100 text-orange-800 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-5 h-5" />
            <span className="font-bold text-sm">Faltan {pendientesSync.length} por sincronizar.</span>
          </div>
          <button 
            onClick={sincronizarDatos} 
            className="flex items-center space-x-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Sincronizar</span>
          </button>
        </div>
      )}

      {/* ÁREA CENTRAL PRINCIPAL */}
      <div className="w-full max-w-md flex flex-col items-center justify-center mt-12">
        
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={procesarFotoNativa}
        />

        {!resultado ? (
          <div className="flex flex-col items-center w-full animate-in fade-in duration-300">
            <div className="w-24 h-24 bg-pink-50 rounded-full flex items-center justify-center mb-6">
              <ScanLine className="w-12 h-12 text-[#c81474]" />
            </div>
            
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2 text-center">Control de Acceso</h2>
            <p className="text-gray-500 text-center mb-8 font-medium px-4">
              Toma una foto clara del código QR para registrar el ingreso al instante.
            </p>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-[#c81474] hover:bg-pink-800 text-white font-extrabold text-lg py-5 px-6 rounded-2xl transition-all shadow-xl shadow-pink-200 flex items-center justify-center space-x-3 hover:scale-[1.02] active:scale-95"
            >
              <Camera className="w-7 h-7" />
              <span>Tomar Foto al QR</span>
            </button>
          </div>
        ) : (
          /* PANTALLA DE RESULTADOS / CARGA */
          <div className="flex flex-col items-center w-full p-8 bg-gray-50 rounded-3xl border border-gray-100 animate-in zoom-in-95 duration-200 shadow-inner">
            {resultado.tipo === "exito" && <CheckCircle className="w-28 h-28 text-green-500 mb-6 drop-shadow-sm" />}
            {resultado.tipo === "error" && <XCircle className="w-28 h-28 text-red-500 mb-6 drop-shadow-sm" />}
            {resultado.tipo === "offline" && <WifiOff className="w-28 h-28 text-orange-500 mb-6 drop-shadow-sm" />}
            {resultado.tipo === "cargando" && <RefreshCw className="w-24 h-24 text-[#c81474] mb-6 animate-spin drop-shadow-sm" />}
            
            {resultado.nombre && <h3 className="text-3xl font-black text-gray-900 mb-3 text-center leading-tight">{resultado.nombre}</h3>}
            
            <p className={`text-center font-bold text-xl ${resultado.tipo === "error" ? "text-red-600" : resultado.tipo === "cargando" ? "text-gray-600" : "text-gray-700"}`}>
              {resultado.mensaje}
            </p>
            
            {/* BOTÓN PARA SALTARSE LA ESPERA (Solo aparece cuando ya procesó) */}
            {resultado.tipo !== "cargando" && (
               <button 
                 onClick={forzarSiguienteEscaneo}
                 className="mt-8 bg-[#311b42] hover:bg-purple-950 text-white font-bold py-4 px-6 w-full rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 hover:scale-[1.02] active:scale-95"
               >
                 <Camera className="w-5 h-5" />
                 <span>Siguiente Escaneo Rápido</span>
                 <ArrowRight className="w-5 h-5 ml-1" />
               </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}