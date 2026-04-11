import { useAuth } from './useAuth';

describe('useAuth hook', () => {
  const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
  const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem');
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    setItemSpy.mockReset();
    removeItemSpy.mockReset();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('login guarda token, userId y roles en globalThis.localStorage', () => {
    setItemSpy.mockImplementation(() => {});

    const { login } = useAuth();

    login({
      access_token: 'token-abc',
      user_id: 42,
      role_ids: [1, 2]
    });

    expect(setItemSpy).toHaveBeenCalledWith('token', 'token-abc');
    expect(setItemSpy).toHaveBeenCalledWith('userId', '42');
    expect(setItemSpy).toHaveBeenCalledWith('userRoles', JSON.stringify([1, 2]));
  });

  test('logout elimina claves de sesión en globalThis.localStorage', () => {
    removeItemSpy.mockImplementation(() => {});

    const { logout } = useAuth();

    logout();

    expect(removeItemSpy).toHaveBeenCalledWith('token');
    expect(removeItemSpy).toHaveBeenCalledWith('userId');
    expect(removeItemSpy).toHaveBeenCalledWith('userRoles');
    expect(removeItemSpy).toHaveBeenCalledWith('userEmail');
  });
});
