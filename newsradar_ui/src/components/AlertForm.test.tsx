import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertForm } from './AlertForm';

describe('AlertForm Component', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'fake-token');
    localStorage.setItem('userId', '1');

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => []
    } as unknown as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('no renderiza nada si isOpen es false', () => {
    render(<AlertForm isOpen={false} onClose={mockOnClose} onSubmit={mockOnSubmit} />);
    expect(screen.queryByText('CREAR NUEVA ALERTA')).not.toBeInTheDocument();
  });

  test('renderiza el formulario correctamente si isOpen es true', () => {
    render(<AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);
    expect(screen.getByText('CREAR NUEVA ALERTA')).toBeInTheDocument();
  });

  test('muestra EDITAR ALERTA y precarga datos cuando initialData está informado', () => {
    render(
      <AlertForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialData={{ id: 3, nombre: 'Alerta Editada', descriptores: 'IA, Chips' }}
      />
    );

    expect(screen.getByText('EDITAR ALERTA')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ej: TENDENCIAS TECH 2026')).toHaveValue('Alerta Editada');
    expect(screen.getByPlaceholderText('Ej: IA, ROBÓTICA, CHIPS')).toHaveValue('IA, Chips');
  });

  test('llama a la función onClose al hacer clic en CANCELAR', () => {
    render(<AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);
    
    fireEvent.click(screen.getByText('CANCELAR'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('limpia los espacios, separa por comas y llama a onSubmit con el payload correcto', async () => {
    render(<AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    const inputNombre = screen.getByPlaceholderText('Ej: TENDENCIAS TECH 2026');
    const inputDesc = screen.getByPlaceholderText('Ej: IA, ROBÓTICA, CHIPS');

    fireEvent.change(inputNombre, { target: { value: 'Alerta Compleja' } });
    
    // String sucio: con espacios extra y comas seguidas
    fireEvent.change(inputDesc, { target: { value: '  IA , robots, , chips  ' } });

    await React.act(async () => {
      fireEvent.click(screen.getByText('GUARDAR ALERTA'));
    });

    // Verificar que onSubmit se llamó con el array limpio y formateado
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'Alerta Compleja',
        descriptors: ['IA', 'robots', 'chips'],
        cron_expression: '0 * * * *'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/users/1/alerts'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  test('en modo edición guarda con método PUT', async () => {
    render(
      <AlertForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialData={{ id: 7, nombre: 'Original', descriptores: 'IA, Datos' }}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Ej: TENDENCIAS TECH 2026'), {
      target: { value: 'Actualizada' }
    });

    await React.act(async () => {
      fireEvent.click(screen.getByText('GUARDAR ALERTA'));
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/users/1/alerts/7'),
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  test('limpia los inputs después de enviar el formulario', async () => {
    render(<AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    const inputNombre = screen.getByPlaceholderText('Ej: TENDENCIAS TECH 2026');
    fireEvent.change(inputNombre, { target: { value: 'Test' } });
    
    await React.act(async () => {
      fireEvent.click(screen.getByText('GUARDAR ALERTA'));
    });

    // Al volver a renderizar, los campos deberían estar vacíos
    await waitFor(() => {
      expect(inputNombre).toHaveValue('');
    });
  });

  test('muestra chips de sugerencias al pulsar Sugerir Descriptores', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ['Machine Learning', 'IA']
    } as unknown as Response);

    render(<AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('Ej: TENDENCIAS TECH 2026'), {
      target: { value: 'Tecnologia' }
    });

    fireEvent.click(screen.getByText('Sugerir Descriptores'));

    expect(await screen.findByText('Sugerencias:')).toBeInTheDocument();
    expect(screen.getByText('Machine Learning')).toBeInTheDocument();
    expect(screen.getByText('IA')).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/alerts/keyword-recommendations?keyword=Tecnologia')
      );
    });
  });

  test('aceptar una recomendación la elimina y actualiza el input de descriptores', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ['Machine Learning', 'IA']
    } as unknown as Response);

    render(<AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('Ej: TENDENCIAS TECH 2026'), {
      target: { value: 'Tecnologia' }
    });

    fireEvent.click(screen.getByText('Sugerir Descriptores'));

    expect(await screen.findByText('Machine Learning')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Aceptar recomendación Machine Learning'));

    await waitFor(() => {
      expect(screen.queryByText('Machine Learning')).not.toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Ej: IA, ROBÓTICA, CHIPS')).toHaveValue('Machine Learning');
  });

  test('rechazar una recomendación la elimina y no modifica el input de descriptores', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ['Machine Learning', 'IA']
    } as unknown as Response);

    render(<AlertForm isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('Ej: TENDENCIAS TECH 2026'), {
      target: { value: 'Tecnologia' }
    });

    fireEvent.click(screen.getByText('Sugerir Descriptores'));

    expect(await screen.findByText('IA')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Rechazar recomendación IA'));

    await waitFor(() => {
      expect(screen.queryByText('IA')).not.toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Ej: IA, ROBÓTICA, CHIPS')).toHaveValue('');
  });
});
