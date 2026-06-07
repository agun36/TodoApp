import { AppSidebar } from './AppSidebar'

interface AppLayoutProps {
  children: React.ReactNode
  sidebarExtra?: React.ReactNode
}

export function AppLayout({ children, sidebarExtra }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <AppSidebar>{sidebarExtra}</AppSidebar>
      <div className="app-main">
        <div className="app-content">{children}</div>
      </div>
    </div>
  )
}
