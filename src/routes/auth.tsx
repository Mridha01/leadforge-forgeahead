import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Target } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — LeadForge CRM" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — you're in.");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (result.error) { setLoading(false); return toast.error(result.error.message ?? "Google sign-in failed"); }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 [background:radial-gradient(60%_50%_at_50%_0%,oklch(0.66_0.18_285/0.18),transparent_60%)]" />
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="size-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Target className="size-5 text-primary" />
          </div>
          <span className="text-lg font-semibold tracking-tight">LeadForge CRM</span>
        </div>
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6 shadow-2xl">
          <h1 className="text-xl font-semibold mb-1">Sign in to your workspace</h1>
          <p className="text-sm text-muted-foreground mb-6">Outreach CRM for your agency team.</p>

          <Button type="button" variant="outline" className="w-full mb-4" onClick={handleGoogle} disabled={loading}>
            <svg viewBox="0 0 24 24" className="size-4 mr-2"><path fill="currentColor" d="M21.35 11.1H12v3.2h5.35c-.23 1.4-1.65 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.93 3.96 14.7 3 12 3 6.98 3 3 6.98 3 12s3.98 9 9 9c5.2 0 8.64-3.65 8.64-8.79 0-.59-.06-1.04-.14-1.51z"/></svg>
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 my-4 text-xs text-muted-foreground"><div className="h-px bg-border flex-1"/>or<div className="h-px bg-border flex-1"/></div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-3 mt-4">
                <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
                <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="size-4 mr-2 animate-spin"/>}Sign in</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-3 mt-4">
                <div><Label htmlFor="name">Full name</Label><Input id="name" required value={fullName} onChange={(e)=>setFullName(e.target.value)} /></div>
                <div><Label htmlFor="email2">Email</Label><Input id="email2" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
                <div><Label htmlFor="pw2">Password</Label><Input id="pw2" type="password" minLength={8} required value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="size-4 mr-2 animate-spin"/>}Create account</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-6">
          <Link to="/dashboard" className="hover:text-foreground">Continue to dashboard →</Link>
        </p>
      </div>
    </div>
  );
}
