"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function EvaluationForm() {
  const [idioma, setIdioma] = useState<"EN" | "ES">("EN");
  const [email, setEmail] = useState("");
  const [paperCode, setPaperCode] = useState("");
  const [rating, setRating] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);

  const textos = {
    EN: {
      title: "Paper Evaluation",
      emailLabel: "Registered Email",
      paperLabel: "Paper Code",
      ratingLabel: "Rating (0-1000)",
      submit: "Submit rating",
      uNotExist: "Authentication Error: Email not found in the records.",
      noCheckin: "Access Denied: No valid check-in for today.",
      pNotExist: "Search Error: Paper code not found.",
      dateInvalid: "Access Denied: Evaluation for this paper is not scheduled for today.",
      already: "System Alert: This paper has already been evaluated by your Email.",
      success: "Process Completed: Evaluation recorded for ",
      sysError: "System Error: Please try again.",
    },
    ES: {
      title: "Evaluación de Ponencia",
      emailLabel: "Correo Registrado",
      paperLabel: "Código de Ponencia",
      ratingLabel: "Calificación (0-1000)",
      submit: "Enviar calificación",
      uNotExist: "Error de Autenticación: Email no encontrado en los registros.",
      noCheckin: "Acceso Denegado: No cuenta con registro de ingreso válido para hoy.",
      pNotExist: "Error de Búsqueda: Código de ponencia no encontrado.",
      dateInvalid: "Acceso Denegado: La evaluación de esta ponencia no está programada para hoy.",
      already: "Alerta del Sistema: Esta ponencia ya ha sido evaluada con su Email.",
      success: "Proceso Completado: Evaluación registrada para ",
      sysError: "Error del Sistema: Por favor intente de nuevo.",
    },
  };

  const t = textos[idioma];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje(null);

    const correoLimpio = email.trim().toLowerCase();
    const codigoLimpio = paperCode.trim();
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

    try {
      // 1. Validar existencia del usuario y obtener su rol
      const { data: usuario, error: errUsuario } = await supabase
        .from("base_datos_participantes")
        .select("nombre, rol")
        .eq("correo", correoLimpio)
        .single();

      if (!usuario || errUsuario) throw new Error(t.uNotExist);

      // 2. Si el rol NO es Moderador, exigimos el check-in diario
      if (usuario.rol !== "Moderador") {
        const { data: checkin } = await supabase
          .from("check_ins")
          .select("id")
          .eq("correo_usuario", correoLimpio)
          .eq("dia_evento", todayStr)
          .eq("estado", "ingresó")
          .single();

        if (!checkin) throw new Error(t.noCheckin);
      }

      // 3. Validar Ponencia y Fecha
      const { data: ponencia, error: errPonencia } = await supabase
        .from("ponencias")
        .select("fecha_programada")
        .eq("codigo_ponencia", codigoLimpio)
        .single();

      if (!ponencia || errPonencia) throw new Error(t.pNotExist);
      if (ponencia.fecha_programada !== todayStr) throw new Error(t.dateInvalid);

      // 4. Validar si ya votó
      const { data: evaluacionPrevia } = await supabase
        .from("evaluaciones")
        .select("id")
        .eq("correo_usuario", correoLimpio)
        .eq("codigo_ponencia", codigoLimpio)
        .single();

      if (evaluacionPrevia) throw new Error(t.already);

      // 5. Registrar Evaluación
      const { error: errInsert } = await supabase
        .from("evaluaciones")
        .insert([
          {
            correo_usuario: correoLimpio,
            codigo_ponencia: codigoLimpio,
            calificacion: Number(rating),
          },
        ]);

      if (errInsert) throw new Error(t.sysError);

      // Éxito
      setMensaje({ tipo: "exito", texto: `${t.success}${usuario.nombre}` });
      setPaperCode("");
      setRating("");
      
    } catch (error: any) {
      setMensaje({ tipo: "error", texto: error.message || t.sysError });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 flex flex-col items-center pt-20 px-4 w-full max-w-md mx-auto">
      {/* Switch de Idiomas */}
      <div className="fixed top-6 right-6 z-20">
        <div className="flex bg-white rounded-full shadow-md p-1">
          <button
            onClick={() => { setIdioma("EN"); setMensaje(null); }}
            className={`px-4 py-1 text-sm font-bold rounded-full transition-colors ${
              idioma === "EN" ? "bg-[#c81474] text-white" : "bg-transparent text-gray-900"
            }`}
          >
            EN
          </button>
          <button
            onClick={() => { setIdioma("ES"); setMensaje(null); }}
            className={`px-4 py-1 text-sm font-bold rounded-full transition-colors ${
              idioma === "ES" ? "bg-[#c81474] text-white" : "bg-transparent text-gray-900"
            }`}
          >
            ES
          </button>
        </div>
      </div>

      {/* Logo Real (Imagen desde public/logo.png) */}
      <div className="w-24 h-24 bg-white rounded-full shadow-lg flex items-center justify-center mb-6 overflow-hidden">
        <img src="/logo.png" alt="Logo Evento" className="w-16 h-16 object-contain" />
      </div>

      {/* Título */}
      <h1 className="text-3xl font-extrabold text-[#c81474] mb-6 text-center drop-shadow-sm">
        {t.title}
      </h1>

      {/* Alertas de Sistema */}
      {mensaje && (
        <div 
          className={`w-full p-4 mb-4 rounded-xl shadow-sm text-sm font-bold text-center ${
            mensaje.tipo === "error" ? "bg-red-100 text-red-800 border border-red-200" : "bg-green-100 text-green-800 border border-green-200"
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <div className="relative">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailLabel}
            disabled={loading}
            className="w-full px-5 py-4 rounded-xl shadow-md border-0 focus:ring-2 focus:ring-[#c81474] outline-none text-gray-900 bg-white placeholder-gray-500 disabled:opacity-70"
            required
          />
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-[#c81474] text-white rounded-full flex items-center justify-center font-bold text-sm cursor-help">
            i
          </div>
        </div>

        <div>
          <input
            type="text"
            value={paperCode}
            onChange={(e) => setPaperCode(e.target.value)}
            placeholder={t.paperLabel}
            disabled={loading}
            className="w-full px-5 py-4 rounded-xl shadow-md border-0 focus:ring-2 focus:ring-[#c81474] outline-none text-gray-900 bg-white placeholder-gray-500 disabled:opacity-70 uppercase"
            required
          />
        </div>

        <div>
          <input
            type="number"
            min="0"
            max="1000"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            placeholder={t.ratingLabel}
            disabled={loading}
            className="w-full px-5 py-4 rounded-xl shadow-md border-0 focus:ring-2 focus:ring-[#c81474] outline-none text-gray-900 bg-white placeholder-gray-500 disabled:opacity-70"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#c81474] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-pink-800 transition-colors mt-4 disabled:opacity-70 flex justify-center items-center"
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            t.submit
          )}
        </button>
      </form>
    </div>
  );
}