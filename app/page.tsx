import Head from "next/head";
import EvaluationForm from "../components/EvaluationForm";

export default function Home() {
  return (
    <main className="min-h-screen bg-white relative overflow-hidden font-sans">
      <Head>
        <title>ACOFI - Evaluación de Ponencias</title>
      </Head>

      {/* Fondo curvo color Magenta */}
      <div 
        className="absolute top-0 left-0 w-full h-[55vh] bg-[#c81474] z-0"
        style={{
          clipPath: "ellipse(150% 100% at 50% 0%)",
        }}
      ></div>

      {/* Componente Modular del Formulario */}
      <EvaluationForm />
    </main>
  );
}