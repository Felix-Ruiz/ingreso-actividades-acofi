"use client";

import { useState } from "react";
import Head from "next/head";

export default function Home() {
  const [idioma, setIdioma] = useState<"EN" | "ES">("EN");
  const [email, setEmail] = useState("");
  const [paperCode, setPaperCode] = useState("");
  const [rating, setRating] = useState("");

  const textos = {
    EN: {
      title: "Paper Evaluation",
      emailLabel: "Registered Email",
      paperLabel: "Paper Code",
      ratingLabel: "Rating (0-1000)",
      submit: "Submit rating",
    },
    ES: {
      title: "Evaluación de Ponencia",
      emailLabel: "Correo Registrado",
      paperLabel: "Código de Ponencia",
      ratingLabel: "Calificación (0-1000)",
      submit: "Enviar calificación",
    },
  };

  const t = textos[idioma];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Aquí implementaremos la lógica de Supabase en el futuro
    console.log("Enviando:", { email, paperCode, rating });
  };

  return (
    <main className="min-h-screen bg-white relative overflow-hidden font-sans">
      <Head>
        <title>ACOFI - {t.title}</title>
      </Head>

      {/* Fondo curvo color Magenta */}
      <div 
        className="absolute top-0 left-0 w-full h-[55vh] bg-[#c81474] z-0"
        style={{
          clipPath: "ellipse(150% 100% at 50% 0%)",
        }}
      ></div>

      {/* Switch de Idiomas */}
      <div className="absolute top-6 right-6 z-20">
        <div className="flex bg-white rounded-full shadow-md p-1">
          <button
            onClick={() => setIdioma("EN")}
            className={`px-4 py-1 text-sm font-bold rounded-full transition-colors ${
              idioma === "EN" ? "bg-[#c81474] text-white" : "bg-transparent text-gray-500"
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setIdioma("ES")}
            className={`px-4 py-1 text-sm font-bold rounded-full transition-colors ${
              idioma === "ES" ? "bg-[#c81474] text-white" : "bg-transparent text-gray-500"
            }`}
          >
            ES
          </button>
        </div>
      </div>

      {/* Contenedor Principal */}
      <div className="relative z-10 flex flex-col items-center pt-24 px-4 w-full max-w-md mx-auto">
        
        {/* Logo Circular */}
        <div className="w-24 h-24 bg-white rounded-full shadow-lg flex items-center justify-center mb-6">
          <div className="w-12 h-12 flex space-x-1">
            <div className="w-3 h-full bg-yellow-400 transform -skew-y-12 rounded-sm"></div>
            <div className="w-3 h-full bg-blue-600 transform skew-y-12 rounded-sm"></div>
            <div className="w-3 h-full bg-orange-500 transform -skew-y-12 rounded-sm"></div>
          </div>
        </div>

        {/* Título */}
        <h1 className="text-3xl font-extrabold text-[#c81474] mb-8 text-center">
          {t.title}
        </h1>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailLabel}
              className="w-full px-5 py-4 rounded-xl shadow-md border-0 focus:ring-2 focus:ring-[#c81474] outline-none text-gray-700 bg-white"
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
              className="w-full px-5 py-4 rounded-xl shadow-md border-0 focus:ring-2 focus:ring-[#c81474] outline-none text-gray-700 bg-white"
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
              className="w-full px-5 py-4 rounded-xl shadow-md border-0 focus:ring-2 focus:ring-[#c81474] outline-none text-gray-700 bg-white"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#c81474] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-pink-800 transition-colors mt-4"
          >
            {t.submit}
          </button>
        </form>
      </div>
    </main>
  );
}