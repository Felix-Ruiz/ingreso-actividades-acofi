"use client";

import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";
import { CheckCircle, XCircle, WifiOff, RefreshCw, ZoomIn } from "lucide-react";

export default function QRScanner({ moduloSeleccionado }: { moduloSeleccionado: string }) {
  const [resultado, setResultado] = useState<{ tipo: "exito" | "error" | "offline"; mensaje: string; nombre?: string } | null>(null);
  const [pendientesSync, setPendientesSync] = useState<string[]>([]);
  
  // Estado para el Control de Zoom Nativo
  const [zoomFeatures, setZoomFeatures] = useState<{ min: number; max: number; step: number; value: number; track: MediaStreamTrack } | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  useEffect(() => {
    const offlineData = JSON.parse(localStorage.getItem("offline_checkins") || "[]");
    setPendientesSync(offlineData);
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const startCamera = async () => {
      try {
        const html5QrCode = new Html5Qrcode("qr-reader-custom");
        scannerRef.current = html5QrCode;
        
        const config = { fps: 15, qrbox: { width: 260, height: 260 } };
        
        // 1. Obtener cámaras con el método original que dispara el popup de permisos
        const cameras = await Html5Qrcode.getCameras();
        
        if (cameras && cameras.length > 0) {
          let selectedCameraId = cameras[0].id;
          
          // Filtrar buscando las cámaras traseras
          const backCameras = cameras.filter(c => 
            c.label.toLowerCase().includes('back') || 
            c.label.toLowerCase().includes('trasera') || 
            c.label.toLowerCase().includes('rear') || 
            c.label.toLowerCase().includes('environment')
          );

          if (backCameras.length > 0) {
            // EVITAR LA CÁMARA ULTRA-WIDE: Esta cámara carece de autoenfoque y vuelve todo borroso de cerca
            const mainBack = backCameras.find(c => 
              !c.label.toLowerCase().includes('ultra') && 
              !c.label.toLowerCase().includes('wide') &&
              !c.label.toLowerCase().includes('0.5x') &&
              !c.label.toLowerCase().includes('telephoto')
            );
            selectedCameraId = mainBack ? mainBack.id : backCameras[0].id;
          }

          // Iniciar la cámara seleccionada
          await html5QrCode.start(selectedCameraId, config, onScanSuccess, () => {});
          isScanningRef.current = true;

          // INYECCIÓN DE HARDWARE: Forzar Autoenfoque y Zoom Nativo (Usando "any" para silenciar TypeScript)
          setTimeout(async () => {
            try {
              const videoEl = document.querySelector('#qr-reader-custom video') as HTMLVideoElement;
              if (!videoEl || !videoEl.srcObject) return;
              
              const stream = videoEl.srcObject as MediaStream;
              const track = stream.getVideoTracks()[0];
              if (!track) return;

              // Casteamos a "any" para que TypeScript no bloquee las APIs experimentales
              const capabilities = track.getCapabilities() as any;
              const advanced: any[] = [];

              // Forzar Autoenfoque Continuo si el teléfono lo soporta
              if (capabilities.focusMode && capabilities.focusMode.includes("continuous")) {
                advanced.push({ focusMode: "continuous" });
              }

              // Aplicar Zoom Automático si el teléfono lo soporta
              if (capabilities.zoom) {
                const minZ = capabilities.zoom.min || 1;
                const maxZ = capabilities.zoom.max || 5;
                const stepZ = capabilities.zoom.step || 0.1;
                // Aplicamos un zoom automático de 2x (o el máximo que permita) para leer desde lejos
                const defaultZoom = Math.min(maxZ, Math.max(minZ, 2.0)); 
                
                advanced.push({ zoom: defaultZoom });
                
                setZoomFeatures({
                  min: minZ,
                  max: maxZ,
                  step: stepZ,
                  value: defaultZoom,
                  track: track
                });
              }

              if (advanced.length > 0) {
                // Casteamos el objeto de configuración a "any" para evitar el error de MediaTrackConstraintSet
                await track.applyConstraints({ advanced } as any);
              }
            } catch (errHardware) {
              console.log("El dispositivo no soporta controles avanzados de cámara.", errHardware);
            }
          }, 1500); // Darle 1.5s a la cámara para que encienda antes de inyectar el hardware

        } else {
          setResultado({ tipo: "error", mensaje: "No se detectaron cámaras en el dispositivo." });
        }
      } catch (err) {
        console.error("Error general inicializando cámara:", err);
        setResultado({ 
          tipo: "error", 
          mensaje: "Por favor, otorga permisos de cámara en tu navegador y recarga la página." 
        });
      }
    };

    if (isMounted) startCamera();

    return () => {
      isMounted = false;
      if (scannerRef.current && isScanningRef.current) {
        scannerRef.current.stop().catch(console.error);
        isScanningRef.current = false;
      }
    };
  }, [moduloSeleccionado]);

  // Controlador manual del Zoom
  const handleZoomChange = async (newZoom: number) => {
    if (!zoomFeatures) return;
    try {
      await zoomFeatures.track.applyConstraints({ advanced: [{ zoom: newZoom }] } as any);
      setZoomFeatures({ ...zoomFeatures, value: newZoom });
    } catch (e) {
      console.error("Error al aplicar zoom manual:", e);
    }
  };

  const extraerCorreoVCARD = (vcard: string) => {
    const match = vcard.match(/EMAIL[^:]*:([^\n\r]+)/i);
    return match ? match[1].trim().toLowerCase() : null;
  };

  const onScanSuccess = async (textoDecodificado: string) => {
    if (!isScanningRef.current || resultado) return;
    isScanningRef.current = false;
    
    if (scannerRef.current) {
      await scannerRef.current.pause(true);
    }
    
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
    setTimeout(() => {
      setResultado(null);
      if (scannerRef.current) {
        scannerRef.current.resume();
        isScanningRef.current = true;
      }
    }, 2500);
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
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative">
      <div className="absolute top-4 left-6 z-20 bg-[#311b42] text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
        Módulo: {moduloSeleccionado}
      </div>

      {pendientesSync.length > 0 && (
        <div className="mt-8 mb-4 bg-orange-100 text-orange-800 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-5 h-5" />
            <span className="font-bold text-sm">Faltan {pendientesSync.length} por sincronizar.</span>
          </div>
          <button 
            onClick={sincronizarDatos} 
            className="flex items-center space-x-1 bg-orange-500 text-white px-3 py-2 rounded-lg text-sm font-bold transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Sincronizar</span>
          </button>
        </div>
      )}

      {/* Contenedor Principal de la Cámara con clases de Tailwind corregidas */}
      <div className="mt-8 relative overflow-hidden rounded-xl bg-black min-h-87.5 flex items-center justify-center shadow-inner">
        <div id="qr-reader-custom" className="w-full h-full" style={{ display: resultado ? 'none' : 'block' }}></div>
        
        {/* Barra de Zoom Manual Flotante */}
        {zoomFeatures && !resultado && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full flex items-center space-x-4 z-40 w-[85%] max-w-sm shadow-xl border border-white/20">
            <ZoomIn className="w-5 h-5 text-white shrink-0" />
            <input 
              type="range" 
              min={zoomFeatures.min} 
              max={zoomFeatures.max} 
              step={zoomFeatures.step} 
              value={zoomFeatures.value}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-[#c81474]"
            />
          </div>
        )}
        
        {/* Pantalla de Resultados (Éxito o Error) */}
        {resultado && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-white/95 backdrop-blur-md animate-in fade-in duration-200">
            {resultado.tipo === "exito" && <CheckCircle className="w-24 h-24 text-green-500 mb-4 drop-shadow-md" />}
            {resultado.tipo === "error" && <XCircle className="w-24 h-24 text-red-500 mb-4 drop-shadow-md" />}
            {resultado.tipo === "offline" && <WifiOff className="w-24 h-24 text-orange-500 mb-4 drop-shadow-md" />}
            
            {resultado.nombre && <h3 className="text-3xl font-extrabold text-gray-900 mb-2 text-center leading-tight">{resultado.nombre}</h3>}
            <p className={`text-center font-bold text-xl ${resultado.tipo === "error" ? "text-red-600" : "text-gray-700"}`}>
              {resultado.mensaje}
            </p>
            {resultado.tipo !== "error" && (
               <p className="text-gray-500 text-sm mt-8 animate-pulse font-medium">Reactivando sensor óptico...</p>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 mt-4 font-bold tracking-wide">
        Motor de Lente Principal & Autoenfoque Activo
      </p>
    </div>
  );
}