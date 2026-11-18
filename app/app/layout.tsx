import type { Metadata } from "next";
import { Suspense } from "react";

import { AccountNotice } from "@/components/auth/AccountNotice";
import { BrandProvider } from "@/components/brand/BrandProvider";
import { AskComet } from "@/components/assistant/AskComet";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getSession, sessionInitials } from "@/lib/auth/session";
import { applyBrand } from "@/lib/white-label/brand";
import { readWhiteLabel } from "@/lib/white-label/store";

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const settings = session ? await readWhiteLabel(session.userId).catch(() => null) : null;
  const brand = applyBrand(settings);
  return {
    title: brand.appName,
    description: brand.appName,
    icons: brand.faviconDataUrl ? { icon: brand.faviconDataUrl } : undefined,
  };
}

export const runtime = "nodejs";
/**
 * Same Hobby ceiling as the campaign page, so product routes that invoke
 * creative Server Actions are not cut off at the platform default.
 */
export const maxDuration = 60;

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  const settings = session ? await readWhiteLabel(session.userId).catch(() => null) : null;
  const brand = applyBrand(settings);
  const account = session
    ? {
        name: session.name,
        detail: session.fixture ? "Sample account. Nothing is mailed or charged." : session.businessName,
        initials: sessionInitials(session.name),
      }
    : null;
  return (
    <SidebarProvider>
      <AppSidebar account={account} brand={brand} />
      <SidebarInset style={{ ["--brand-accent" as string]: brand.accent }}>
        <Suspense fallback={null}>
          <AccountNotice />
        </Suspense>
        <BrandProvider brand={brand}>{children}</BrandProvider>
        <Suspense fallback={null}>
          <AskComet />
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  );
}
