import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export const runtime = "nodejs";
/**
 * Same Hobby ceiling as the campaign page, so product routes that invoke
 * creative Server Actions are not cut off at the platform default.
 */
export const maxDuration = 60;

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
