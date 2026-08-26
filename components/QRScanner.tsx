"use client";

import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";
import { CheckCircle, XCircle, WifiOff, RefreshCw, Camera } from "lucide-react";

export default function QRScanner() {
  const [resultado, setResultado] = useState<{ tipo: "exito" | "error" | "offline"; mensaje: string; nombre?: string } | null>(null);
  const [pendientesSync, setPendientesSync] = useState<string[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Cargar offline al montar
  useEffect(() => {
    const offlineData = JSON.parse(localStorage.getItem("offline_checkins") || "[]");
    setPendientesSync(offlineData);
  }, []);

  // Iniciar cámara automáticamente
  useEffect(() => {
    let isMounted = true;
    const startCamera = async () => {
      try {
        const html5QrCode = new Html5Qrcode("qr-reader-custom");
        scannerRef.current = html5QrCode;
        
        // Auto-inicia usando la cámara trasera preferentemente
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => onScanSuccess(decodedText, html5QrCode),
          (errorMessage) => { /* ignorar errores de frame vacío */ }
        );
      } catch (err) {
        console.error("Error iniciando cámara automáticamente", err);
      }
    };

    if (isMounted) startCamera();

    return () => {
      isMounted = false;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extraerCorreoVCARD = (vcard: string) => {
    const match = vcard.match(/EMAIL[^:]*:([^\n\r]+)/i);
    return match ? match[1].trim().toLowerCase() : null;
  };

  const onScanSuccess = async (textoDecodificado: string, scannerInstance: Html5Qrcode) => {
    // 1. Pausar escáner para evitar múltiples lecturas
    if (scannerInstance.isScanning) {
      await scannerInstance.pause();
    }
    
    let correo = textoDecodificado.includes("BEGIN:VCARD") 
      ? extraerCorreoVCARD(textoDecodificado) 
      : textoDecodificado.trim().toLowerCase();

    if (!correo) {
      mostrarResultadoTemporal({ tipo: "error", mensaje: "QR inválido o sin correo." }, scannerInstance);
      return;
    }

    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

    if (!navigator.onLine) {
      guardarOffline(correo, todayStr);
      mostrarResultadoTemporal({ tipo: "offline", mensaje: `Guardado localmente: ${correo}` }, scannerInstance);
      return;
    }

    try {
      const { data: usuario, error: errUsuario } = await supabase
        .from("base_datos_participantes")
        .select("nombre, apellido")
        .eq("correo", correo)
        .single();

      if (!usuario || errUsuario) {
        mostrarResultadoTemporal({ tipo: "error", mensaje: `Correo no registrado: ${correo}` }, scannerInstance);
        return;
      }

      const { data: checkinPrevio } = await supabase
        .from("check_ins")
        .select("id")
        .eq("correo_usuario", correo)
        .eq("dia_evento", todayStr)
        .single();

      if (checkinPrevio) {
        mostrarResultadoTemporal({ tipo: "error", mensaje: "Ya registró ingreso hoy." }, scannerInstance);
        return;
      }

      const { error: errInsert } = await supabase
        .from("check_ins")
        .insert([{ correo_usuario: correo, dia_evento: todayStr, estado: "ingresó" }]);

      if (errInsert) throw errInsert;

      mostrarResultadoTemporal({ 
        tipo: "exito", 
        mensaje: "Ingreso exitoso", 
        nombre: `${usuario.nombre} ${usuario.apellido}` 
      }, scannerInstance);

    } catch (error: any) {
      mostrarResultadoTemporal({ tipo: "error", mensaje: "Error: " + error.message }, scannerInstance);
    }
  };

  // Muestra el resultado por 2.5 segundos y reinicia la cámara automáticamente
  const mostrarResultadoTemporal = (res: any, scannerInstance: Html5Qrcode) => {
    setResultado(res);
    setTimeout(() => {
      setResultado(null);
      if (scannerInstance.getState() === 2) { // 2 = PAUSED
        scannerInstance.resume();
      }
    }, 2500);
  };

  const guardarOffline = (correo: string, fecha: string) => {
    const offlineData = JSON.parse(localStorage.getItem("offline_checkins") || "[]");
    offlineData.push({ correo, dia_evento: fecha, timestamp: new Date().toISOString() });
    localStorage.setItem("offline_checkins", JSON.stringify(offlineData));
    setPendientesSync(offlineData);
  };

  // ... (Mantener la función sincronizarDatos igual que antes) ...
  const sincronizarDatos = async () => { /* ... mismo código ... */ };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      
      {/* Sincronización Offline */}
      {pendientesSync.length > 0 && (
        <div className="mb-6 bg-orange-100 text-orange-800 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-5 h-5" />
            <span className="font-bold text-sm">Faltan {pendientesSync.length} por sincronizar.</span>
          </div>
          <button onClick={sincronizarDatos} className="flex items-center space-x-1 bg-orange-500 text-white px-3 py-2 rounded-lg text-sm font-bold">
            <RefreshCw className="w-4 h-4" /><span>Sincronizar</span>
          </button>
        </div>
      )}

      {/* Contenedor de Cámara y Feedback */}
      <div className="relative overflow-hidden rounded-xl bg-black min-h-87.5 flex items-center justify-center">
        
        {/* El div donde se renderiza la cámara */}
        <div id="qr-reader-custom" className="w-full h-full" style={{ display: resultado ? 'none' : 'block' }}></div>

        {/* Overlay de Resultado (Oculta la cámara temporalmente) */}
        {resultado && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 bg-gray-50/95 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
            {resultado.tipo === "exito" && <CheckCircle className="w-20 h-20 text-green-500 mb-4" />}
            {resultado.tipo === "error" && <XCircle className="w-20 h-20 text-red-500 mb-4" />}
            {resultado.tipo === "offline" && <WifiOff className="w-20 h-20 text-orange-500 mb-4" />}
            
            {resultado.nombre && <h3 className="text-2xl font-extrabold text-gray-800 mb-2 text-center">{resultado.nombre}</h3>}
            <p className={`text-center font-bold text-lg ${resultado.tipo === "error" ? "text-red-600" : "text-gray-600"}`}>
              {resultado.mensaje}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}