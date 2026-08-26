import Head from "next/head";
import LoginForm from "../../components/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-50 relative overflow-hidden font-sans">
      <Head>
        <title>ACOFI - Acceso Staff</title>
      </Head>

      {/* Fondo curvo oscuro institucional */}
      <div 
        className="absolute top-0 left-0 w-full h-[45vh] bg-[#311b42] z-0"
        style={{
          clipPath: "ellipse(180% 100% at 50% 0%)",
        }}
      ></div>

      <LoginForm />
    </main>
  );
}