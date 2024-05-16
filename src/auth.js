import api from './api';

export const signIn = async (credentials) => {
  const response = await api.post('/session', credentials);
  return response.data;
};

export const signOut = async () => {
  await api.delete('/sign_out');
};

export const signUp = async (userData) => {
  const response = await api.post('/users', userData);
  return response.data;
};
