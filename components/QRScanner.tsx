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
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setResultado(null);
    }, 3500);
  };

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
        let textoDecodificado = null;

        // MOTOR 1: Intentar con BarcodeDetector Nativo (Ultra rápido y resistente en iOS 17+)
        if ('BarcodeDetector' in window) {
          try {
            // @ts-ignore
            const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            const img = new Image();
            img.src = URL.createObjectURL(file);
            await img.decode(); // Esperar a que el navegador procese la imagen
            const barcodes = await barcodeDetector.detect(img);
            if (barcodes.length > 0) {
              textoDecodificado = barcodes[0].rawValue;
            }
          } catch (err) {
            console.warn("BarcodeDetector nativo falló, intentando motor de respaldo...", err);
          }
        }

        // MOTOR 2: Fallback a Html5Qrcode si el Motor 1 no está disponible o falló
        if (!textoDecodificado) {
          const html5QrCode = new Html5Qrcode("hidden-qr-reader");
          // EL SECRETO EN iOS: pasar 'false' como segundo parámetro para evitar que intente 
          // dibujar fotos de 48MP en pantalla, previniendo el colapso silencioso de memoria.
          textoDecodificado = await html5QrCode.scanFile(file, false);
        }

        if (textoDecodificado) {
          await onScanSuccess(textoDecodificado);
        } else {
          throw new Error("No se detectó QR");
        }
      } catch (err) {
        mostrarResultadoTemporal({ 
          tipo: "error", 
          mensaje: "Código no detectado. Si está borroso, aléjate un poco y usa el Zoom." 
        });
      }
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
      
      {/* Contenedor Oculto */}
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
        
        {/* Restricción de formatos sugerida para forzar compatibilidad */}
        <input 
          type="file" 
          accept="image/jpeg, image/png" 
          capture="environment" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={procesarFotoNativa}
        />

        {!resultado ? (
          <div className="flex flex-col items-center w-full animate-in fade-in duration-300">
            <div className="w-24 h-24 bg-pink-50 rounded-full flex items-center justify-center mb-4">
              <ScanLine className="w-12 h-12 text-[#c81474]" />
            </div>
            
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2 text-center">Control de Acceso</h2>
            <p className="text-gray-500 text-center mb-6 font-medium px-4">
              Toma una foto clara del código QR para registrar el ingreso al instante.
            </p>

            {/* AVISO VISUAL PARA iPHONE */}
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl mb-6 w-full text-center">
              <p className="text-blue-800 text-xs font-bold">
                🍏 Tip para iPhone: Si el QR se ve borroso al acercarte, aléjate un poco y usa el Zoom de tu cámara.
              </p>
            </div>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-[#c81474] hover:bg-pink-800 text-white font-extrabold text-lg py-5 px-6 rounded-2xl transition-all shadow-xl shadow-pink-200 flex items-center justify-center space-x-3 hover:scale-[1.02] active:scale-95"
            >
              <Camera className="w-7 h-7" />
              <span>Tomar Foto al QR</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full p-8 bg-gray-50 rounded-3xl border border-gray-100 animate-in zoom-in-95 duration-200 shadow-inner">
            {resultado.tipo === "exito" && <CheckCircle className="w-28 h-28 text-green-500 mb-6 drop-shadow-sm" />}
            {resultado.tipo === "error" && <XCircle className="w-28 h-28 text-red-500 mb-6 drop-shadow-sm" />}
            {resultado.tipo === "offline" && <WifiOff className="w-28 h-28 text-orange-500 mb-6 drop-shadow-sm" />}
            {resultado.tipo === "cargando" && <RefreshCw className="w-24 h-24 text-[#c81474] mb-6 animate-spin drop-shadow-sm" />}
            
            {resultado.nombre && <h3 className="text-3xl font-black text-gray-900 mb-3 text-center leading-tight">{resultado.nombre}</h3>}
            
            <p className={`text-center font-bold text-xl ${resultado.tipo === "error" ? "text-red-600" : resultado.tipo === "cargando" ? "text-gray-600" : "text-gray-700"}`}>
              {resultado.mensaje}
            </p>
            
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