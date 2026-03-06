import type { Config } from "tailwindcss";

const config = {
    darkMode: ["class"],
    content: [
        "./src/**/*.{ts,tsx}",
    ],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            fontFamily: {
                display: ["var(--font-display)", "Georgia", "serif"],
                sans: ["var(--font-sans)", "system-ui", "sans-serif"],
            },
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                // ── Brand: Forest (Earth Green — deep & sophisticated)
                primary: {
                    DEFAULT: "#0d3321",
                    foreground: "#f9f6f0",
                    hover: "#1a5c33",
                },
                // ── Brand alias: forest
                forest: {
                    DEFAULT: "#0d3321",
                    hover: "#1a5c33",
                    light: "#e8f0e3",
                },
                // ── Urgency: Ember (Last Chance — vibrant, impulsive)
                ember: {
                    DEFAULT: "#e84c1e",
                    foreground: "#ffffff",
                    hover: "#ff6635",
                    glow: "rgba(232,76,30,0.15)",
                },
                // ── Keep backward compat alias: citrus → ember
                citrus: {
                    DEFAULT: "#e84c1e",
                    foreground: "#ffffff",
                    hover: "#ff6635",
                },
                // ── Neutral system
                cream: {
                    DEFAULT: "#f9f6f0",
                    dark: "#eee9df",
                },
                sage: {
                    DEFAULT: "#e8f0e3",
                    dark: "#c8dabb",
                },
                soil: {
                    DEFAULT: "#2a1a0e",
                    light: "#6b4f3a",
                },
                // ── Semantic tokens
                secondary: {
                    DEFAULT: "#e8f0e3", // sage
                    foreground: "#0d3321",
                    hover: "#c8dabb",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted, 60 17% 93%))",
                    foreground: "hsl(var(--muted-foreground, 30 15% 42%))",
                },
                accent: {
                    DEFAULT: "#e8f0e3",
                    foreground: "#0d3321",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive, 0 84.2% 60.2%))",
                    foreground: "hsl(var(--destructive-foreground, 0 0% 98%))",
                },
                card: {
                    DEFAULT: "#f9f6f0",
                    foreground: "#2a1a0e",
                },
            },
            borderRadius: {
                // Controlled, not exaggerated
                xl: "0.75rem",
                lg: "0.5rem",
                md: "0.375rem",
                sm: "0.25rem",
            },
            boxShadow: {
                card: "0 2px 8px -2px rgba(13,51,33,0.08), 0 1px 3px -1px rgba(13,51,33,0.06)",
                "card-hover": "0 12px 40px -12px rgba(13,51,33,0.22), 0 4px 16px -4px rgba(13,51,33,0.12)",
                "ember-glow": "0 0 20px -4px rgba(232,76,30,0.35)",
            },
            keyframes: {
                "pulse-ember": {
                    "0%, 100%": {
                        opacity: "1",
                        boxShadow: "0 0 0 0 rgba(232,76,30,0.0)",
                    },
                    "50%": {
                        opacity: "0.9",
                        boxShadow: "0 0 0 4px rgba(232,76,30,0.2)",
                    },
                },
                "slide-up-fade": {
                    "0%": { opacity: "0", transform: "translateY(6px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
            },
            animation: {
                "pulse-ember": "pulse-ember 1.8s ease-in-out infinite",
                "slide-up-fade": "slide-up-fade 0.3s ease-out forwards",
            },
        },
    },
    plugins: [],
} satisfies Config;

export default config;
