import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChangePasswordModal } from "./ChangePasswordModal";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ChangePasswordModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    mockFetch.mockClear();
    mockOnClose.mockClear();
    mockOnSuccess.mockClear();
    globalThis.localStorage.setItem("userId", "1");
  });

  test("no renderiza nada si isOpen es false", () => {
    const { container } = render(
      <ChangePasswordModal isOpen={false} onClose={mockOnClose} token="token" onSuccess={mockOnSuccess} />
    );
    expect(container.innerHTML).toBe("");
  });

  test("renderiza correctamente cuando isOpen es true", () => {
    render(<ChangePasswordModal isOpen={true} onClose={mockOnClose} token="token" onSuccess={mockOnSuccess} />);
    expect(screen.getByRole("heading", { name: "Cambiar Contraseña" })).toBeInTheDocument();
  });

  test("muestra error si las contraseñas no coinciden", async () => {
    render(<ChangePasswordModal isOpen={true} onClose={mockOnClose} token="token" onSuccess={mockOnSuccess} />);
    
    const inputs = screen.getAllByPlaceholderText("••••••••");
    fireEvent.change(inputs[1], { target: { value: "Nueva123!" } });
    fireEvent.change(inputs[2], { target: { value: "Distinta123!" } }); // Diferente a la nueva
    
    fireEvent.click(screen.getByRole("button", { name: "Actualizar Contraseña" }));
    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeInTheDocument();
  });

  test("muestra error si la nueva contraseña no es lo suficientemente fuerte", async () => {
    render(<ChangePasswordModal isOpen={true} onClose={mockOnClose} token="token" onSuccess={mockOnSuccess} />);
    
    const inputs = screen.getAllByPlaceholderText("••••••••");
    fireEvent.change(inputs[1], { target: { value: "debil" } }); // Contraseña débil
    fireEvent.change(inputs[2], { target: { value: "debil" } });
    
    fireEvent.click(screen.getByRole("button", { name: "Actualizar Contraseña" }));
    expect(await screen.findByText(/La contraseña debe tener al menos 8 caracteres/)).toBeInTheDocument();
  });

  test("muestra error si falta introducir la contraseña actual", async () => {
    render(<ChangePasswordModal isOpen={true} onClose={mockOnClose} token="token" onSuccess={mockOnSuccess} />);
    
    const inputs = screen.getAllByPlaceholderText("••••••••");
    // Dejamos la primera vacía
    fireEvent.change(inputs[1], { target: { value: "Fuerte123!" } });
    fireEvent.change(inputs[2], { target: { value: "Fuerte123!" } });
    
    fireEvent.click(screen.getByRole("button", { name: "Actualizar Contraseña" }));
    expect(await screen.findByText("Debes introducir tu contraseña actual.")).toBeInTheDocument();
  });

  test("llama al API y cierra el modal con éxito si todo está bien", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    
    render(<ChangePasswordModal isOpen={true} onClose={mockOnClose} token="token" onSuccess={mockOnSuccess} />);
    
    const inputs = screen.getAllByPlaceholderText("••••••••");
    fireEvent.change(inputs[0], { target: { value: "Actual123" } });
    fireEvent.change(inputs[1], { target: { value: "Fuerte123!" } });
    fireEvent.change(inputs[2], { target: { value: "Fuerte123!" } });
    
    fireEvent.click(screen.getByRole("button", { name: "Actualizar Contraseña" }));
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalledWith("Tu contraseña se ha actualizado correctamente.");
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  test("muestra error si el servidor (API) rechaza la petición", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ detail: "Contraseña incorrecta" }) });
    
    render(<ChangePasswordModal isOpen={true} onClose={mockOnClose} token="token" onSuccess={mockOnSuccess} />);
    
    const inputs = screen.getAllByPlaceholderText("••••••••");
    fireEvent.change(inputs[0], { target: { value: "Actual123" } });
    fireEvent.change(inputs[1], { target: { value: "Fuerte123!" } });
    fireEvent.change(inputs[2], { target: { value: "Fuerte123!" } });
    
    fireEvent.click(screen.getByRole("button", { name: "Actualizar Contraseña" }));
    
    expect(await screen.findByText("Contraseña incorrecta")).toBeInTheDocument();
  });

  test("cancela, limpia estados y cierra el modal", () => {
    render(<ChangePasswordModal isOpen={true} onClose={mockOnClose} token="token" onSuccess={mockOnSuccess} />);
    const inputs = screen.getAllByPlaceholderText("••••••••");
    fireEvent.change(inputs[0], { target: { value: "Actual123" } });
    
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mockOnClose).toHaveBeenCalled();
  });
  
test("alterna la visibilidad de todas las contraseñas al hacer clic en los ojitos", () => {
    render(<ChangePasswordModal isOpen={true} onClose={mockOnClose} token="token" onSuccess={mockOnSuccess} />);

    // Cogemos los 3 inputs de contraseña
    const inputs = screen.getAllByPlaceholderText("••••••••");

    // Validamos que por defecto todos ocultan el texto (type="password")
    expect(inputs[0]).toHaveAttribute("type", "password");
    expect(inputs[1]).toHaveAttribute("type", "password");
    expect(inputs[2]).toHaveAttribute("type", "password");

    // Buscamos todos los botones.
    // Sabemos que los 3 primeros son los ojitos, y los 2 últimos son "Cancelar" y "Actualizar"
    const buttons = screen.getAllByRole("button");
    const eyeButtonCurrent = buttons[0];
    const eyeButtonNew = buttons[1];
    const eyeButtonConfirm = buttons[2];

    // 'Contraseña actual'
    fireEvent.click(eyeButtonCurrent);
    expect(inputs[0]).toHaveAttribute("type", "text");
    fireEvent.click(eyeButtonCurrent);
    expect(inputs[0]).toHaveAttribute("type", "password");

    // 'Nueva contraseña' 
    fireEvent.click(eyeButtonNew);
    expect(inputs[1]).toHaveAttribute("type", "text");
    fireEvent.click(eyeButtonNew);
    expect(inputs[1]).toHaveAttribute("type", "password");

    // 'Confirmar nueva contraseña'
    fireEvent.click(eyeButtonConfirm);
    expect(inputs[2]).toHaveAttribute("type", "text");
    fireEvent.click(eyeButtonConfirm);
    expect(inputs[2]).toHaveAttribute("type", "password");
  });
});
