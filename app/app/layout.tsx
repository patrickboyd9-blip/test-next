import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getSession, sessionInitials } from "@/lib/auth/session";

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
  const account = session
    ? {
        name: session.name,
        detail: session.fixture ? "Local fixture. Not a signed-in account." : session.businessName,
        initials: sessionInitials(session.name),
      }
    : null;
  return (
    <SidebarProvider>
      <AppSidebar account={account} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
