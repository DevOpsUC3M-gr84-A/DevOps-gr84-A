// src/App.tsx
import React from 'react';
import './App.css';
import { Bell, Settings, Radar } from 'lucide-react';
import { AlertsManagement } from './pages/AlertsManagement';

function App() {
  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand-section">
          <img 
            src="/newsradar-logo.png" 
            alt="NewsRadar Logo" 
            style={{ 
              width: '32px', 
              height: '32px', 
              marginRight: '-4px',
              marginLeft: '-8px',
              objectFit: 'contain'
            }} 
          />
          <span>NewsRadar</span>
        </div>
        <nav>
          <ul className="nav-links">
            <li>
              {/* Cambiado href="#" por href="/" */}
              <a href="/" className="nav-item">
                <Radar size={20} /><span>Dashboard</span>
              </a>
            </li>
            <li>
              {/* Cambiado href="#" por href="/alertas" */}
              <a href="/alertas" className="nav-item active">
                <Bell size={20} /><span>Mis Alertas</span>
              </a>
            </li>
            <li>
              {/* Cambiado href="#" por href="/configuracion" */}
              <a href="/configuracion" className="nav-item">
                <Settings size={20} /><span>Configuración</span>
              </a>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <AlertsManagement />
      
    </div>
  );
}

export default App;