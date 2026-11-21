"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  CreditCard,
  FileDown,
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
  comet?: boolean
}

const itemClass =
  "min-h-11 text-[#A9B4C2] hover:text-[#f7fbff] data-active:text-[#f7fbff] [&_svg]:text-current"

const CREATE: NavItem[] = [
  { label: "Gallery", href: "/app/templates", icon: Images },
  { label: "Print Templates", href: "/app/print-templates", icon: FileDown },
]

const MANAGE: NavItem[] = [
  { label: "Command Center", href: "/app", icon: LayoutDashboard },
  { label: "Campaigns", href: "/app/campaigns", icon: Megaphone },
  { label: "Lists", href: "/app/lists", icon: List },
  { label: "Reports", href: "/app/reports", icon: BarChart3 },
]

const ACCOUNT: NavItem[] = [
  { label: "Billing", href: "/app/billing", icon: CreditCard },
  { label: "Settings", href: "/app/settings", icon: Settings },
  { label: "Ask Comet", href: "/app/help?ask=1", icon: Sparkles, comet: true },
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
  const onMailer = pathname === "/app/mail" || pathname.startsWith("/app/mail/")

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
              aria-current={onMailer ? "page" : undefined}
              className="mx-2 mb-3 inline-flex min-h-12 w-[calc(100%-1rem)] items-center justify-center rounded-xl px-3 text-sm font-semibold group-data-[collapsible=icon]:hidden"
              style={{ background: brand.accent, color: brand.ink }}
            >
              New Mailer
            </Link>
            <SidebarMenu className="mb-2 hidden group-data-[collapsible=icon]:flex">
              <NavLink item={{ label: "New Mailer", href: "/app/mail", icon: Megaphone }} active={onMailer} />
            </SidebarMenu>
            <Section label="Create" />
            <SidebarMenu>
              {CREATE.map((item) => (
                <NavLink key={item.href} item={item} active={itemActive(item.href, pathname)} />
              ))}
            </SidebarMenu>
            <Section label="Manage" />
            <SidebarMenu>
              {MANAGE.map((item) => (
                <NavLink key={item.href} item={item} active={itemActive(item.href, pathname)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Section label="Account" />
        <SidebarMenu>
          {ACCOUNT.map((item) => (
            <NavLink key={item.label} item={item} active={itemActive(item.href, pathname)} comet={item.comet} />
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

function Section({ label }: { label: string }) {
  return (
    <p className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-[0.16em] text-[#6d8294] group-data-[collapsible=icon]:hidden">
      {label}
    </p>
  )
}

function itemActive(href: string, pathname: string): boolean {
  if (href.includes("?")) return false
  if (href === "/app") return pathname === "/app"
  return pathname === href || pathname.startsWith(`${href}/`)
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
