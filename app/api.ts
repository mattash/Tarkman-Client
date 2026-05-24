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

// Shared in-flight refresh promise to deduplicate concurrent 401s
let refreshPromise: Promise<string | null> | null = null

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
    const url = originalRequest?.url ?? ''
    
    // Guard: do not retry the refresh endpoint itself
    if (error.response?.status === 401 && url.endsWith('/refresh-token')) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      
      try {
        if (!refreshPromise) {
          refreshPromise = api.post('/refresh-token').then(r => r.data.token).catch(() => null)
        }
        const newToken = await refreshPromise
        refreshPromise = null
        
        if (newToken) {
          localStorage.setItem('token', newToken)
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
          return api(originalRequest)
        }
      } catch {
        refreshPromise = null
      }

      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(error)
    }
    
    return Promise.reject(error)
  }
)
