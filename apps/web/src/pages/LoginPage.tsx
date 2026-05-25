import { FormEvent, useState } from "react";
import { api } from "../services/api";

type Props = {
  onSuccess: () => void;
};

export function LoginPage({ onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!password || loading) return;

    setLoading(true);
    setError(null);

    try {
      await api.post("/auth/login", { password });
      onSuccess();
    } catch (err: unknown) {
      const status =
        err &&
        typeof err === "object" &&
        "response" in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;

      if (status === 401) {
        setError("Senha incorreta.");
      } else if (status === 429) {
        setError("Muitas tentativas incorretas. Aguarde 5 minutos para tentar novamente.");
      } else {
        setError("Não foi possível autenticar. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Dot grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #a1a1aa 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Gradient vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,transparent_40%,rgba(250,250,250,0.9)_100%)] dark:bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,transparent_40%,rgba(9,9,11,0.9)_100%)]" />

      <div className="relative w-full max-w-sm px-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
              S
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Suporte Técnico
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Digite a senha para acessar
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
                autoComplete="current-password"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
            </div>

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-xl bg-zinc-800 px-6 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
            >
              {loading ? "Verificando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
