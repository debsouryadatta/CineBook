import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription } from "../components/ui/alert";
import { api, type User } from "../lib/api";

type Props = {
  setUser: (user: User | null) => void;
};

export function LoginPage({ setUser }: Props) {
  const [email, setEmail] = useState("demo@cinebook.local");
  const [password, setPassword] = useState("Demo@123");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const data = await api<{ user: User; token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem("cinebook-token", data.token);
      setUser(data.user);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100svh-64px)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px]">
      <section className="relative overflow-hidden rounded-md bg-ink p-8 text-white shadow-2xl shadow-black/12 lg:min-h-[520px]">
        <img
          src="https://picsum.photos/seed/cinebook-signin-lobby/1200/900"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-42"
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(6,8,13,0.96)_0%,rgba(6,8,13,0.72)_48%,rgba(6,8,13,0.26)_100%)]" />
        <div className="relative flex h-full flex-col justify-end">
          <p className="text-sm font-semibold uppercase text-accent">Account</p>
          <h1 className="mt-3 max-w-xl text-balance text-4xl font-black tracking-tight sm:text-5xl">Pick up where your tickets left off.</h1>
          <p className="mt-4 max-w-lg leading-7 text-white/68">
            Your bookings, payments, cancellations, and assistant conversations stay connected across every show.
          </p>
        </div>
      </section>
      <Card className="rounded-md shadow-xl shadow-black/8">
        <CardHeader>
          <CardTitle className="text-2xl font-black tracking-tight">Sign in</CardTitle>
          <CardDescription>Demo credentials are prefilled. Use the admin account from the README to manage catalog data.</CardDescription>
        </CardHeader>
        <CardContent>
      <form onSubmit={submit}>
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" className="mt-2" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Label className="mt-4 block" htmlFor="login-password">Password</Label>
        <Input id="login-password" className="mt-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {error && <Alert variant="destructive" className="mt-3"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button className="mt-5 w-full" type="submit">
          <LogIn className="h-4 w-4" />
          Sign in
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          New to CineBook? <Link className="font-semibold text-foreground underline" to="/register">Create account</Link>
        </p>
      </form>
        </CardContent>
      </Card>
    </main>
  );
}
