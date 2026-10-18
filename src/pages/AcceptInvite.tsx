import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, CheckCircle2, XCircle, Mail, Lock, Eye, EyeOff, Truck } from "lucide-react";

type Step = "loading" | "login" | "register" | "success" | "error";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const token = searchParams.get("token");

  const [step, setStep] = useState<Step>("loading");
  const [mensagem, setMensagem] = useState("");
  const [conviteInfo, setConviteInfo] = useState<any>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Verificar token ao montar
  useEffect(() => {
    if (!token) {
      setStep("error");
      setMensagem("Link invalido: token nao encontrado");
      return;
    }
    verificarToken(token);
  }, [token]);

  async function verificarToken(token: string) {
    try {
      const { data, error } = await supabase
        .from("convites")
        .select("id, tenant_id, email, papel, usado, expira_em, tenants!inner(nome)")
        .eq("token", token)
        .maybeSingle();

      if (error || !data) {
        setStep("error");
        setMensagem("Convite nao encontrado");
        return;
      }

      if (data.usado) {
        setStep("error");
        setMensagem("Este convite ja foi usado");
        return;
      }

      if (new Date(data.expira_em) < new Date()) {
        setStep("error");
        setMensagem("Este convite expirou. Solicite um novo ao administrador.");
        return;
      }

      setConviteInfo(data);
      setEmail(data.email);

      // Verificar se usuario ja esta logado
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await consumirConvite(token);
      } else {
        // Verificar se o usuario ja existe em auth.users
        const { data: existingUser } = await supabase.rpc("buscar_usuario_por_email", { p_email: data.email })
          .catch(() => ({ data: null }));

        if (existingUser && existingUser.length > 0) {
          setStep("login");
        } else {
          setStep("register");
        }
      }
    } catch (e: any) {
      setStep("error");
      setMensagem("Erro ao verificar convite: " + (e.message || "desconhecido"));
    }
  }

  async function consumirConvite(token: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("consumir_convite", { p_token: token });
      if (error) throw error;

      if (data && data.length > 0) {
        const result = data[0];
        if (result.valido) {
          setMensagem(result.mensagem);
          setStep("success");
        } else {
          setError(result.mensagem);
        }
      }
    } catch (e: any) {
      setError(e.message || "Erro ao consumir convite");
    }
    setLoading(false);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name || email.split("@")[0] } },
      });

      if (signUpError) throw signUpError;

      if (data?.user) {
        await consumirConvite(token!);
      } else {
        setMensagem("Conta criada! Verifique seu email para confirmar o cadastro.");
        setStep("success");
      }
    } catch (e: any) {
      setError(e.message || "Erro ao criar conta");
    }
    setLoading(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const user = await login(email, password);
    if (user) {
      await consumirConvite(token!);
    } else {
      setError("Email ou senha invalidos");
    }
    setLoading(false);
  }

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando seu convite...</p>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Convite Invalido</h1>
          <p className="text-muted-foreground mb-6">{mensagem}</p>
          <Link to="/login" className="text-primary hover:underline font-medium">
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">
            {mensagem.includes("Verifique") ? "Conta Criada!" : "Convite Aceito!"}
          </h1>
          <p className="text-muted-foreground mb-6">{mensagem}</p>
          {conviteInfo && (
            <p className="text-sm text-muted-foreground mb-6">
              Empresa: <strong>{(conviteInfo as any).tenants?.nome || conviteInfo.tenant_nome}</strong>
              <br />
              Papel: <strong>{conviteInfo.papel}</strong>
            </p>
          )}
          {mensagem.includes("Verifique") ? (
            <p className="text-xs text-muted-foreground">
              Apos confirmar o email, faca login normalmente.
            </p>
          ) : (
            <Link to="/dashboard" className="inline-block bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition">
              Ir para o Dashboard
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Truck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {step === "login" ? "Faca login" : "Crie sua conta"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Voce foi convidado para{" "}
            <strong>{conviteInfo?.tenants?.nome || ""}</strong>
          </p>
        </div>

        {step === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-muted text-foreground"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Sua senha"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition disabled:opacity-50">
              {loading ? "Entrando..." : "Entrar e aceitar convite"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-muted text-foreground"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Seu nome completo"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Minimo 6 caracteres"
                  required
                  minLength={6}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition disabled:opacity-50">
              {loading ? "Criando conta..." : "Criar conta e aceitar convite"}
            </button>
          </form>
        )}

        <p className="text-xs text-muted-foreground text-center mt-6">
          Ao continuar, voce aceita os termos de uso da plataforma.
        </p>
      </div>
    </div>
  );
}
