export const h2oBrand = {
  colors: {
    ink: "#0F172A",
    muted: "#64748B",
    line: "#CBD5E1",
    panel: "#F8FAFC",
    panelBlue: "#E8E9F4",
    lightCyan: "#F0FDFF",
    navy: "#03045E",
    blue: "#0090F0",
    cyan: "#ADFDFF",
    green: "#15803D",
    amber: "#D97706",
    gold: "#CA8A04",
    red: "#B91C1C",
    white: "#FFFFFF",
    stage: {
      lead: "#64748B",
      qualify: "#475569",
      scope: "#0090F0",
      position: "#0D9488",
      propose: "#15803D",
      close: "#7C3AED",
      default: "#64748B",
    },
    severity: {
      stop: "#B91C1C",
      specialist: "#D97706",
      attention: "#CA8A04",
      clear: "#64748B",
    },
  },
  font: {
    family: "Helvetica",
    bold: "Helvetica-Bold",
    mono: "Courier",
  },
  page: {
    size: "LETTER" as const,
    paddingX: 44,
    paddingY: 34,
    footerY: 752,
  },
  logo: {
    width: 72,
    height: 29,
  },
};

export const artifactLabels = {
  fieldBrief: "H2O Allegiant Field Brief",
  playbook: "H2O Allegiant Conversation Playbook",
  analyticalRead: "H2O Allegiant Analytical Read",
  proposalShell: "H2O Allegiant Proposal Shell",
};

export const themePalette = [
  "#0090F0",
  "#0D9488",
  "#475569",
  "#7C3AED",
  "#CA8A04",
  "#E11D48",
  "#15803D",
];

// Severity background tints — verbatim hex from brand.py _FLAG_SEVERITY_MAP / _GATE_STATE_MAP
export const severityBg = {
  stop: "#FBE7E7", // brand.py STOP / CLOSED tint
  specialist: "#FDF2E1", // brand.py SPECIALIST / CONDITIONAL tint
  attention: "#FDF7E1", // brand.py ATTENTION tint
  clear: "#F8FAFC", // brand.py LIGHT_BG_GREY
  openGreen: "#E8F5EC", // brand.py OPEN gate tint
} as const;

// Banner tone — full-width inverted banners
export const bannerTone = {
  red: { bg: "#B91C1C", text: "#FFFFFF" }, // brand.py GATE_CLOSED / FLAG_STOP
  amber: { bg: "#D97706", text: "#FFFFFF" }, // brand.py GATE_CONDITIONAL
  navy: { bg: "#03045E", text: "#FFFFFF" }, // brand.py BRAND_NAVY
} as const;

/**
 * Returns the theme accent color at position `i`, wrapping around the palette.
 * Handles negative indices with correct modulo semantics.
 * This is the canonical helper — Slice D will migrate playbookThemeAccentColor to delegate here.
 */
export const themeAccentByIndex = (i: number): string => {
  const len = themePalette.length;
  return themePalette[((i % len) + len) % len];
};
