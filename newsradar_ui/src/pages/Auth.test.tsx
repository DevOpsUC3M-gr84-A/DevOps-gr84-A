// src/pages/Auth.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Auth } from './Auth';

global.fetch = jest.fn();

describe('Página de Autenticación', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('permite cambiar entre Iniciar Sesión y Registro', () => {
    render(<Auth />);
    
    const toggleButton = screen.getByText(/Regístrate ahora/i);
    fireEvent.click(toggleButton);
    
    expect(screen.getByText(/Crear Cuenta/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ej: Juan/i)).toBeInTheDocument();
  });

  test('guarda datos en localStorage tras un login exitoso', async () => {
    const mockResponse = {
      access_token: 'token-123',
      user_id: 1,
      role_ids: [1]
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: 'test@test.com' }
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'password123' }
    });

    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('token-123');
      expect(localStorage.getItem('userRoles')).toBe(JSON.stringify([1]));
    });
  });

  test('muestra alerta si el email no es válido', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: 'email-invalido' }
    });
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    expect(alertSpy).toHaveBeenCalledWith("Email no válido");
    alertSpy.mockRestore();
  });

  test('muestra alerta si la contraseña es muy corta', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: 'test@test.com' }
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: '123' } // Menos de 6 caracteres
    });
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    expect(alertSpy).toHaveBeenCalledWith("La contraseña debe tener al menos 6 caracteres");
    alertSpy.mockRestore();
  });

  test('muestra el error devuelto por la API si el login falla', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Credenciales inválidas' }),
    });

    render(<Auth />);
    
    // Rellenar datos mínimos
    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Credenciales inválidas');
    });

    alertSpy.mockRestore();
  });
});
