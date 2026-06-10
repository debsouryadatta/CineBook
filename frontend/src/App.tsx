import { Bot, Clapperboard, LayoutDashboard, LogOut, Menu, Ticket } from "lucide-react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, type User } from "./lib/api";
import { Button } from "./components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "./components/ui/sheet";
import { cn } from "./lib/utils";
import { HomePage } from "./pages/HomePage";
import { MoviePage } from "./pages/MoviePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { BookingsPage } from "./pages/BookingsPage";
import { AdminPage } from "./pages/AdminPage";
import { ChatPage } from "./pages/ChatPage";
import { ManagerPage } from "./pages/ManagerPage";

export type AuthState = {
  user: User | null;
  setUser: (user: User | null) => void;
};

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(localStorage.getItem("cinebook-token")));
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("cinebook-token")) {
      setAuthLoading(false);
      return;
    }
    api<{ user: User }>("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem("cinebook-token"))
      .finally(() => setAuthLoading(false));
  }, []);

  function logout() {
    localStorage.removeItem("cinebook-token");
    setUser(null);
    navigate("/");
  }

  const navItems = [
    { to: "/bookings", label: "Tickets", icon: Ticket, show: true },
    { to: "/chat", label: "Assistant", icon: Bot, show: Boolean(user) },
    { to: "/manager", label: "Manager", icon: LayoutDashboard, show: user?.role === "HALL_MANAGER" || user?.role === "ADMIN" },
    { to: "/admin", label: "Admin", icon: LayoutDashboard, show: user?.role === "ADMIN" }
  ].filter((item) => item.show);

  return (
    <div className="min-h-screen text-foreground">
      <header className="glass-header sticky top-0 z-30 border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-black tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-ink text-accent shadow-sm">
              <Clapperboard className="h-5 w-5" />
            </span>
            <span>CineBook</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {({ isActive }) => {
                  const Icon = item.icon;
                  return (
                    <Button variant="ghost" className={cn("px-3", isActive && "bg-foreground/7")}>
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  );
                }}
              </NavLink>
            ))}
            {user ? (
              <Button type="button" variant="secondary" onClick={logout}>
                <LogOut className="h-4 w-4" />
                {user.name.split(" ")[0]}
              </Button>
            ) : (
              <>
                <Link to="/register" className="hidden sm:block">
                  <Button variant="ghost" className="px-3">Create account</Button>
                </Link>
                <Link to="/login">
                  <Button>Sign in</Button>
                </Link>
              </>
            )}
          </nav>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[320px]">
              <SheetHeader>
                <SheetTitle>CineBook</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 grid gap-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SheetClose asChild key={item.to}>
                      <Link
                        to={item.to}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold hover:bg-accent hover:text-accent-foreground"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {item.label}
                      </Link>
                    </SheetClose>
                  );
                })}
                <div className="mt-3 grid gap-2 border-t border-border pt-4">
                  {user ? (
                    <Button type="button" variant="secondary" onClick={logout} className="justify-start">
                      <LogOut className="h-4 w-4" />
                      Sign out {user.name.split(" ")[0]}
                    </Button>
                  ) : (
                    <>
                      <SheetClose asChild>
                        <Link to="/login">
                          <Button className="w-full">Sign in</Button>
                        </Link>
                      </SheetClose>
                      <SheetClose asChild>
                        <Link to="/register">
                          <Button variant="secondary" className="w-full">Create account</Button>
                        </Link>
                      </SheetClose>
                    </>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/movies/:slug" element={<MoviePage user={user} authLoading={authLoading} />} />
        <Route path="/login" element={<LoginPage setUser={setUser} />} />
        <Route path="/register" element={<RegisterPage setUser={setUser} />} />
        <Route path="/bookings" element={authLoading ? <RouteLoading /> : user ? <BookingsPage /> : <Navigate to="/login" />} />
        <Route path="/chat" element={authLoading ? <RouteLoading /> : user ? <ChatPage /> : <Navigate to="/login" />} />
        <Route path="/manager" element={authLoading ? <RouteLoading /> : user?.role === "HALL_MANAGER" || user?.role === "ADMIN" ? <ManagerPage /> : <Navigate to="/" />} />
        <Route path="/admin" element={authLoading ? <RouteLoading /> : user?.role === "ADMIN" ? <AdminPage /> : <Navigate to="/" />} />
      </Routes>
    </div>
  );
}

function RouteLoading() {
  return <main className="mx-auto max-w-6xl px-4 py-10 text-muted-foreground sm:px-6">Restoring session...</main>;
}
