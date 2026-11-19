"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  CreditCard,
  Images,
  LayoutDashboard,
  LifeBuoy,
  List,
  Megaphone,
  Settings,
  Sparkles,
} from "lucide-react"

import { signOutAction } from "@/lib/auth/actions"
import { CometMark } from "@/components/assistant/CometMark"
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
import type { AppliedBrand } from "@/lib/white-label/brand"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const itemClass =
  "min-h-11 text-[#A9B4C2] hover:text-[#f7fbff] data-active:text-[#f7fbff] [&_svg]:text-current"

const NAV_ITEMS: NavItem[] = [
  { label: "Command Center", href: "/app", icon: LayoutDashboard },
  { label: "Campaigns", href: "/app/campaigns", icon: Megaphone },
  { label: "Lists", href: "/app/lists", icon: List },
  { label: "Mailer Gallery", href: "/app/templates", icon: Images },
  { label: "Reports", href: "/app/reports", icon: BarChart3 },
  { label: "Billing", href: "/app/billing", icon: CreditCard },
  { label: "Settings", href: "/app/settings", icon: Settings },
]

const PINNED: NavItem[] = [
  { label: "Ask Comet", href: "/app/help?ask=1", icon: Sparkles },
  { label: "Help", href: "/app/help", icon: LifeBuoy },
]

export function AppSidebar({
  account,
  brand,
}: {
  account: { name: string; detail: string; initials: string } | null
  brand: AppliedBrand
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
          "--sidebar-primary": brand.accent,
          "--sidebar-primary-foreground": brand.ink,
        } as React.CSSProperties
      }
    >
      <SidebarHeader>
        <div className="flex h-10 items-center gap-2 px-2">
          {brand.logoDataUrl ? (
            // The mark is the account's file.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoDataUrl} alt="" className="size-7 shrink-0 rounded-md object-contain" />
          ) : (
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold"
              style={{ background: brand.accent, color: brand.ink }}
            >
              {brand.appName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.18em] group-data-[collapsible=icon]:hidden">
            {brand.appName}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <Link
              href="/app/mail"
              className="mx-2 mb-3 inline-flex min-h-12 w-[calc(100%-1rem)] items-center justify-center rounded-xl px-3 text-sm font-semibold group-data-[collapsible=icon]:hidden"
              style={{ background: brand.accent, color: brand.ink }}
            >
              New Mailer Campaign
            </Link>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={
                    item.href === "/app"
                      ? pathname === "/app"
                      : pathname === item.href || pathname.startsWith(`${item.href}/`)
                  }
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {PINNED.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === "/app/help" && item.href === "/app/help"} comet={item.label === "Ask Comet"} />
          ))}
        </SidebarMenu>
        {brand.poweredBy ? (
          <p className="px-2 pt-2 text-[11px] text-[#8aa0b4] group-data-[collapsible=icon]:hidden">{brand.poweredBy}</p>
        ) : null}
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
            {account ? (
              <form action={signOutAction}>
                <button type="submit" className="text-left text-xs text-[#7ee7ff] underline">
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/sign-in" className="text-xs text-[#7ee7ff] underline">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function NavLink({ item, active, comet = false }: { item: NavItem; active: boolean; comet?: boolean }) {
  const Icon = item.icon
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={active} className={itemClass} tooltip={item.label} render={<Link href={item.href} />}>
        {comet ? <CometMark className="size-4" /> : <Icon />}
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
