import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { LayoutDashboard, Users2, Target, Map, LogOut, Sparkles, Facebook, Wallet, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Users2 },
  { to: "/fb-outreach", label: "FB Outreach", icon: Facebook },
  { to: "/offer-builder", label: "Offer Builder", icon: FileText },
  { to: "/prospecting", label: "Prospecting", icon: Map },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/team", label: "Team", icon: Sparkles },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="px-5 h-14 flex items-center gap-2 border-b border-sidebar-border">
          <div className="size-7 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Target className="size-4 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">LeadForge</span>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <Link key={item.to} to={item.to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}>
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <div className="px-3 py-2 text-xs text-sidebar-foreground/60 truncate">{email}</div>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:text-sidebar-accent-foreground">
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
