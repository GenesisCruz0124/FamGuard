export const colors = {
  primary: "#2563eb",
  primaryDark: "#1d4ed8",
  primarySoft: "#eff6ff",
  danger: "#dc2626",
  dangerSoft: "#fef2f2",
  success: "#16a34a",
  successSoft: "#f0fdf4",
  warningSoft: "#fffbeb",
  warning: "#b45309",
  text: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
  surface: "#ffffff",
  background: "#f8fafc",
  disabled: "#94a3b8",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const typography = {
  title: { fontSize: 28, fontWeight: "700" as const, color: colors.text },
  subtitle: { fontSize: 15, fontWeight: "400" as const, color: colors.textMuted },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
  },
  body: { fontSize: 16, color: colors.text },
  caption: { fontSize: 12, color: colors.textMuted },
};

export const shadow = {
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};
