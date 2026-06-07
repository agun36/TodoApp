import { useQuery } from '@tanstack/react-query'
import { fetchDashboard } from '../api/dashboard'

export const dashboardQueryKey = ['dashboard'] as const
export const ACTIVITY_PAGE_SIZE = 5

export function dashboardQueryKeyFor(activityPage: number, activityLimit = ACTIVITY_PAGE_SIZE) {
  return [...dashboardQueryKey, 'activity', activityPage, activityLimit] as const
}

export function useDashboard(activityPage = 1, activityLimit = ACTIVITY_PAGE_SIZE) {
  return useQuery({
    queryKey: dashboardQueryKeyFor(activityPage, activityLimit),
    queryFn: ({ signal }) => fetchDashboard({ signal, activityPage, activityLimit }),
    staleTime: 30_000,
  })
}
