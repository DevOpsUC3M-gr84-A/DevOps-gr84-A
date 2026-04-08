import React, { useState } from 'react';
import { X } from 'lucide-react';

export interface AlertFormPayload {
  name: string;
  descriptors: string[];
  cron_expression: string;
}


interface AlertFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (datos: AlertFormPayload) => void;
}

export const AlertForm: React.FC<AlertFormProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [descriptors, setDescriptors] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    
    // Transformar el string de descriptores en un array limpio
    const descriptoresArray = descriptors
      .split(',')
      .map(palabra => palabra.trim())
      .filter(palabra => palabra !== '');

    // Pasar los datos al padre sin hacer fetch aquí
    onSubmit({
      name: name,
      descriptors: descriptoresArray,
      cron_expression: "0 * * * *" 
    });

    // Limpiar campos para la próxima vez
    setName('');
    setDescriptors('');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>CREAR NUEVA ALERTA</h2>
          <button onClick={onClose} className="modal-close-btn" title="Cerrar"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="alertName">NOMBRE DE LA ALERTA</label>
            <input 
              id="alertName" type="text" className="form-input" required
              placeholder="Ej: TENDENCIAS TECH 2026"
              value={name} onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="alertDescriptors">DESCRIPTORES (SEPARADOS POR COMA)</label>
            <input 
              id="alertDescriptors" type="text" className="form-input" required
              placeholder="Ej: IA, ROBÓTICA, CHIPS"
              value={descriptors} onChange={e => setDescriptors(e.target.value)}
            />
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
