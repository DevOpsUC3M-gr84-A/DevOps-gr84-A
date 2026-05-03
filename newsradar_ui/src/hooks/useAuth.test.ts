import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";

import { useAuth } from "./useAuth";

describe("useAuth hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage.clear();
  });

  test("inicializa estado como no autenticado cuando no hay token", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test("inicializa estado como autenticado cuando hay token", () => {
    globalThis.localStorage.setItem("token", "seed-token");

    const { result } = renderHook(() => useAuth());

    expect(result.current.token).toBe("seed-token");
    expect(result.current.isAuthenticated).toBe(true);
  });

  test("login guarda token, userId y roles y actualiza estado reactivo", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const dispatchSpy = vi.spyOn(globalThis, "dispatchEvent");
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.login({
        access_token: "token-abc",
        user_id: 42,
        role_ids: [1, 2],
      });
    });

    expect(setItemSpy).toHaveBeenCalledWith("token", "token-abc");
    expect(setItemSpy).toHaveBeenCalledWith("userId", "42");
    expect(setItemSpy).toHaveBeenCalledWith("userRoles", JSON.stringify([1, 2]));
    expect(result.current.token).toBe("token-abc");
    expect(result.current.isAuthenticated).toBe(true);
    expect(
      dispatchSpy.mock.calls.some(
        (call) => call[0] instanceof Event && call[0].type === "newsradar-auth-state-changed",
      ),
    ).toBe(true);
  });

  test("logout elimina claves de sesión y actualiza estado reactivo", () => {
    globalThis.localStorage.setItem("token", "token-abc");
    globalThis.localStorage.setItem("userId", "42");
    globalThis.localStorage.setItem("userRoles", "[1,2]");
    globalThis.localStorage.setItem("userEmail", "qa@newsradar.com");

    const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem");
    const dispatchSpy = vi.spyOn(globalThis, "dispatchEvent");
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.logout();
    });

    expect(removeItemSpy).toHaveBeenCalledWith("token");
    expect(removeItemSpy).toHaveBeenCalledWith("userId");
    expect(removeItemSpy).toHaveBeenCalledWith("user_id");
    expect(removeItemSpy).toHaveBeenCalledWith("userRoles");
    expect(removeItemSpy).toHaveBeenCalledWith("userEmail");
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(
      dispatchSpy.mock.calls.some(
        (call) => call[0] instanceof Event && call[0].type === "newsradar-auth-state-changed",
      ),
    ).toBe(true);
  });

  test("sincroniza estado al recibir evento storage", () => {
    const { result } = renderHook(() => useAuth());

    act(() => {
      globalThis.localStorage.setItem("token", "from-storage-event");
      globalThis.dispatchEvent(new StorageEvent("storage"));
    });

    expect(result.current.token).toBe("from-storage-event");
    expect(result.current.isAuthenticated).toBe(true);
  });

  test("sincroniza estado al recibir evento interno de auth", () => {
    globalThis.localStorage.setItem("token", "initial-token");
    const { result } = renderHook(() => useAuth());

    act(() => {
      globalThis.localStorage.removeItem("token");
      globalThis.dispatchEvent(new Event("newsradar-auth-state-changed"));
    });

    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test("registra y limpia listeners al montar/desmontar", () => {
    const addEventListenerSpy = vi.spyOn(globalThis, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(globalThis, "removeEventListener");

    const { unmount } = renderHook(() => useAuth());

    expect(addEventListenerSpy).toHaveBeenCalledWith("storage", expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "newsradar-auth-state-changed",
      expect.any(Function),
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("storage", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "newsradar-auth-state-changed",
      expect.any(Function),
    );
  });
});
