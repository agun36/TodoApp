import { apiRequest, type ApiFetchInit } from './client'
import type { OnboardingInput, User, Workspace } from '../types'

export function fetchOnboardingStatus(init?: ApiFetchInit) {
  return apiRequest<{
    success: true
    needsOnboarding: boolean
    workspace: Workspace | null
    user: User
  }>('/onboarding/status', init)
}

export function completeOnboarding(input: OnboardingInput) {
  return apiRequest<{
    success: true
    message: string
    workspace: Workspace
    user: User
  }>('/onboarding', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
