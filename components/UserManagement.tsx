"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { UserPlus, Trash2, ShieldAlert, ShieldCheck } from "lucide-react";

export default function UserManagement() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevoCorreo, setNuevoCorreo] = useState("");
  const [nuevoRol, setNuevoRol] = useState<"Admin" | "Master">("Admin");
  const [procesando, setProcesando] = useState(false);

  const cargarUsuarios = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from("staff_roles")
        .select("*")
        .order("rol", { ascending: false }); // Muestra los Master primero
      
      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const agregarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoCorreo.trim()) return;

    setProcesando(true);
    const correoLimpio = nuevoCorreo.trim().toLowerCase();

    try {
      const { error } = await supabase
        .from("staff_roles")
        .upsert([{ correo: correoLimpio, rol: nuevoRol }]);

      if (error) throw error;

      setNuevoCorreo("");
      setNuevoRol("Admin");
      cargarUsuarios();
      alert(`Usuario ${correoLimpio} agregado exitosamente como ${nuevoRol}.`);
    } catch (error: any) {
      alert("Error al agregar usuario: " + error.message);
    } finally {
      setProcesando(false);
    }
  };

  const eliminarUsuario = async (correo: string) => {
    if (!window.confirm(`¿Estás seguro de revocar el acceso a ${correo}?`)) return;

    try {
      const { error } = await supabase
        .from("staff_roles")
        .delete()
        .eq("correo", correo);

      if (error) throw error;
      cargarUsuarios();
    } catch (error: any) {
      alert("Error al eliminar: " + error.message);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Formulario de Alta */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <UserPlus className="w-5 h-5 mr-2 text-[#311b42]" />
          Autorizar Nuevo Staff
        </h3>
        <form onSubmit={agregarUsuario} className="flex flex-col md:flex-row gap-4">
          <input
            type="email"
            value={nuevoCorreo}
            onChange={(e) => setNuevoCorreo(e.target.value)}
            placeholder="Correo del miembro del equipo..."
            className="flex-1 border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#311b42]"
            required
          />
          <select
            value={nuevoRol}
            onChange={(e) => setNuevoRol(e.target.value as "Admin" | "Master")}
            className="border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#311b42] bg-white font-medium text-gray-700"
          >
            <option value="Admin">Administrador (Solo lectura y escaneo)</option>
            <option value="Master">Master (Acceso total al sistema)</option>
          </select>
          <button
            type="submit"
            disabled={procesando}
            className="bg-[#311b42] hover:bg-purple-950 text-white font-bold px-6 py-3 rounded-xl disabled:opacity-70 transition-colors"
          >
            {procesando ? "Guardando..." : "Autorizar"}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-3">
          * Una vez autorizado, el usuario debe registrarse en la pantalla de Login con este mismo correo para poder acceder.
        </p>
      </div>

      {/* Lista de Usuarios */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-bold text-gray-700">Equipo Autorizado</h3>
        </div>
        {cargando ? (
          <div className="p-8 text-center text-gray-500 font-medium animate-pulse">Cargando equipo...</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {usuarios.map((user) => (
              <li key={user.correo} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-3">
                  {user.rol === "Master" ? (
                    <ShieldCheck className="w-5 h-5 text-[#c81474]" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-blue-600" />
                  )}
                  <div>
                    <p className="font-bold text-gray-800">{user.correo}</p>
                    <p className="text-xs text-gray-500 font-medium">Rol: {user.rol}</p>
                  </div>
                </div>
                <button
                  onClick={() => eliminarUsuario(user.correo)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Revocar acceso"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </li>
            ))}
            {usuarios.length === 0 && (
              <li className="p-8 text-center text-gray-500">No hay usuarios autorizados configurados.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}