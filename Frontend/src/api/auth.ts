import { apiRequest, clearToken, setToken } from './client'
import type { AuthResponse } from '../types'

interface LoginPayload {
  email: string
  password: string
}

interface SignupPayload {
  email?: string
  password: string
  name?: string
  inviteToken?: string
}

export async function login(payload: LoginPayload) {
  const data = await apiRequest<AuthResponse>('/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  setToken(data.token)
  return data
}

export async function signup(payload: SignupPayload) {
  const data = await apiRequest<AuthResponse>('/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  setToken(data.token)
  return data
}

export async function logout() {
  try {
    await apiRequest<{ success: true; message: string }>('/login/logout')
  } finally {
    clearToken()
  }
}
