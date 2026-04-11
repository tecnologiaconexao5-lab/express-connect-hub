import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login, getRedirectPath } from "@/lib/auth";
import { Truck, LogIn, Eye, EyeOff, Mail, Lock } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="min-h-screen flex">
      {/* LADO ESQUERDO - Imagem de Fundo */}
      <div className="hidden lg:flex lg:w-[60%] relative items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ 
            backgroundImage: "url('https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1920&q=80')"
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/70 to-slate-900/30" />
        
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-20" />
        
        <div className="relative z-10 text-center text-white px-8">
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

            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
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
              <a href="#" className="text-sm text-orange-500 hover:text-orange-600 font-medium">
                Esqueci minha senha
              </a>
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
