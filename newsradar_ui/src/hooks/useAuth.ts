export const useAuth = () => {
  const login = (data: { access_token: string; user_id: number; role_ids: number[] }) => {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('userId', data.user_id.toString());
    localStorage.setItem('userRoles', JSON.stringify(data.role_ids));
    window.location.href = '/'; 
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = '/auth';
  };

  return { login, logout };
};