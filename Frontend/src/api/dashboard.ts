import { apiRequest, type ApiFetchInit } from './client'
import type { DashboardResponse } from '../types'

export interface FetchDashboardOptions extends ApiFetchInit {
  activityPage?: number
  activityLimit?: number
}

export function fetchDashboard(options: FetchDashboardOptions = {}) {
  const { activityPage, activityLimit, ...init } = options
  const params = new URLSearchParams()
  if (activityPage != null) params.set('activityPage', String(activityPage))
  if (activityLimit != null) params.set('activityLimit', String(activityLimit))
  const query = params.toString()
  const path = query ? `/dashboard?${query}` : '/dashboard'
  return apiRequest<DashboardResponse>(path, init)
}
