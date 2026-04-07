import React, { useState } from 'react';
import { LogIn, UserPlus, Mail, Lock, User, Building } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
// @ts-ignore: CSS module declaration not found
import './Auth.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:8000';

export const Auth = () => {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    organization: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(formData.email)) return "Email no válido";
    if (formData.password.length < 6) return "La contraseña debe tener al menos 6 caracteres";
    if (!isLogin && (!formData.first_name || !formData.last_name || !formData.organization)) {
      return "Todos los campos de registro son obligatorios";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errorMsg = validate();
    if (errorMsg) return alert(errorMsg);

    const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
    
    const payload = isLogin 
      ? { email: formData.email, password: formData.password }
      : { 
          ...formData, 
          role_ids: [2] 
        };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        let mensajeError = 'Error en la operación';

        if (typeof data.detail === 'string') {
          mensajeError = data.detail;
        } else if (Array.isArray(data.detail)) {
          mensajeError = data.detail.map((err: any) => `${err.loc[1]}: ${err.msg}`).join('\n');
        } else if (data.detail && typeof data.detail === 'object') {
           mensajeError = JSON.stringify(data.detail);
        }

        throw new Error(mensajeError);
      }

      if (isLogin) {
        // Lógica del hook
        login({
          access_token: data.access_token,
          user_id: data.user_id,
          role_ids: data.role_ids
        });
      } else {
        alert("¡Cuenta creada! Revisa tu email para la verificación (24h) e inicia sesión.");
        setIsLogin(true);
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <header className="auth-header">
          <div className="auth-logo">
            <img 
              src={process.env.PUBLIC_URL + '/newsradar-logo.png'}
              alt="NewsRadar Logo" 
              style={{ width: '44px', height: '44px' }} 
            />
            <span>NewsRadar</span>
          </div>
          <h2>{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</h2>
          <p className="auth-subtitle">
            {isLogin ? 'Accede a tu panel de control' : 'Únete a la plataforma de monitoreo'}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="auth-form">
          
          {!isLogin && (
            <div className="form-row">
              <div className="form-group">
                <label><User size={16} /> Nombre</label>
                <input 
                  type="text" name="first_name" required 
                  placeholder="Ej: Juan" onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Apellidos</label>
                <input 
                  type="text" name="last_name" required 
                  placeholder="Ej: Pérez" onChange={handleChange}
                />
              </div>
            </div>
          )}

          {!isLogin && (
            <div className="form-group">
              <label><Building size={16} /> Organización</label>
              <input 
                type="text" name="organization" required 
                placeholder="Nombre de tu empresa/institución" onChange={handleChange}
              />
            </div>
          )}

          <div className="form-group">
            <label><Mail size={16} /> Email Corporativo</label>
            <input 
              type="email" name="email" required 
              placeholder="tu@organizacion.com" onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label><Lock size={16} /> Contraseña</label>
            <input 
              type="password" name="password" required 
              placeholder="••••••••" onChange={handleChange}
            />
          </div>

          <button type="submit" className="btn-auth-submit">
            {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
            {isLogin ? 'Entrar al sistema' : 'Crear mi cuenta'}
          </button>
        </form>

        <footer className="auth-footer">
          <p>{isLogin ? '¿No tienes cuenta todavía?' : '¿Ya tienes una cuenta?'}</p>
          <button 
            type="button" 
            onClick={() => setIsLogin(!isLogin)} 
            className="btn-toggle-auth"
          >
            {isLogin ? 'Regístrate ahora' : 'Inicia sesión aquí'}
          </button>
        </footer>
      </div>
    </div>
  );
};
