import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertForm } from './AlertForm';

describe('AlertForm Component', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
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

  test('limpia los espacios, separa por comas y llama a onSubmit con el payload correcto', () => {
    // Ya no necesitamos mockear fetch aquí porque el componente no lo usa
    render(<AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    const inputNombre = screen.getByPlaceholderText('Ej: TENDENCIAS TECH 2026');
    const inputDesc = screen.getByPlaceholderText('Ej: IA, ROBÓTICA, CHIPS');

    fireEvent.change(inputNombre, { target: { value: 'Alerta Compleja' } });
    
    // String sucio: con espacios extra y comas seguidas
    fireEvent.change(inputDesc, { target: { value: '  IA , robots, , chips  ' } });

    fireEvent.click(screen.getByText('GUARDAR ALERTA'));

    // Verificar que onSubmit se llamó con el array limpio y formateado
    expect(mockOnSubmit).toHaveBeenCalledWith({
      name: 'Alerta Compleja',
      descriptors: ['IA', 'robots', 'chips'],
      cron_expression: '0 * * * *'
    });
  });

  test('limpia los inputs después de enviar el formulario', () => {
    render(<AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    const inputNombre = screen.getByPlaceholderText('Ej: TENDENCIAS TECH 2026');
    fireEvent.change(inputNombre, { target: { value: 'Test' } });
    
    fireEvent.click(screen.getByText('GUARDAR ALERTA'));

    // Al volver a renderizar, los campos deberían estar vacíos
    expect(inputNombre).toHaveValue('');
  });
});
