import { AccountClickwrap } from "@/components/compliance/AccountClickwrap";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { accountGate } from "@/lib/compliance/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * Same Hobby ceiling as the campaign page, so product routes that invoke
 * creative Server Actions are not cut off at the platform default.
 */
export const maxDuration = 60;

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const gate = await accountGate();
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {gate.required ? (
          <AccountClickwrap reason={gate.reason ?? "missing"} />
        ) : (
          children
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
