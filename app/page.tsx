import Head from "next/head";
import EvaluationForm from "../components/EvaluationForm";

export default function Home() {
  return (
    <main className="min-h-screen bg-white relative overflow-hidden font-sans">
      <Head>
        <title>ACOFI - Evaluación de Ponencias</title>
      </Head>

      {/* Fondo curvo ajustado al diseño original */}
      <div 
        className="absolute top-0 left-0 w-full h-[40vh] bg-[#c81474] z-0"
        style={{
          clipPath: "ellipse(120% 100% at 50% 0%)",
        }}
      ></div>

      <EvaluationForm />
    </main>
  );
}