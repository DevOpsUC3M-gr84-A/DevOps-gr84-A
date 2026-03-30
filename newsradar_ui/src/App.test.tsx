import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
  })
) as jest.Mock;

describe('Componente Raíz App', () => {

  test('renderiza el sidebar con el logo y el nombre de la marca', () => {
    render(<App />);
    
    // Verificar que el logo existe por su texto alternativo (alt)
    const logo = screen.getByAltText(/NewsRadar Logo/i);
    expect(logo).toBeInTheDocument();
    
    // Verificar que el nombre "NewsRadar" aparece en el sidebar
    const brandName = screen.getByText(/NewsRadar/i);
    expect(brandName).toBeInTheDocument();
  });

  test('renderiza los enlaces de navegación principales', () => {
    render(<App />);
    
    // Comprobar que las secciones del menú están presentes (añadir más en el futuro)
    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Mis Alertas/i)).toBeInTheDocument();
    expect(screen.getByText(/Configuración/i)).toBeInTheDocument();
  });

  test('renderiza el componente de gestión de alertas dentro del contenido principal', () => {
    render(<App />);
    
    // Si aparece el título de la página, AlertsManagement se ha montado bien
    const pageTitle = screen.getByText(/Gestión de Alertas/i);
    expect(pageTitle).toBeInTheDocument();
  });
});
