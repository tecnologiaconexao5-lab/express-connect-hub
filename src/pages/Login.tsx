import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { getRedirectPath } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Truck, LogIn, Eye, EyeOff, Mail, Lock, AlertTriangle } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, error: authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const loadingRef = useRef(false);

  useEffect(() => {
    const expirada = sessionStorage.getItem("session_expired");
    if (expirada === "true") {
      setSessaoExpirada(true);
      sessionStorage.removeItem("session_expired");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    loadingRef.current = true;

    // Safety net: garante que loading para apos 30s mesmo que algo trave
    const safetyTimer = setTimeout(() => {
      if (loadingRef.current) {
        loadingRef.current = false;
        setLoading(false);
        setError("O servidor esta demorando para responder. Tente novamente.");
      }
    }, 30000);

    try {
      const user = await login(email, password);
      loadingRef.current = false;
      clearTimeout(safetyTimer);
      if (user) {
        const redirect = searchParams.get("redirect");
        if (redirect && (redirect.startsWith("/") || redirect.startsWith("http"))) {
          try {
            const url = new URL(redirect, window.location.origin);
            if (url.origin === window.location.origin) {
              navigate(url.pathname + url.search);
              return;
            }
          } catch { /* fallback para getRedirectPath */ }
        }
        navigate(getRedirectPath(user.role));
      }
      // Se login retornou null, o erro ja foi definido pelo AuthContext
    } catch (e: any) {
      setError(e?.message || "Erro inesperado ao fazer login");
    } finally {
      loadingRef.current = false;
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* LADO ESQUERDO - Imagem de Fundo */}
      <div className="hidden lg:flex lg:w-[60%] relative items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ 
            backgroundImage: "url('/assets/login-bg.png')"
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/10 to-transparent" />
        
        <div className="relative z-10 text-center text-white px-8" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-orange-500/20 backdrop-blur-sm mb-6">
              <Truck className="w-12 h-12 text-orange-400" />
            </div>
            <h1 className="text-5xl font-bold tracking-tight mb-3">Conexão Express</h1>
            <p className="text-xl text-white/80 font-light">Transportando com inteligência</p>
          </div>
          <div className="flex items-center justify-center gap-8 mt-12">
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-400">500+</p>
              <p className="text-sm text-white/60">Entregas/dia</p>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-400">98%</p>
              <p className="text-sm text-white/60">No prazo</p>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-400">50+</p>
              <p className="text-sm text-white/60">Cidades</p>
            </div>
          </div>
          <p className="text-sm text-white/30 mt-16">Sistema TMS Enterprise v2.0</p>
        </div>
      </div>

      {/* LADO DIREITO - Formulário */}
      <div className="w-full lg:w-[40%] flex items-center justify-center bg-white dark:bg-slate-900 px-8 py-12">
        <div className="w-full max-w-md">
          {/* Logo Mobile */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3">
              <Truck className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Conexão Express</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">Bem-vindo de volta</h2>
            <p className="text-muted-foreground">Acesse sua conta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  placeholder="seu@email.com.br"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {sessaoExpirada && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Sessão expirada</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">Sua sessão expirou. Faça login novamente para continuar.</p>
                </div>
              </div>
            )}

            {(error || authError) && (
              <p className="text-destructive text-sm text-center">{error || authError}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Entrar
                </>
              )}
            </button>

            <div className="text-center">
              <Link to="/forgot-password" className="text-sm text-orange-500 hover:text-orange-600 font-medium">
                Esqueci minha senha
              </Link>
            </div>
          </form>

            <p className="text-xs text-muted-foreground text-center mt-8">
            Use suas credenciais corporativas
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

