import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertForm } from './AlertForm';

// Mock del fetch global
global.fetch = jest.fn();

describe('AlertForm Component', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'fake-token');
    localStorage.setItem('userId', '1');
    
    // Silenciar los alerts del navegador para que no pausen el test
    window.alert = jest.fn();
    // Silenciar console.log
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  test('no renderiza nada si isOpen es false', () => {
    render(<AlertForm isOpen={false} onClose={mockOnClose} onSubmit={mockOnSubmit} />);
    expect(screen.queryByText('CREAR NUEVA ALERTA')).not.toBeInTheDocument();
  });

  test('renderiza el formulario correctamente si isOpen es true', () => {
    render(<AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);
    expect(screen.getByText('CREAR NUEVA ALERTA')).toBeInTheDocument();
  });

  test('llama a la función onClose al hacer clic en CANCELAR', () => {
    render(<AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);
    
    fireEvent.click(screen.getByText('CANCELAR'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('limpia los espacios, separa por comas y llama a onSubmit con el payload correcto', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

    render(<AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    const inputNombre = screen.getByPlaceholderText('Ej: TENDENCIAS TECH 2026');
    const inputDesc = screen.getByPlaceholderText('Ej: IA, ROBÓTICA, CHIPS');

    fireEvent.change(inputNombre, { target: { value: 'Alerta Compleja' } });
    
    // string sucio: con espacios extra y comas seguidas
    fireEvent.change(inputDesc, { target: { value: '  IA , robots, , chips  ' } });

    fireEvent.click(screen.getByText('GUARDAR ALERTA'));

    // Esperar a que la petición fetch termine
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Verificar que onSubmit se llamó con el array  limpio
    expect(mockOnSubmit).toHaveBeenCalledWith({
      name: 'Alerta Compleja',
      descriptors: ['IA', 'robots', 'chips'],
      cron_expression: '0 * * * *'
    });
  });

  test('muestra un alert si se intenta enviar sin estar logueado', async () => {
    // Borrar el localStorage para simular que no hay sesión
    localStorage.clear();

    render(<AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    // Rellenar algo básico
    fireEvent.change(screen.getByPlaceholderText('Ej: TENDENCIAS TECH 2026'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: IA, ROBÓTICA, CHIPS'), { target: { value: 'Test' } });

    fireEvent.click(screen.getByText('GUARDAR ALERTA'));

    // El fetch no debería llamarse
    expect(global.fetch).not.toHaveBeenCalled();
    
    // Debería saltar el aviso del navegador
    expect(window.alert).toHaveBeenCalledWith("No estás logueado o falta tu ID. Por favor, inicia sesión.");
  });
});
