import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Auth } from './Auth';
import { useAuth } from '../hooks/useAuth';

jest.mock('../hooks/useAuth');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockLogin = jest.fn();

describe('Página de Autenticación', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      login: mockLogin,
      logout: jest.fn()
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as unknown as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('permite cambiar entre Iniciar Sesión y Registro', () => {
    render(<Auth />);

    fireEvent.click(screen.getByText(/Regístrate ahora/i));

    expect(screen.getByText(/Crear Cuenta/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ej: Juan/i)).toBeInTheDocument();
  });

  test('envía login por fetch y llama login del hook tras éxito', async () => {
    const mockResponse = {
      access_token: 'token-123',
      user_id: 1,
      role_ids: [1],
    };

    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as unknown as Response);

    const { container } = render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'password123' },
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
          body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
        })
      );
      expect(mockLogin).toHaveBeenCalledWith(mockResponse);
    });
  });

  test('envía registro por fetch y muestra pantalla de éxito', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'ok' }),
    } as unknown as Response);

    const { container } = render(<Auth />);

    fireEvent.click(screen.getByText(/Regístrate ahora/i));

    fireEvent.change(screen.getByPlaceholderText(/Ej: Juan/i), {
      target: { value: 'Juan' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Ej: Pérez/i), {
      target: { value: 'Pérez' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Nombre de tu empresa\/institución/i), {
      target: { value: 'UC3M' },
    });
    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'password123' },
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
            role_ids: [2],
          }),
        })
      );
    });

    expect(await screen.findByRole('status')).toHaveTextContent('Registro exitoso');
  });

  test('muestra error inline si el email no es válido', async () => {
    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: 'email-invalido' },
    });
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email no válido');
  });

  test('muestra error inline si la contraseña es muy corta', async () => {
    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: '123' },
    });
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña debe tener al menos 6 caracteres');
  });

  test('muestra el error devuelto por la API si el login falla', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Credenciales inválidas' }),
    } as unknown as Response);

    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas');
  });

  test('muestra enlace de recuperación apuntando a /forgot-password', () => {
    render(<Auth />);

    const forgotLink = screen.getByRole('link', { name: /¿Has olvidado tu contraseña\?/i });

    expect(forgotLink).toHaveAttribute('href', '/forgot-password');
  });
});

describe('Casos de error de API y Red', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      login: mockLogin,
      logout: jest.fn(),
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as unknown as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Error 422: formatea detail[] y lo muestra', async () => {
    const errorData = {
      detail: [{ loc: ['body', 'email'], msg: 'invalid email' }],
    };
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => errorData,
    } as unknown as Response);

    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    expect(await screen.findByRole('alert')).toHaveTextContent('email: invalid email');
  });

  test('Error 500: usa JSON.stringify(detail)', async () => {
    const errorData = { detail: { error: 'Internal server error' } };
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => errorData,
    } as unknown as Response);

    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    expect(await screen.findByRole('alert')).toHaveTextContent(JSON.stringify(errorData.detail));
  });

  test('Error de red: muestra mensaje de excepción en UI', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network Error'));

    render(<Auth />);

    fireEvent.change(screen.getByPlaceholderText(/tu@organizacion.com/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText(/Entrar al sistema/i));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network Error');
  });
});
