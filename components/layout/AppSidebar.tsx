"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, LayoutTemplate, Megaphone, PenLine, Sparkles } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const itemClass =
  "min-h-11 text-[#A9B4C2] hover:text-[#f7fbff] data-active:text-[#f7fbff] [&_svg]:text-current"

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/app", icon: LayoutDashboard },
  { label: "New mailer", href: "/app/mail", icon: Megaphone },
]

const ADVANCED_ITEMS: NavItem[] = [
  { label: "Full editor", href: "/app/campaigns/new", icon: Sparkles },
  { label: "Templates", href: "/app/templates", icon: LayoutTemplate },
  { label: "Design requests", href: "/app/design-requests", icon: PenLine },
]

export function AppSidebar({
  account,
}: {
  account: { name: string; detail: string; initials: string } | null
}) {
  const pathname = usePathname()

  return (
    <Sidebar
      collapsible="icon"
      className="border-[#1c3d52] bg-[#070b14]"
      style={
        {
          "--sidebar": "#070b14",
          "--sidebar-foreground": "#e7f2fb",
          "--sidebar-accent": "#102433",
          "--sidebar-accent-foreground": "#e7f2fb",
          "--sidebar-border": "#1c3d52",
          "--sidebar-primary": "#5ce1ff",
          "--sidebar-primary-foreground": "#041018",
        } as React.CSSProperties
      }
    >
      <SidebarHeader>
        <div className="flex h-10 items-center gap-2 px-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#5ce1ff] text-xs font-bold text-[#041018]">
            M
          </span>
          <span className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.18em] group-data-[collapsible=icon]:hidden">
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

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      className={itemClass}
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
        <SidebarGroup>
          <SidebarGroupContent>
            <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#7ee7ff] group-data-[collapsible=icon]:hidden">
              Advanced
            </p>
            <SidebarMenu>
              {ADVANCED_ITEMS.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton isActive={isActive} className={itemClass} tooltip={item.label} render={<Link href={item.href} />}>
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
            {account?.initials ?? "?"}
          </span>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium text-sidebar-foreground">
              {account?.name ?? "Signed out"}
            </span>
            <span className="truncate text-xs text-sidebar-foreground/70">
              {account?.detail ?? "No account"}
            </span>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
