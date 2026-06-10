import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription } from "../components/ui/alert";
import { api, type User } from "../lib/api";

type Props = {
  setUser: (user: User | null) => void;
};

export function RegisterPage({ setUser }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const data = await api<{ user: User; token: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, phone: phone || undefined, password })
      });
      if (phone) {
        await api("/auth/phone/request", { method: "POST", body: JSON.stringify({ phone }) });
        await api("/auth/phone/verify", { method: "POST", body: JSON.stringify({ phone, code: "123456" }) });
      }
      localStorage.setItem("cinebook-token", data.token);
      setUser(data.user);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account");
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100svh-64px)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_430px]">
      <section className="relative overflow-hidden rounded-md bg-ink p-8 text-white shadow-2xl shadow-black/12 lg:min-h-[560px]">
        <img
          src="https://picsum.photos/seed/cinebook-register-city-lights/1200/900"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-58"
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(6,8,13,0.92)_0%,rgba(6,8,13,0.70)_48%,rgba(6,8,13,0.18)_100%)]" />
        <div className="relative flex h-full flex-col justify-end">
          <p className="text-sm font-semibold uppercase text-accent">New account</p>
          <h1 className="mt-3 max-w-xl text-balance text-4xl font-black tracking-tight sm:text-5xl">Start booking with your own ticket history.</h1>
          <p className="mt-4 max-w-lg leading-7 text-white/68">
            Reserve seats, track confirmations, and cancel upcoming shows from one calm account.
          </p>
        </div>
      </section>
      <Card className="rounded-md shadow-xl shadow-black/8">
        <CardHeader>
          <CardTitle className="text-2xl font-black tracking-tight">Create account</CardTitle>
          <CardDescription>Phone verification is simulated when a phone number is provided.</CardDescription>
        </CardHeader>
        <CardContent>
      <form onSubmit={submit}>
        <Label htmlFor="register-name">Name</Label>
        <Input
          id="register-name"
          className="mt-2"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
        />
        <Label className="mt-4 block" htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          className="mt-2"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Label className="mt-4 block" htmlFor="register-phone">Phone</Label>
        <Input
          id="register-phone"
          className="mt-2"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+919000000000"
        />
        <p className="mt-2 text-xs text-muted-foreground">Phone verification is simulated with code 123456.</p>
        <Label className="mt-4 block" htmlFor="register-password">Password</Label>
        <Input
          id="register-password"
          className="mt-2"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
        />
        {error && <Alert variant="destructive" className="mt-3"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button className="mt-5 w-full" type="submit">
          <UserPlus className="h-4 w-4" />
          Create account
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account? <Link className="font-semibold text-foreground underline" to="/login">Sign in</Link>
        </p>
      </form>
        </CardContent>
      </Card>
    </main>
  );
}
