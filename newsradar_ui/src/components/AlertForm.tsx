import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AlertFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (datos: any) => void;
}

export const AlertForm: React.FC<AlertFormProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [descriptors, setDescriptors] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Convertimos el string "IA, chips, robots" en un array real: ["IA", "chips", "robots"]
    const descriptoresArray = descriptors
      .split(',')
      .map(palabra => palabra.trim())
      .filter(palabra => palabra !== '');

    // 2. Preparamos el payload exacto que pide Pydantic en router.py
    const payload = {
      name: name,
      descriptors: descriptoresArray,
      cron_expression: "0 * * * *" // Valor por defecto obligatorio para que no falle. El RF01 ya lo cambiará.
    };

    try {
      // OJO: Asumo que el user_id es 1 (el admin inicial) para esta prueba. 
      // En el futuro deberías coger el ID del usuario logueado.
      const userId = 1; 
      
      const response = await fetch(`http://localhost:8000/api/v1/users/${userId}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Descomenta esto y ajusta cómo guardáis el token si te da un error 401 Unauthorized
          // 'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      console.log("¡Alerta creada con éxito!");
      
      onSubmit(payload);
      setName('');
      setDescriptors('');
      
    } catch (error) {
      console.error("Hubo un problema de conexión:", error);
      alert("No se pudo crear la alerta. Revisa tu backend.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>CREAR NUEVA ALERTA</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>NOMBRE DE LA ALERTA</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Ej: TENDENCIAS TECH 2026"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>DESCRIPTORES (SEPARADOS POR COMA)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Ej: IA, ROBÓTICA, CHIPS"
              value={descriptors}
              onChange={e => setDescriptors(e.target.value)}
              required
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '0.25rem' }}>
              Las palabras clave se separan por comas
            </p>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>CANCELAR</button>
            <button type="submit" className="btn-submit">GUARDAR ALERTA</button>
          </div>
        </form>
      </div>
    </div>
  );
};
