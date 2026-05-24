import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
})

// Request interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
api.interceptors.response.use(
  (response) => {
    const newToken = response.headers['x-auth-token'] || response.data?.token
    if (newToken) {
      localStorage.setItem('token', newToken)
    }
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      
      try {
        const response = await api.post('/refresh-token')
        const newToken = response.data.token
        
        if (newToken) {
          localStorage.setItem('token', newToken)
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
          
          return api(originalRequest)
        }
      } catch (refreshError) {
        localStorage.removeItem('token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }
    
    return Promise.reject(error)
  }
)
