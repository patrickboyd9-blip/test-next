"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  LayoutDashboard,
  LayoutTemplate,
  Megaphone,
  Settings,
  Sparkles,
  Users,
} from "lucide-react"

import { mockCurrentUser } from "@/lib/auth/mock-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  soon?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: "Command Center", href: "/app", icon: LayoutDashboard },
  { label: "Campaigns", href: "/app/campaigns", icon: Megaphone, soon: true },
  { label: "Audience", href: "/app/audience", icon: Users, soon: true },
  { label: "Templates", href: "/app/templates", icon: LayoutTemplate, soon: true },
  { label: "AI Creator", href: "/app/ai-creator", icon: Sparkles, soon: true },
  { label: "Insights", href: "/app/insights", icon: BarChart3, soon: true },
  { label: "Settings", href: "/app/settings", icon: Settings, soon: true },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-8 items-center gap-2 px-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            M
          </span>
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
            Modern Mail
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon

                if (item.soon) {
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        disabled
                        tooltip={`${item.label} — coming soon`}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge>Soon</SidebarMenuBadge>
                    </SidebarMenuItem>
                  )
                }

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 rounded-md p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
            {mockCurrentUser.initials}
          </span>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium text-sidebar-foreground">
              {mockCurrentUser.name}
            </span>
            <span className="truncate text-xs text-sidebar-foreground/70">
              {mockCurrentUser.businessName}
            </span>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
