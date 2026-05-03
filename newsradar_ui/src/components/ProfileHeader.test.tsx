import React from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileHeader } from "./ProfileHeader";

describe("ProfileHeader", () => {
  const mockOnImageUpdate = vi.fn();

  beforeEach(() => {
    mockOnImageUpdate.mockClear();
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renderiza iniciales cuando el usuario no tiene avatar subido", () => {
    render(<ProfileHeader firstName="Juan" lastName="Perez" roleLabel="Gestor" isVerified={true} onImageUpdate={mockOnImageUpdate} />);
    expect(screen.getByText("JP")).toBeInTheDocument(); // Iniciales generadas
    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.getByText("Gestor")).toBeInTheDocument();
  });

  test("renderiza imagen y botones de borrar cuando hay avatar y banner", () => {
    render(
      <ProfileHeader 
        firstName="Juan" lastName="Perez" roleLabel="Gestor" isVerified={true} 
        avatar="data:image/png;base64,avatar" 
        banner="data:image/png;base64,banner" 
        onImageUpdate={mockOnImageUpdate} 
      />
    );
    expect(screen.getByAltText("Avatar")).toHaveAttribute("src", "data:image/png;base64,avatar");
    expect(screen.getByTitle("Quitar foto")).toBeInTheDocument();
    expect(screen.getByTitle("Quitar portada")).toBeInTheDocument();
  });

  test("pide confirmación y elimina el avatar", () => {
    render(<ProfileHeader firstName="J" lastName="P" roleLabel="A" isVerified={false} avatar="avatar.jpg" onImageUpdate={mockOnImageUpdate} />);
    fireEvent.click(screen.getByTitle("Quitar foto"));
    expect(window.confirm).toHaveBeenCalled();
    expect(mockOnImageUpdate).toHaveBeenCalledWith("avatar", null);
  });

  test("pide confirmación y elimina la portada", () => {
    render(<ProfileHeader firstName="J" lastName="P" roleLabel="A" isVerified={false} banner="banner.jpg" onImageUpdate={mockOnImageUpdate} />);
    fireEvent.click(screen.getByTitle("Quitar portada"));
    expect(window.confirm).toHaveBeenCalled();
    expect(mockOnImageUpdate).toHaveBeenCalledWith("banner", null);
  });
  
  test("sube un archivo de imagen leyendo los datos", async () => {
     render(<ProfileHeader firstName="J" lastName="P" roleLabel="A" isVerified={false} onImageUpdate={mockOnImageUpdate} />);
     
     // Buscamos los inputs invisibles
     const fileInputs = document.querySelectorAll('input[type="file"]');
     const avatarInput = fileInputs[1]; // El index 1 es el del avatar
     
     // Simulamos una imagen
     const file = new File(['hola'], 'foto.png', { type: 'image/png' });
     fireEvent.change(avatarInput, { target: { files: [file] } });
     
     // El FileReader es asíncrono, hay que esperar a que termine de leer
     await waitFor(() => {
         expect(mockOnImageUpdate).toHaveBeenCalledWith("avatar", expect.any(String));
     });
  });
  test("no llama a onImageUpdate si el usuario cancela borrar el avatar", () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => false); // Simula que el usuario pulsa "Cancelar"
    render(<ProfileHeader firstName="A" lastName="B" roleLabel="C" isVerified={false} avatar="avatar.jpg" onImageUpdate={mockOnImageUpdate} />);
    
    fireEvent.click(screen.getByTitle("Quitar foto"));
    
    expect(mockOnImageUpdate).not.toHaveBeenCalled();
  });

  test("no llama a onImageUpdate si el usuario cancela borrar la portada", () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => false);
    render(<ProfileHeader firstName="A" lastName="B" roleLabel="C" isVerified={false} banner="banner.jpg" onImageUpdate={mockOnImageUpdate} />);
    
    fireEvent.click(screen.getByTitle("Quitar portada"));
    
    expect(mockOnImageUpdate).not.toHaveBeenCalled();
  });

  test("maneja el caso donde el usuario abre el explorador pero no selecciona ninguna imagen", () => {
     render(<ProfileHeader firstName="A" lastName="B" roleLabel="C" isVerified={false} onImageUpdate={mockOnImageUpdate} />);
     
     const fileInputs = document.querySelectorAll('input[type="file"]');
     const avatarInput = fileInputs[1];
     
     // Simulamos un evento change pero con un array de archivos vacío
     fireEvent.change(avatarInput, { target: { files: [] } });
     
     expect(mockOnImageUpdate).not.toHaveBeenCalled();
  });

  test("sube un archivo de imagen para la portada (banner)", async () => {
     render(<ProfileHeader firstName="J" lastName="P" roleLabel="A" isVerified={false} onImageUpdate={mockOnImageUpdate} />);
     
     const fileInputs = document.querySelectorAll('input[type="file"]');
     const bannerInput = fileInputs[0]; // El index 0 es el banner
     
     const file = new File(['hola'], 'banner.png', { type: 'image/png' });
     fireEvent.change(bannerInput, { target: { files: [file] } });
     
     await waitFor(() => {
         expect(mockOnImageUpdate).toHaveBeenCalledWith("banner", expect.any(String));
     });
  });
});
