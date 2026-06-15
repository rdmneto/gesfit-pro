import {
  BicepsFlexed,
  CalendarDays,
  Dumbbell,
  House,
  LogIn,
  LogOut,
  Ruler,
  Settings,
  ShoppingBag,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useSessionStore } from "../store/session";
import { useEnsureActiveTrainer } from "../lib/hooks";

interface NavItem {
  to: string;
  label: string;
  icon: typeof House;
  exact?: boolean;
}

export function AppFrame() {
  const user = useSessionStore((state) => state.user);
  const role = useSessionStore((state) => state.claims.role);
  const logout = useSessionStore((state) => state.logout);
  const isLogged = Boolean(user);
  const location = useLocation();

  // Mantém um treinador ativo selecionado para o aluno.
  useEnsureActiveTrainer(role === "student" ? user?.uid ?? null : null);

  const studentLinks: NavItem[] = [
    { to: "/app", label: "Início", icon: House, exact: true },
    { to: "/app/minhas-aulas", label: "Aulas", icon: ShoppingBag },
    { to: "/app/medidas", label: "Medidas", icon: Ruler },
    { to: "/app/meus-treinadores", label: "Treinadores", icon: BicepsFlexed },
    { to: "/app/ajustes", label: "Ajustes", icon: Settings },
  ];

  const trainerLinks: NavItem[] = [
    { to: "/app", label: "Página principal", icon: Dumbbell, exact: true },
    { to: "/app/agenda", label: "Agenda", icon: CalendarDays },
    { to: "/app/alunos", label: "Alunos", icon: Users },
    { to: "/app/ajustes", label: "Ajustes", icon: Settings },
  ];

  const publicLinks: NavItem[] = [
    { to: "/", label: "Início", icon: House, exact: true },
    { to: "/login", label: "Login", icon: LogIn },
  ];

  const onboardingLinks: NavItem[] = [
    { to: "/", label: "Início", icon: House, exact: true },
    { to: "/app", label: "Painel", icon: Dumbbell, exact: true },
  ];

  const links = isLogged
    ? role === "trainer"
      ? trainerLinks
      : role === "student"
        ? studentLinks
        : onboardingLinks
    : publicLinks;

  // Bottom nav uses a subset of the most important links
  const mobileLinks = links.slice(0, 5);

  function isNavActive(to: string, exact?: boolean) {
    if (exact) return location.pathname === to;
    return location.pathname.startsWith(to);
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-stone-950">
      {/* ── Desktop Header ───────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
          <NavLink
            to="/"
            className="flex items-center gap-2 text-base font-black tracking-tight text-stone-950"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700">
              <Dumbbell size={16} className="text-white" />
            </div>
            <span className="hidden sm:inline">Gesfit Pro</span>
          </NavLink>

          <nav
            aria-label="Navegação principal"
            className="hidden items-center gap-1 md:flex"
          >
            {links.map(({ to, label, icon: Icon, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  [
                    "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-all duration-150",
                    isActive
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "text-stone-600 hover:bg-stone-200/70 hover:text-stone-900",
                  ].join(" ")
                }
              >
                <Icon aria-hidden="true" size={16} />
                {label}
              </NavLink>
            ))}
            {isLogged && (
              <button
                type="button"
                className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-stone-500 transition-all duration-150 hover:bg-red-50 hover:text-red-700"
                onClick={() => logout()}
              >
                <LogOut aria-hidden="true" size={16} />
                Sair
              </button>
            )}
          </nav>

          {/* Mobile: show logout if logged in, or login link if not */}
          <div className="flex items-center gap-2 md:hidden">
            {isLogged ? (
              <button
                type="button"
                className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200"
                onClick={() => logout()}
                aria-label="Sair"
              >
                <LogOut size={18} />
              </button>
            ) : (
              <NavLink
                to="/login"
                className="focus-ring flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-stone-600 hover:bg-stone-200/70"
              >
                <LogIn size={18} />
                Login
              </NavLink>
            )}
          </div>
        </div>
      </header>

      {/* ── Page Content ─────────────────────────────────── */}
      <main className={isLogged ? "has-bottom-nav" : ""}>
        <Outlet />
      </main>

      {/* ── Mobile Bottom Navigation ──────────────────────── */}
      {isLogged && (
        <nav
          aria-label="Navegação mobile"
          className="bottom-nav md:hidden"
        >
          {mobileLinks.map(({ to, label, icon: Icon, exact }) => {
            const active = isNavActive(to, exact);
            return (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={["bottom-nav-item", active ? "active" : ""].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                <span className="bottom-nav-icon">
                  <Icon aria-hidden="true" size={22} />
                  {active && <span className="active-dot" />}
                </span>
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
}
