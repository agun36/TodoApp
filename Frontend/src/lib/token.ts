interface TokenPayload {
  userId: string
  email: string
  exp: number
}

export function decodeTokenPayload(token: string): TokenPayload | null {
  const [data] = token.split('.')
  if (!data) return null

  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const payload = JSON.parse(atob(padded)) as TokenPayload

    if (!payload.userId || !payload.email || !payload.exp || payload.exp < Date.now()) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
