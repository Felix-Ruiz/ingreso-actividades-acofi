"use client";

import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { supabase } from "../lib/supabase";
import { CheckCircle, XCircle, WifiOff, RefreshCw } from "lucide-react";

export default function QRScanner() {
  const [escaneando, setEscaneando] = useState(true);
  const [resultado, setResultado] = useState<{ tipo: "exito" | "error" | "offline"; mensaje: string; nombre?: string } | null>(null);
  const [pendientesSync, setPendientesSync] = useState<string[]>([]);

  useEffect(() => {
    // Cargar pendientes offline al iniciar
    const offlineData = JSON.parse(localStorage.getItem("offline_checkins") || "[]");
    setPendientesSync(offlineData);

    if (escaneando) {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
        false
      );

      scanner.render(onScanSuccess, onScanFailure);

      return () => {
        scanner.clear().catch(console.error);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escaneando]);

  const extraerCorreoVCARD = (vcard: string) => {
    // Busca la línea del EMAIL y extrae lo que está después de los dos puntos
    const match = vcard.match(/EMAIL[^:]*:([^\n\r]+)/i);
    return match ? match[1].trim().toLowerCase() : null;
  };

  const onScanFailure = (error: any) => {
    // Ignoramos errores de lectura continuos de la cámara
  };

  const onScanSuccess = async (textoDecodificado: string) => {
    setEscaneando(false);
    
    let correo = textoDecodificado.includes("BEGIN:VCARD") 
      ? extraerCorreoVCARD(textoDecodificado) 
      : textoDecodificado.trim().toLowerCase(); // Por si escanean un QR que solo tenga el correo

    if (!correo) {
      setResultado({ tipo: "error", mensaje: "No se encontró un correo válido en el código QR." });
      return;
    }

    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

    // Verificar conexión a internet
    if (!navigator.onLine) {
      guardarOffline(correo, todayStr);
      return;
    }

    try {
      // 1. Verificar si el usuario existe en baseDatos
      const { data: usuario, error: errUsuario } = await supabase
        .from("base_datos_participantes")
        .select("nombre, apellido")
        .eq("correo", correo)
        .single();

      if (!usuario || errUsuario) {
        setResultado({ tipo: "error", mensaje: `El correo ${correo} no está registrado en el evento.` });
        return;
      }

      // 2. Verificar si ya tiene check-in hoy
      const { data: checkinPrevio } = await supabase
        .from("check_ins")
        .select("id")
        .eq("correo_usuario", correo)
        .eq("dia_evento", todayStr)
        .single();

      if (checkinPrevio) {
        setResultado({ tipo: "error", mensaje: "Este participante ya registró su ingreso el día de hoy." });
        return;
      }

      // 3. Registrar el ingreso
      const { error: errInsert } = await supabase
        .from("check_ins")
        .insert([{ correo_usuario: correo, dia_evento: todayStr, estado: "ingresó" }]);

      if (errInsert) throw errInsert;

      setResultado({ 
        tipo: "exito", 
        mensaje: "Ingreso registrado correctamente para hoy.", 
        nombre: `${usuario.nombre} ${usuario.apellido}` 
      });

    } catch (error: any) {
      setResultado({ tipo: "error", mensaje: "Error del servidor: " + error.message });
    }
  };

  const guardarOffline = (correo: string, fecha: string) => {
    const offlineData = JSON.parse(localStorage.getItem("offline_checkins") || "[]");
    const nuevoRegistro = { correo, dia_evento: fecha, timestamp: new Date().toISOString() };
    offlineData.push(nuevoRegistro);
    localStorage.setItem("offline_checkins", JSON.stringify(offlineData));
    setPendientesSync(offlineData);
    setResultado({ 
      tipo: "offline", 
      mensaje: `Sin conexión. Ingreso de ${correo} guardado localmente para sincronizar luego.` 
    });
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
        // Intentar registrar (ignoramos errores de duplicados silenciosamente en esta fase)
        await supabase.from("check_ins").insert([{ 
          correo_usuario: reg.correo, 
          dia_evento: reg.dia_evento, 
          estado: "ingresó" 
        }]);
        sincronizados++;
      } catch (e) {
        console.error("Error sincronizando", reg, e);
      }
    }

    localStorage.removeItem("offline_checkins");
    setPendientesSync([]);
    alert(`Se sincronizaron ${sincronizados} registros exitosamente.`);
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      
      {/* Sincronización Offline */}
      {pendientesSync.length > 0 && (
        <div className="mb-6 bg-orange-100 text-orange-800 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-5 h-5" />
            <span className="font-bold text-sm">Tienes {pendientesSync.length} ingresos sin sincronizar.</span>
          </div>
          <button 
            onClick={sincronizarDatos}
            className="flex items-center space-x-1 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-bold transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Sincronizar</span>
          </button>
        </div>
      )}

      {/* Visor de Cámara */}
      <div className="mb-6 relative overflow-hidden rounded-xl bg-black">
        {escaneando ? (
          <div id="qr-reader" className="w-full"></div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 bg-gray-50 min-h-75">
            {resultado?.tipo === "exito" && <CheckCircle className="w-16 h-16 text-green-500 mb-4" />}
            {resultado?.tipo === "error" && <XCircle className="w-16 h-16 text-red-500 mb-4" />}
            {resultado?.tipo === "offline" && <WifiOff className="w-16 h-16 text-orange-500 mb-4" />}
            
            {resultado?.nombre && (
              <h3 className="text-xl font-extrabold text-gray-800 mb-2 text-center">
                {resultado.nombre}
              </h3>
            )}
            <p className={`text-center font-bold ${
              resultado?.tipo === "error" ? "text-red-600" : "text-gray-600"
            }`}>
              {resultado?.mensaje}
            </p>

            <button
              onClick={() => {
                setResultado(null);
                setEscaneando(true);
              }}
              className="mt-6 bg-[#311b42] text-white font-bold py-3 px-8 rounded-xl hover:bg-purple-950 transition-colors shadow-md"
            >
              Escanear siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}