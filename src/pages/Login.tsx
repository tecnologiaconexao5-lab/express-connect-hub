import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, getRedirectPath } from "@/lib/auth";
import { Truck, LogIn } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTimeout(() => {
      const user = login(email, password);
      if (user) {
        navigate(getRedirectPath(user.role));
      } else {
        setError("Email ou senha inválidos");
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md mx-4 animate-fade-in">
        <div className="bg-card rounded-2xl shadow-2xl p-10 border border-border/50">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4">
              <Truck className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Conexão Express</h1>
            <p className="text-muted-foreground text-sm mt-1">Sistema de Gestão de Transportes</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                placeholder="seu@email.com.br"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Entrar
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center mb-2">Acesso demonstração:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="bg-muted rounded-md p-2">
                <span className="font-medium">Admin:</span><br />
                admin@conexaoexpress.com.br
              </div>
              <div className="bg-muted rounded-md p-2">
                <span className="font-medium">Operador:</span><br />
                operador@conexaoexpress.com.br
              </div>
              <div className="bg-muted rounded-md p-2">
                <span className="font-medium">Cliente:</span><br />
                cliente@empresa.com.br
              </div>
              <div className="bg-muted rounded-md p-2">
                <span className="font-medium">Prestador:</span><br />
                prestador@logistica.com.br
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">Senha: admin123 / oper123 / cli123 / prest123</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
