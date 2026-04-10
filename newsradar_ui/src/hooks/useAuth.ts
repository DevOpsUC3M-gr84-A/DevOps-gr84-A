export const useAuth = () => {
  const login = (data: { access_token: string; user_id: number; role_ids: number[] }) => {
    globalThis.localStorage.setItem('token', data.access_token);
    globalThis.localStorage.setItem('userId', data.user_id.toString());
    globalThis.localStorage.setItem('userRoles', JSON.stringify(data.role_ids));
    globalThis.location.href = '/'; 
  };

  const logout = () => {
    globalThis.localStorage.clear();
    globalThis.location.href = '/auth';
  };

  return { login, logout };
};