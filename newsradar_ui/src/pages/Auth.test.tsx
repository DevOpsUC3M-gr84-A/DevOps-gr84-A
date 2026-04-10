// src/pages/Auth.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Auth } from './Auth';
import { useAuth } from '../hooks/useAuth';

jest.mock('../hooks/useAuth');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockLogin = jest.fn();

describe('Página de Autenticación', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedUseAuth.mockReturnValue({
      login: mockLogin,
      logout: jest.fn()
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({})
    } as unknown as Response);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  test('permite cambiar entre Iniciar Sesión y Registro', () => {
    render(<Auth />);
    
    const toggleButton = screen.getByText(/Regístrate ahora/i);
    fireEvent.click(toggleButton);
    
    expect(screen.getByText(/Crear Cuenta/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ej: Juan/i)).toBeInTheDocument();
  });

  test('envía login por fetch y llama login del hook tras éxito', async () => {
    const mockResponse = {
      access_token: 'token-123',
      user_id: 1,
      role_ids: [1]
    };

    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as unknown as Response);

    const { container } = render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: 'test@test.com' }
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'password123' }
    });

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/login'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@test.com', password: 'password123' })
        })
      );
      expect(mockLogin).toHaveBeenCalledWith(mockResponse);
    });
  });

  test('envía registro por fetch y muestra mensaje de éxito', async () => {
    const alertSpy = jest.spyOn(globalThis, 'alert').mockImplementation(() => {});

    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'ok' })
    } as unknown as Response);

    const { container } = render(<Auth />);

    fireEvent.click(screen.getByText(/Regístrate ahora/i));

    fireEvent.change(screen.getByPlaceholderText(/Ej: Juan/i), {
      target: { value: 'Juan' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Ej: Pérez/i), {
      target: { value: 'Pérez' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Nombre de tu empresa\/institución/i), {
      target: { value: 'UC3M' }
    });
    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: 'test@test.com' }
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'password123' }
    });

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/register'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@test.com',
            password: 'password123',
            first_name: 'Juan',
            last_name: 'Pérez',
            organization: 'UC3M',
            role_ids: [2]
          })
        })
      );
      expect(alertSpy).toHaveBeenCalledWith(
        '¡Cuenta creada! Revisa tu email para la verificación (24h) e inicia sesión.'
      );
    });
  });

  test('muestra alerta si el email no es válido', () => {
    const alertSpy = jest.spyOn(globalThis, 'alert').mockImplementation(() => {});
    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: 'email-invalido' }
    });
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    expect(alertSpy).toHaveBeenCalledWith("Email no válido");
    alertSpy.mockRestore();
  });

  test('muestra alerta si la contraseña es muy corta', () => {
    const alertSpy = jest.spyOn(globalThis, 'alert').mockImplementation(() => {});
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
    const alertSpy = jest.spyOn(globalThis, 'alert').mockImplementation(() => {});
    
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Credenciales inválidas' }),
    } as unknown as Response);

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

describe('Casos de error de API y Red (Cobertura Sonar)', () => {
    // Re-configuramos el mock para estos tests específicos
    beforeEach(() => {
      jest.clearAllMocks();
      mockedUseAuth.mockReturnValue({
        login: mockLogin,
        logout: jest.fn()
      });
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({})
      } as unknown as Response);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('Error 422 (FastAPI style): formatea detail[] y muestra el alert', async () => {
      const errorData = {
        detail: [{ loc: ['body', 'email'], msg: 'invalid email' }]
      };
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => errorData,
      } as unknown as Response);
      
      const alertSpy = jest.spyOn(globalThis, 'alert').mockImplementation(() => {});

      render(<Auth />);
      
      fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByText(/Entrar al sistema/i));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('email: invalid email'));
      });
      alertSpy.mockRestore();
    });

    test('Error 500 (Object detail): usa JSON.stringify(detail) en el alert', async () => {
      const errorData = { detail: { error: 'Internal server error' } };
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => errorData,
      } as unknown as Response);
      
      const alertSpy = jest.spyOn(globalThis, 'alert').mockImplementation(() => {});

      render(<Auth />);
      
      fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByText(/Entrar al sistema/i));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(JSON.stringify(errorData.detail));
      });
      alertSpy.mockRestore();
    });

    test('Error de red (Catch): captura excepción y muestra alert con el mensaje', async () => {
      jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network Error'));
      
      const alertSpy = jest.spyOn(globalThis, 'alert').mockImplementation(() => {});

      render(<Auth />);
      
      fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByText(/Entrar al sistema/i));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Network Error');
      });
      alertSpy.mockRestore();
    });
  });


