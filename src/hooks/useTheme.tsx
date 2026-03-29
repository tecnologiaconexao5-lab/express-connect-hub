import { useState, useEffect, createContext, useContext } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme") as Theme;
      if (saved) return saved;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.style.setProperty("--background", "222 47% 11%");
      root.style.setProperty("--foreground", "210 40% 98%");
      root.style.setProperty("--card", "217 33% 17%");
      root.style.setProperty("--card-foreground", "210 40% 98%");
      root.style.setProperty("--popover", "217 33% 17%");
      root.style.setProperty("--popover-foreground", "210 40% 98%");
      root.style.setProperty("--primary", "24 95% 53%");
      root.style.setProperty("--primary-foreground", "0 0% 100%");
      root.style.setProperty("--secondary", "217 33% 17%");
      root.style.setProperty("--secondary-foreground", "210 40% 98%");
      root.style.setProperty("--muted", "217 33% 20%");
      root.style.setProperty("--muted-foreground", "215 20% 65%");
      root.style.setProperty("--accent", "217 33% 22%");
      root.style.setProperty("--accent-foreground", "210 40% 98%");
      root.style.setProperty("--destructive", "0 62% 50%");
      root.style.setProperty("--destructive-foreground", "210 40% 98%");
      root.style.setProperty("--border", "217 33% 25%");
      root.style.setProperty("--input", "217 33% 25%");
      root.style.setProperty("--ring", "24 95% 53%");
      root.style.setProperty("--sidebar-bg", "222 47% 8%");
      root.style.setProperty("--sidebar-fg", "215 20% 65%");
      root.style.setProperty("--sidebar-hover", "217 38% 15%");
      root.style.setProperty("--sidebar-active", "24 95% 53%");
      root.style.setProperty("--sidebar-active-fg", "0 0% 100%");
      root.style.setProperty("--topbar-bg", "217 33% 18%");
      root.style.setProperty("--topbar-fg", "215 20% 65%");
    } else {
      root.classList.remove("dark");
      root.style.setProperty("--background", "210 20% 98%");
      root.style.setProperty("--foreground", "215 28% 17%");
      root.style.setProperty("--card", "0 0% 100%");
      root.style.setProperty("--card-foreground", "215 28% 17%");
      root.style.setProperty("--popover", "0 0% 100%");
      root.style.setProperty("--popover-foreground", "215 28% 17%");
      root.style.setProperty("--primary", "24 95% 53%");
      root.style.setProperty("--primary-foreground", "0 0% 100%");
      root.style.setProperty("--secondary", "213 50% 12%");
      root.style.setProperty("--secondary-foreground", "210 20% 98%");
      root.style.setProperty("--muted", "210 20% 95%");
      root.style.setProperty("--muted-foreground", "215 16% 47%");
      root.style.setProperty("--accent", "213 50% 12%");
      root.style.setProperty("--accent-foreground", "210 20% 98%");
      root.style.setProperty("--destructive", "0 84% 60%");
      root.style.setProperty("--destructive-foreground", "0 0% 100%");
      root.style.setProperty("--border", "214 20% 90%");
      root.style.setProperty("--input", "214 20% 90%");
      root.style.setProperty("--ring", "24 95% 53%");
      root.style.setProperty("--sidebar-bg", "216 50% 12%");
      root.style.setProperty("--sidebar-fg", "210 20% 85%");
      root.style.setProperty("--sidebar-hover", "216 40% 18%");
      root.style.setProperty("--sidebar-active", "24 95% 53%");
      root.style.setProperty("--sidebar-active-fg", "0 0% 100%");
      root.style.setProperty("--topbar-bg", "210 32% 17%");
      root.style.setProperty("--topbar-fg", "210 20% 90%");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
