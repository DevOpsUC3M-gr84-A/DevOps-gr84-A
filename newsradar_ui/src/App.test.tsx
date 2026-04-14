import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { useAuth } from './hooks/useAuth';

jest.mock('./pages/Auth', () => ({
  Auth: () => <div>AUTH_VIEW</div>
}));

jest.mock('./pages/AlertsManagement', () => ({
  AlertsManagement: () => <div>ALERTS_VIEW</div>
}));

jest.mock('./pages/VerifyEmail', () => ({
  VerifyEmail: () => <div>VERIFY_EMAIL_VIEW</div>
jest.mock('./pages/ForgotPassword', () => ({
  ForgotPassword: () => <div>FORGOT_PASSWORD_VIEW</div>
}));

jest.mock('./pages/ResetPassword', () => ({
  ResetPassword: () => <div>RESET_PASSWORD_VIEW</div>
}));

jest.mock('./hooks/useAuth');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('Componente Raíz App', () => {
  const getItemSpy = jest.spyOn(Storage.prototype, 'getItem');
  const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem');

  beforeEach(() => {
    jest.clearAllMocks();
    getItemSpy.mockReset();
    removeItemSpy.mockReset();
    globalThis.history.pushState({}, '', '/');
    mockedUseAuth.mockReturnValue({
      login: jest.fn(),
      logout: jest.fn()
    });
  });

  test('renderiza ForgotPassword cuando pathname es /forgot-password', () => {
    globalThis.history.pushState({}, '', '/forgot-password');

    render(<App />);

    expect(screen.getByText('FORGOT_PASSWORD_VIEW')).toBeInTheDocument();
  });

  test('renderiza ResetPassword cuando pathname es /reset-password', () => {
    globalThis.history.pushState({}, '', '/reset-password');

    render(<App />);

    expect(screen.getByText('RESET_PASSWORD_VIEW')).toBeInTheDocument();
  });

  test('renderiza Auth cuando no hay token', () => {
    getItemSpy.mockReturnValueOnce(null);

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('AUTH_VIEW')).toBeInTheDocument();
  });

  test('renderiza VerifyEmail en ruta pública aunque no haya token', () => {
    getItemSpy.mockReturnValueOnce(null);

    render(
      <MemoryRouter
        initialEntries={['/verify-email?token=test']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('VERIFY_EMAIL_VIEW')).toBeInTheDocument();
  });

  test('renderiza layout protegido cuando hay token', () => {
    getItemSpy.mockReturnValueOnce('fake-token');

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText(/Cerrar Sesión/i)).toBeInTheDocument();
    expect(screen.getByText('ALERTS_VIEW')).toBeInTheDocument();
  });

  test('al cerrar sesión elimina claves y redirige', () => {
    getItemSpy.mockReturnValueOnce('fake-token');
    removeItemSpy.mockImplementation(() => {});
    const logoutSpy = jest.fn();
    mockedUseAuth.mockReturnValue({
      login: jest.fn(),
      logout: logoutSpy
    });

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText(/Cerrar Sesión/i));

    expect(removeItemSpy).toHaveBeenCalledWith('token');
    expect(removeItemSpy).toHaveBeenCalledWith('userId');
    expect(removeItemSpy).toHaveBeenCalledWith('userRoles');
    expect(removeItemSpy).toHaveBeenCalledWith('userEmail');
    expect(logoutSpy).toHaveBeenCalled();
  });

  test('renderiza los enlaces de navegación principales en modo autenticado', () => {
    getItemSpy.mockReturnValueOnce('fake-token');

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Mis Alertas/i)).toBeInTheDocument();
    expect(screen.getByText(/Configuración/i)).toBeInTheDocument();
  });

  test('renderiza marca y logo en modo autenticado', () => {
    getItemSpy.mockReturnValueOnce('fake-token');

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>
    );

    expect(screen.getByAltText(/NewsRadar Logo/i)).toBeInTheDocument();
    expect(screen.getByText(/NewsRadar/i)).toBeInTheDocument();
  });
});
