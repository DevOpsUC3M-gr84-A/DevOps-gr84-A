import React from 'react';
import { render, screen } from '@testing-library/react';
import { AlertsManagement } from './AlertsManagement';
import { fireEvent } from '@testing-library/react';

// Mock del fetch global
global.fetch = jest.fn();

describe('AlertsManagement Page', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'fake-token');
    localStorage.setItem('userId', '1');

    // Respuesta por defecto
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  test('muestra el mensaje de carga vacía cuando no hay alertas', async () => {
    render(<AlertsManagement />);

    // Mensaje predeterminado sin alertas
    const emptyMessage = await screen.findByText(/No hay alertas todavía/i);
    expect(emptyMessage).toBeInTheDocument();
  });

  test('renderiza la lista de alertas cuando la API devuelve datos', async () => {
    const mockAlertas = [
      { id: 1, name: 'Alerta Test', descriptors: ['IA', 'Robot'] }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlertas,
    });

    render(<AlertsManagement />);

    // Esperamos a que el estado se actualice buscando el nombre en la tabla
    const alertName = await screen.findByText('Alerta Test');
    expect(alertName).toBeInTheDocument();
  });

  test('no intenta hacer fetch si el usuario no tiene sesión', async () => {
    // Vaciar el localStorage simulando que no hay usuario logueado
    localStorage.clear();
    
    // Silenciar el console.warn temporalmente
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    render(<AlertsManagement />);

    // Verificar que no se ha llamado a la API
    expect(global.fetch).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  test('abre el modal de creación al pulsar "Nueva Alerta"', async () => {
    render(<AlertsManagement />);

    // Simulamos un clic en el botón
    const botonNueva = screen.getByText(/Nueva Alerta/i);
    fireEvent.click(botonNueva);

    // Verificar que el título del modal aparece en pantalla
    expect(screen.getByText('CREAR NUEVA ALERTA')).toBeInTheDocument();
  });

  test('añade una nueva alerta a la tabla al enviar el formulario con éxito', async () => {
    // Renderizar y esperar a que cargue la tabla vacía
    render(<AlertsManagement />);
    await screen.findByText(/No hay alertas todavía/i);

    // Simular la petición POST del formulario
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    // Abrir el modal
    fireEvent.click(screen.getByText(/Nueva Alerta/i));

    // Rellenar los inputs
    const inputNombre = screen.getByPlaceholderText('Ej: TENDENCIAS TECH 2026');
    const inputDesc = screen.getByPlaceholderText('Ej: IA, ROBÓTICA, CHIPS');
    
    fireEvent.change(inputNombre, { target: { value: 'Nueva Alerta Creada' } });
    fireEvent.change(inputDesc, { target: { value: 'Ciberseguridad, Hackers' } });

    // Enviar el formulario
    fireEvent.click(screen.getByText('GUARDAR ALERTA'));

    // Verificar que la nueva alerta aparece en la tabla
    const nuevaAlerta = await screen.findByText('Nueva Alerta Creada');
    expect(nuevaAlerta).toBeInTheDocument();
    expect(screen.getByText('Ciberseguridad, Hackers')).toBeInTheDocument();
  });

  test('maneja correctamente un error del servidor sin romper la app', async () => {
    // Simular que el backend falla al hacer GET
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    // Silenciar el console.error para no ensuciar el test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<AlertsManagement />);

    // Aunque la API falle, la app debería sobrevivir y mostrar la tabla vacía
    const emptyMessage = await screen.findByText(/No hay alertas todavía/i);
    expect(emptyMessage).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

});
