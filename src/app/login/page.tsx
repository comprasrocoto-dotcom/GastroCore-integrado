import LoginForm from "./LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const redirectTo = searchParams.redirect ?? "/";

  return (
    <main className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: "var(--bg)" }}>
      <div className="w-full max-w-sm rounded-2xl border border-black/5 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E3A5F] text-sm font-bold text-white">
            GC
          </span>
          <div>
            <h1 className="font-display text-lg font-bold text-[#1E3A5F]">Gastro Central</h1>
            <p className="text-xs text-slate-500">Ingreso al panel de costeo</p>
          </div>
        </div>

        <LoginForm redirectTo={redirectTo} />
      </div>
    </main>
  );
}
