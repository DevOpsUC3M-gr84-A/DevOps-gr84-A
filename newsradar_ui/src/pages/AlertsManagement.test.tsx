import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AlertsManagement } from './AlertsManagement';
import { fireEvent } from '@testing-library/react';

// Mock del fetch global
global.fetch = jest.fn();
const mockLogout = jest.fn();

beforeAll(() => {
  globalThis.alert = jest.fn();
});

describe('AlertsManagement Page', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'fake-token');
    localStorage.setItem('userId', '1');
    localStorage.setItem('userRoles', JSON.stringify([1]));

    // Respuesta por defecto
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  test('muestra el mensaje de carga vacía cuando no hay alertas', async () => {
    render(<AlertsManagement onLogout={mockLogout} />);

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

    render(<AlertsManagement onLogout={mockLogout} />);

    // Esperamos a que el estado se actualice buscando el nombre en la tabla
    const alertName = await screen.findByText('Alerta Test');
    expect(alertName).toBeInTheDocument();
  });

  test('no intenta hacer fetch si el usuario no tiene sesión', async () => {
    // Vaciar el localStorage simulando que no hay usuario logueado
    localStorage.clear();
    
    // Silenciar el console.warn temporalmente
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    render(<AlertsManagement onLogout={mockLogout} />);

    // Verificar que no se ha llamado a la API
    expect(global.fetch).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  test('abre el modal de creación al pulsar "Nueva Alerta"', async () => {
    render(<AlertsManagement onLogout={mockLogout} />);
    await screen.findByRole('table');
    // Simulamos un clic en el botón
    const botonNueva = screen.getByText(/Nueva Alerta/i);
    fireEvent.click(botonNueva);

    // Verificar que el título del modal aparece en pantalla
    expect(screen.getByText('CREAR NUEVA ALERTA')).toBeInTheDocument();
  });

  test('añade una nueva alerta a la tabla al enviar el formulario con éxito', async () => {
    // Limpiamos llamadas previas del useEffect inicial
    (global.fetch as jest.Mock).mockClear();

    // Mock para la respuesta del POST
    const mockNuevaAlerta = {
      id: 99,
      name: 'Alerta Nuclear',
      descriptors: ['Uranio', 'Energía']
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNuevaAlerta
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockNuevaAlerta]
      });

    render(<AlertsManagement onLogout={mockLogout} />);

    // Abrir modal
    fireEvent.click(screen.getByText(/Nueva Alerta/i));

    // Rellenar inputs usando selectores 
    const inputs = screen.getAllByRole('textbox'); 
    fireEvent.change(inputs[0], { target: { value: 'Alerta Nuclear' } });
    fireEvent.change(inputs[1], { target: { value: 'Uranio, Energía' } });

    // Enviar el formulario
    const botonGuardar = screen.getByRole('button', { name: /GUARDAR ALERTA/i });
    
    // Usar await act para envolver el click que dispara el fetch y el setAlertas
    await React.act(async () => {
      fireEvent.click(botonGuardar);
    });

    // Esperar a que el texto aparezca en la tabla
    const alertaEnTabla = await screen.findByText('Alerta Nuclear');
    expect(alertaEnTabla).toBeInTheDocument();
    expect(screen.getByText('Uranio, Energía')).toBeInTheDocument();

    // Verificar que el modal se cerró
    await waitFor(() => {
      expect(screen.queryByText('CREAR NUEVA ALERTA')).not.toBeInTheDocument();
    });
  });

  test('abre el modal en modo edición al pulsar Editar', async () => {
    const mockAlertas = [{ id: 5, name: 'Alerta Editable', descriptors: ['IA', 'NLP'] }];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlertas
      })
      .mockResolvedValue({
        ok: true,
        json: async () => mockAlertas
      });

    render(<AlertsManagement onLogout={mockLogout} />);

    expect(await screen.findByText('Alerta Editable')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Editar alerta Alerta Editable'));

    expect(screen.getByText('EDITAR ALERTA')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ej: TENDENCIAS TECH 2026')).toHaveValue('Alerta Editable');
  });

  test('borra una alerta cuando el usuario confirma', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const mockAlertas = [{ id: 11, name: 'Alerta Borrable', descriptors: ['IA'] }];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlertas
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

    render(<AlertsManagement onLogout={mockLogout} />);

    expect(await screen.findByText('Alerta Borrable')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Eliminar alerta Alerta Borrable'));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('¿Seguro que quieres borrar esta alerta?');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/users/1/alerts/11'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('Alerta Borrable')).not.toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  test('no borra la alerta si el usuario cancela la confirmación', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const mockAlertas = [{ id: 12, name: 'Alerta No Borrada', descriptors: ['NLP'] }];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlertas
    });

    render(<AlertsManagement onLogout={mockLogout} />);

    expect(await screen.findByText('Alerta No Borrada')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Eliminar alerta Alerta No Borrada'));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);

    confirmSpy.mockRestore();
  });

  test('maneja correctamente un error del servidor sin romper la app', async () => {
    // Simular que el backend falla al hacer GET
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    // Silenciar el console.error para no ensuciar el test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<AlertsManagement onLogout={mockLogout} />);

    // Aunque la API falle, la app debería sobrevivir y mostrar la tabla vacía
    const emptyMessage = await screen.findByText(/No hay alertas todavía/i);
    expect(emptyMessage).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  test('cierra sesión automáticamente si la API devuelve 401 (token expirado o servidor reiniciado)', async () => {
    // Simular error 401
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 401,
      ok: false
    });

    render(<AlertsManagement onLogout={mockLogout} />);

    // Esperar a que se detecte el 401 y se llame a la función de logout
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

});
