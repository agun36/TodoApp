import type { ApiError } from '../types'

const TOKEN_KEY = 'todo_auth_token'

export function getApiBase(): string {
  // Dev uses Vite proxy (/api → VITE_API_URL) to avoid browser CORS
  if (import.meta.env.DEV) {
    return '/api'
  }
  return import.meta.env.VITE_API_URL ?? '/api'
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export type ApiFetchInit = Pick<RequestInit, 'signal'>

export class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken()
  const headers = new Headers(options.headers)

  headers.set('Accept', 'application/json')
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    cache: 'no-store',
    ...options,
    headers,
  })

  const contentType = response.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null

  if (!response.ok) {
    let message = (data as ApiError | null)?.message
    if (!message) {
      if (response.status === 404) {
        message = import.meta.env.DEV
          ? 'API route not found. Start the backend with `npm run dev` in the project root.'
          : 'API route not found.'
      } else if (response.status >= 500) {
        message = 'Server error. Check that the API is running and DATABASE_URL is valid.'
      } else {
        message = `Request failed with status ${response.status}`
      }
    }
    throw new ApiRequestError(message, response.status)
  }

  return data as T
}
