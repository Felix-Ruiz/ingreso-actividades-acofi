"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { UserPlus, Trash2, ShieldAlert, ShieldCheck, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function UserManagement() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  
  const [nuevoCorreo, setNuevoCorreo] = useState("");
  const [nuevoPassword, setNuevoPassword] = useState("");
  const [nuevoRol, setNuevoRol] = useState<"Admin" | "Master">("Admin");
  const [procesando, setProcesando] = useState(false);

  // UI Premium
  const [toast, setToast] = useState<{ tipo: "exito" | "error"; mensaje: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ correo: string; titulo: string; mensaje: string } | null>(null);

  const mostrarToast = (tipo: "exito" | "error", mensaje: string) => {
    setToast({ tipo, mensaje });
    setTimeout(() => setToast(null), 5000);
  };

  const cargarUsuarios = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from("staff_roles")
        .select("*")
        .order("rol", { ascending: false }); 
      
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
    if (!nuevoCorreo.trim() || !nuevoPassword.trim()) {
      mostrarToast("error", "Debes ingresar un correo y una contraseña.");
      return;
    }

    setProcesando(true);
    const correoLimpio = nuevoCorreo.trim().toLowerCase();

    try {
      const { error: authError } = await supabase.auth.signUp({
        email: correoLimpio,
        password: nuevoPassword,
      });

      if (authError && !authError.message.includes("already registered")) {
        throw new Error("Credenciales: " + authError.message);
      }

      const { error: roleError } = await supabase
        .from("staff_roles")
        .upsert([{ correo: correoLimpio, rol: nuevoRol }]);

      if (roleError) throw roleError;

      setNuevoCorreo("");
      setNuevoPassword("");
      setNuevoRol("Admin");
      cargarUsuarios();
      
      mostrarToast("exito", `Usuario ${correoLimpio} agregado exitosamente como ${nuevoRol}.`);
    } catch (error: any) {
      mostrarToast("error", "Error: " + error.message);
    } finally {
      setProcesando(false);
    }
  };

  const confirmarYeliminar = async () => {
    if (!confirmModal) return;
    const correo = confirmModal.correo;
    setConfirmModal(null);

    try {
      const { error } = await supabase
        .from("staff_roles")
        .delete()
        .eq("correo", correo);

      if (error) throw error;
      
      mostrarToast("exito", "Acceso revocado exitosamente.");
      cargarUsuarios();
    } catch (error: any) {
      mostrarToast("error", "Error al revocar acceso: " + error.message);
    }
  };

  return (
    <div className="w-full space-y-6 relative">
      
      {/* Toast Premium */}
      {toast && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-70 px-6 py-3 rounded-full shadow-2xl flex items-center space-x-2 font-bold text-sm animate-in fade-in slide-in-from-top-5 ${toast.tipo === "exito" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.tipo === "exito" ? <CheckCircle className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
          <span>{toast.mensaje}</span>
        </div>
      )}

      {/* Modal Confirmación Premium */}
      {confirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-6 mx-auto">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-extrabold text-center text-gray-900 mb-2">{confirmModal.titulo}</h3>
              <p className="text-center text-gray-600 text-sm mb-8 font-medium leading-relaxed">{confirmModal.mensaje}</p>
              <div className="flex space-x-3">
                <button 
                  onClick={() => setConfirmModal(null)} 
                  className="flex-1 bg-white border-2 border-gray-200 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmarYeliminar} 
                  className="flex-1 bg-red-600 text-white font-bold py-3.5 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30"
                >
                  Revocar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulario de Alta */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <UserPlus className="w-5 h-5 mr-2 text-[#311b42]" />
          Autorizar Nuevo Staff
        </h3>
        <form onSubmit={agregarUsuario} className="flex flex-col md:flex-row gap-4">
          <input
            type="email"
            value={nuevoCorreo}
            onChange={(e) => setNuevoCorreo(e.target.value)}
            placeholder="Correo del equipo..."
            className="flex-1 border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#311b42] text-gray-900 placeholder-gray-500 bg-gray-50"
            required
          />
          <input
            type="text"
            value={nuevoPassword}
            onChange={(e) => setNuevoPassword(e.target.value)}
            placeholder="Asignar contraseña..."
            minLength={6}
            className="flex-1 border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#311b42] text-gray-900 placeholder-gray-500 bg-gray-50"
            required
          />
          <select
            value={nuevoRol}
            onChange={(e) => setNuevoRol(e.target.value as "Admin" | "Master")}
            className="border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#311b42] bg-gray-50 font-medium text-gray-900"
          >
            <option value="Admin">Administrador</option>
            <option value="Master">Master</option>
          </select>
          <button
            type="submit"
            disabled={procesando}
            className="bg-[#311b42] hover:bg-purple-950 text-white font-bold px-6 py-3 rounded-xl disabled:opacity-70 transition-colors shadow-md"
          >
            {procesando ? "Guardando..." : "Crear Staff"}
          </button>
        </form>
      </div>

      {/* Lista de Usuarios */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-bold text-gray-900">Equipo Autorizado</h3>
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
                    <p className="font-bold text-gray-900">{user.correo}</p>
                    <p className="text-xs text-gray-600 font-medium">Rol: {user.rol}</p>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmModal({
                    correo: user.correo,
                    titulo: "Revocar Acceso",
                    mensaje: `¿Estás seguro de que deseas revocar los permisos de acceso al usuario ${user.correo}?`
                  })}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Revocar acceso"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </li>
            ))}
            {usuarios.length === 0 && (
              <li className="p-8 text-center text-gray-500 font-medium">No hay usuarios autorizados configurados.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}