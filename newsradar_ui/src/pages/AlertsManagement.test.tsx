import React from "react";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "../test-utils";
import { AlertsManagement } from "./AlertsManagement";

// Stub para `AlertForm`: el modal real es complejo (hooks, fetch de
// descriptores, CheckboxList) y no queremos arrastrar su lógica aquí. El
// objetivo es ejercitar `AlertsManagement.tsx`, no `AlertForm.tsx`.
vi.mock("../components/AlertForm", async (orig) => {
  const actual = (await orig()) as object;
  return {
    ...actual,
    AlertForm: ({
      isOpen,
      onClose,
      initialData,
      categories,
      onSubmit,
    }: {
      isOpen: boolean;
      onClose: () => void;
      initialData: unknown;
      categories: unknown;
      onSubmit: (payload: unknown) => void | Promise<void>;
    }) => {
      if (!isOpen) return null;
      return (
        <div role="dialog" aria-label="alert-form-mock">
          <span data-testid="form-mode">
            {initialData ? "edit" : "create"}
          </span>
          <span data-testid="form-categories-count">
            {Array.isArray(categories) ? categories.length : 0}
          </span>
          <button onClick={onClose}>cerrar-form</button>
          <button
            onClick={() =>
              onSubmit({
                name: "Alerta Test",
                descriptors: "ia, robotica",
                categories: [
                  {
                    id: 13,
                    name: "Ciencia y tecnología",
                    iptc_code: "13000000",
                  },
                ],
                cron_expression: "0 * * * *",
                information_sources_ids: ["1", " 2 ", "", null, "abc", "3.5"],
                rss_channels_ids: ["7", "ocho", "9"],
                notify_inbox: true,
                notify_email: false,
              })
            }
          >
            submit-form
          </button>
          <button
            onClick={() =>
              onSubmit({
                name: "Alerta Solo Fallback",
                descriptors: ["uno", " ", "dos"],
                categories: ["11000000"],
                cron_expression: "0 0 * * *",
                information_sources_ids: [],
                rss_channels_ids: [],
                notify_inbox: false,
                notify_email: true,
              })
            }
          >
            submit-form-fallback
          </button>
        </div>
      );
    },
  };
});

const mockFetch = vi.fn();
const realFetch = globalThis.fetch;

const seedAuth = (
  roles: number[] = [1],
  token: string | null = "tok",
  userId: string | null = "42",
) => {
  if (token) localStorage.setItem("token", token);
  if (userId) localStorage.setItem("userId", userId);
  localStorage.setItem("userRoles", JSON.stringify(roles));
};

const onLogout = vi.fn();

beforeEach(() => {
  localStorage.clear();
  mockFetch.mockReset();
  onLogout.mockReset();
  // @ts-expect-error overriding global fetch
  globalThis.fetch = mockFetch;
});

afterEach(() => {
  // @ts-expect-error restoring
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("AlertsManagement - renderizado base", () => {
  test("oculta el botón 'Nueva alerta' para usuario sin rol de gestor/admin", () => {
    // roles = [2] (lector) → canManageAlerts = false → no debería renderizar el botón
    seedAuth([2]);
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    render(<AlertsManagement onLogout={onLogout} />);

    expect(screen.getByText(/Gestión de Alertas/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nueva Alerta/i)).not.toBeInTheDocument();
  });

  test("muestra el botón para crear si el usuario es gestor (rol 1)", async () => {
    seedAuth([1]);
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    render(<AlertsManagement onLogout={onLogout} />);
    expect(screen.getByText(/Nueva Alerta/i)).toBeInTheDocument();
  });

  test("muestra el botón para crear si el usuario es admin (rol 3)", () => {
    seedAuth([3]);
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    render(<AlertsManagement onLogout={onLogout} />);
    expect(screen.getByText(/Nueva Alerta/i)).toBeInTheDocument();
  });

  test("muestra mensaje vacío cuando no hay alertas tras cargar", async () => {
    seedAuth([1]);
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // /alerts
      .mockResolvedValueOnce({ ok: true, json: async () => [] }); // /categories

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() => {
      expect(
        screen.getByText(/No hay alertas configuradas/i),
      ).toBeInTheDocument();
    });
  });
});

describe("AlertsManagement - listado y filtros", () => {
  const apiAlerts = [
    {
      id: 1,
      name: "Alerta Tech",
      descriptors: ["ia", "robotica", "keyword0001"],
      categoria_iptc: "13000000",
      information_sources_ids: ["7"],
      notify_inbox: true,
      notify_email: true,
    },
    {
      id: 2,
      name: "Alerta Política",
      descriptors: ["elecciones"],
      categories: [{ iptc_code: "11000000", name: "Política" }],
      rss_channels_ids: ["12"],
      notify_inbox: false,
      notify_email: false,
    },
    {
      id: 3,
      name: "Sin nada raro",
      descriptors: [],
      // Sin categories ni categoria_iptc para tocar la rama vacía
      notify_inbox: true,
      notify_email: false,
    },
  ];

  beforeEach(() => {
    seedAuth([1]);
  });

  test("mapea alertas (API → tabla) y respeta los tres formatos de categoría", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => apiAlerts })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() => {
      expect(screen.getByText("Alerta Tech")).toBeInTheDocument();
    });
    expect(screen.getByText("Alerta Política")).toBeInTheDocument();
    expect(screen.getByText("Sin nada raro")).toBeInTheDocument();
    // Categoría desde categoria_iptc → IPTC_MAP (aparece en la tabla y en
    // las opciones del filtro, por eso usamos getAllByText)
    expect(screen.getAllByText(/Ciencia y tecnología/i).length).toBeGreaterThan(0);
    // Categoría desde objeto con name
    expect(screen.getAllByText(/Política/i).length).toBeGreaterThan(0);
    // Los descriptores tipo `keywordN` se filtran por filterPaddingDescriptors
    expect(screen.queryByText(/keyword0001/i)).not.toBeInTheDocument();
  });

  test("filtro por categoría IPTC oculta las alertas que no coinciden", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => apiAlerts })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() => {
      expect(screen.getByText("Alerta Tech")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Filtrar por categoría/i), {
      target: { value: "13000000" },
    });

    expect(screen.getByText("Alerta Tech")).toBeInTheDocument();
    expect(screen.queryByText("Alerta Política")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin nada raro")).not.toBeInTheDocument();
  });

  test("búsqueda por nombre/descriptor filtra coincidencias case-insensitive", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => apiAlerts })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() => {
      expect(screen.getByText("Alerta Tech")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Buscar por Nombre/i), {
      target: { value: "ELECCIONES" },
    });

    expect(screen.queryByText("Alerta Tech")).not.toBeInTheDocument();
    expect(screen.getByText("Alerta Política")).toBeInTheDocument();
  });

  test("muestra estado vacío si los filtros no devuelven resultados", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => apiAlerts })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() => {
      expect(screen.getByText("Alerta Tech")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Buscar por Nombre/i), {
      target: { value: "no-match-xxx" },
    });

    expect(screen.getByText(/No hay alertas configuradas/i)).toBeInTheDocument();
  });
});

describe("AlertsManagement - fetchAlertas (carga inicial)", () => {
  beforeEach(() => seedAuth([1]));

  test("ante 401 limpia localStorage y llama a onLogout", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() => expect(onLogout).toHaveBeenCalled());
    expect(localStorage.getItem("token")).toBeNull();
  });

  test("ante respuesta no-ok no-401 muestra feedback de error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() =>
      expect(
        screen.getByText(/No se pudieron cargar las alertas/i),
      ).toBeInTheDocument(),
    );
  });

  test("ignora payload no-array y deja la tabla vacía", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ foo: "bar" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() =>
      expect(screen.getByText(/No hay alertas configuradas/i)).toBeInTheDocument(),
    );
  });

  test("ante error de red captura excepción y muestra mensaje", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() =>
      expect(screen.getByText(/Network failure/i)).toBeInTheDocument(),
    );
  });
});

describe("AlertsManagement - fetchCategories (sanitización a Number)", () => {
  beforeEach(() => seedAuth([1]));

  test("descarta categorías con id no numérico y conserva las válidas", async () => {
    // alertas vacías + categorías mezcladas (válidas + basura)
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 13, name: "Tech", iptc_code: "13000000", iptc_label: "Ciencia y tecnología" },
          { id: "abc", name: "Roto", iptc_code: "99000000", iptc_label: "Inválido" },
          { id: "11", name: "Política", iptc_code: "11000000", iptc_label: "Política" },
        ],
      });

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() =>
      expect(screen.getByText(/Nueva Alerta/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText(/Nueva Alerta/i));

    await waitFor(() => {
      expect(screen.getByTestId("form-categories-count")).toHaveTextContent("2");
    });
  });

  test("si /categories devuelve 401 llama a onLogout", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // /alerts
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) }); // /categories

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() => expect(onLogout).toHaveBeenCalled());
  });

  test("si /categories falla con error de red usa fallback con IPTC_MAP", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // /alerts
      .mockRejectedValueOnce(new Error("boom")); // /categories

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() =>
      expect(screen.getByText(/Nueva Alerta/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText(/Nueva Alerta/i));

    await waitFor(() => {
      // El fallback inyecta las 17 categorías del IPTC_MAP estático
      expect(screen.getByTestId("form-categories-count")).toHaveTextContent("17");
    });
  });

  test("si /categories responde non-ok no-401 dispara el fallback", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() =>
      expect(screen.getByText(/Nueva Alerta/i)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText(/Nueva Alerta/i));

    await waitFor(() => {
      expect(screen.getByTestId("form-categories-count")).toHaveTextContent("17");
    });
  });

  test("no llama a /categories si no hay token (early return)", async () => {
    // userId presente, pero token ausente → useEffect no dispara la carga
    localStorage.removeItem("token");
    localStorage.setItem("userId", "42");
    localStorage.setItem("userRoles", JSON.stringify([1]));

    render(<AlertsManagement onLogout={onLogout} />);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("AlertsManagement - borrado de alerta", () => {
  const apiAlerts = [
    {
      id: 7,
      name: "ToDelete",
      descriptors: ["x"],
      categoria_iptc: "13000000",
      notify_inbox: true,
      notify_email: false,
    },
  ];

  beforeEach(() => seedAuth([1]));

  test("confirmación negativa: no llama al endpoint DELETE", async () => {
    const confirmSpy = vi
      .spyOn(globalThis, "confirm")
      .mockReturnValue(false);

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => apiAlerts })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() => expect(screen.getByText("ToDelete")).toBeInTheDocument());

    mockFetch.mockClear();
    fireEvent.click(screen.getByLabelText(/Eliminar ToDelete/i));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("DELETE con éxito retira la alerta de la tabla y muestra feedback", async () => {
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => apiAlerts })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // DELETE

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() => expect(screen.getByText("ToDelete")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/Eliminar ToDelete/i));

    await waitFor(() =>
      expect(screen.getByText(/Alerta borrada correctamente/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText("ToDelete")).not.toBeInTheDocument();
  });

  test("DELETE responde 401 → onLogout y limpia storage", async () => {
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => apiAlerts })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() => expect(screen.getByText("ToDelete")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/Eliminar ToDelete/i));

    await waitFor(() => expect(onLogout).toHaveBeenCalled());
  });

  test("DELETE responde 500 → feedback de error", async () => {
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => apiAlerts })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() => expect(screen.getByText("ToDelete")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/Eliminar ToDelete/i));

    await waitFor(() =>
      expect(
        screen.getByText(/No se pudo borrar la alerta/i),
      ).toBeInTheDocument(),
    );
  });

  test("DELETE rechaza promesa → feedback de error (catch)", async () => {
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => apiAlerts })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockRejectedValueOnce(new Error("offline"));

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() => expect(screen.getByText("ToDelete")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/Eliminar ToDelete/i));

    await waitFor(() =>
      expect(screen.getByText(/offline/)).toBeInTheDocument(),
    );
  });
});

describe("AlertsManagement - guardado (saneamiento a Number y categorías)", () => {
  beforeEach(() => seedAuth([1]));

  test("POST /alerts: sanea IDs (Number) y manda categories estructuradas", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // GET alerts
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // GET categories
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 99 }) }) // POST alert
      .mockResolvedValueOnce({ ok: true, json: async () => [] }); // refetch alerts

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() =>
      expect(screen.getByText(/Nueva Alerta/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText(/Nueva Alerta/i));
    await waitFor(() => expect(screen.getByText("submit-form")).toBeInTheDocument());
    fireEvent.click(screen.getByText("submit-form"));

    await waitFor(() => {
      // 3rd fetch = POST de creación
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    const postCall = mockFetch.mock.calls[2];
    expect(postCall[0]).toMatch(/\/api\/v1\/users\/42\/alerts$/);
    expect(postCall[1]).toMatchObject({ method: "POST" });
    const body = JSON.parse(postCall[1].body as string);

    // sanitizeNumericIds: "1" pasa; " 2 " trim+Number=2; "" descartado; null
    // descartado; "abc" descartado (NaN); "3.5" descartado (no integer).
    expect(body.information_sources_ids).toEqual(["1", "2"]);
    // rss_channels_ids: "7" y "9" válidos; "ocho" descartado.
    expect(body.rss_channels_ids).toEqual(["7", "9"]);
    expect(body.descriptors).toEqual(["ia", "robotica"]);
    expect(body.categories).toEqual([
      { code: "13000000", label: "Ciencia y tecnología" },
    ]);
    expect(body.notify_inbox).toBe(true);
    expect(body.notify_email).toBe(false);
  });

  test("POST: si categories solo trae strings, usa el fallback IPTC_LABELS_FALLBACK", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // GET alerts
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // GET categories
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 100 }) }) // POST
      .mockResolvedValueOnce({ ok: true, json: async () => [] }); // refetch

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() =>
      expect(screen.getByText(/Nueva Alerta/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText(/Nueva Alerta/i));
    await waitFor(() =>
      expect(screen.getByText("submit-form-fallback")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("submit-form-fallback"));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(4));
    const postBody = JSON.parse(mockFetch.mock.calls[2][1].body as string);
    expect(postBody.categories).toEqual([
      { code: "11000000", label: "Política" },
    ]);
    // rss_channels_ids cae al fallback de information_sources_ids (ambos vacíos)
    expect(postBody.rss_channels_ids).toEqual([]);
    expect(postBody.information_sources_ids).toEqual([]);
    expect(postBody.notify_inbox).toBe(false);
    expect(postBody.notify_email).toBe(true);
  });

  test("PUT (modo edición) cuando hay alertToEdit", async () => {
    const apiAlerts = [
      {
        id: 55,
        name: "Existente",
        descriptors: ["a"],
        categoria_iptc: "13000000",
        notify_inbox: true,
        notify_email: true,
      },
    ];
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => apiAlerts }) // GET alerts
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // GET categories
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 55 }) }) // PUT
      .mockResolvedValueOnce({ ok: true, json: async () => apiAlerts }); // refetch

    render(<AlertsManagement onLogout={onLogout} />);

    await waitFor(() => expect(screen.getByText("Existente")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/Editar Existente/i));
    await waitFor(() => expect(screen.getByTestId("form-mode")).toHaveTextContent("edit"));

    fireEvent.click(screen.getByText("submit-form"));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(4));
    const putCall = mockFetch.mock.calls[2];
    expect(putCall[0]).toMatch(/\/api\/v1\/users\/42\/alerts\/55$/);
    expect(putCall[1]).toMatchObject({ method: "PUT" });

    await waitFor(() =>
      expect(
        screen.getByText(/Alerta actualizada correctamente/i),
      ).toBeInTheDocument(),
    );
  });

  test("guardado con 401 dispara onLogout", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

    render(<AlertsManagement onLogout={onLogout} />);
    await waitFor(() => expect(screen.getByText(/Nueva Alerta/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Nueva Alerta/i));
    await waitFor(() => expect(screen.getByText("submit-form")).toBeInTheDocument());
    fireEvent.click(screen.getByText("submit-form"));

    await waitFor(() => expect(onLogout).toHaveBeenCalled());
  });

  test("guardado responde 500 → feedback de error", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    render(<AlertsManagement onLogout={onLogout} />);
    await waitFor(() => expect(screen.getByText(/Nueva Alerta/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Nueva Alerta/i));
    await waitFor(() => expect(screen.getByText("submit-form")).toBeInTheDocument());
    fireEvent.click(screen.getByText("submit-form"));

    await waitFor(() =>
      expect(
        screen.getByText(/No se pudo guardar la alerta/i),
      ).toBeInTheDocument(),
    );
  });

  test("cerrar el modal limpia el alertToEdit", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(<AlertsManagement onLogout={onLogout} />);
    await waitFor(() => expect(screen.getByText(/Nueva Alerta/i)).toBeInTheDocument());

    fireEvent.click(screen.getByText(/Nueva Alerta/i));
    expect(screen.getByTestId("form-mode")).toHaveTextContent("create");
    fireEvent.click(screen.getByText("cerrar-form"));
    expect(screen.queryByTestId("form-mode")).not.toBeInTheDocument();
  });
});

describe("AlertsManagement - timeout de feedback", () => {
  beforeEach(() => seedAuth([1]));

  test("limpia el feedback automáticamente tras 5000ms", async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    render(<AlertsManagement onLogout={onLogout} />);

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(
      screen.getByText(/No se pudieron cargar las alertas/i),
    ).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(
        screen.queryByText(/No se pudieron cargar las alertas/i),
      ).not.toBeInTheDocument();
    });

    vi.useRealTimers();
  });
});
