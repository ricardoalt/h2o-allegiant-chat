import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PlaybookPayload } from "../payloads";
import { themeAccentByIndex } from "./brand-tokens";
import {
  Footer,
  InsightBox,
  MinimalContinuationHeader,
  MinimalHeader,
  WhyItMattersCallout,
} from "./shared-document";

// ─── Pure helpers (testable, no React) ───────────────────────────────────────

/**
 * Builds the customerSite string for MinimalHeader from Playbook customer fields.
 * Returns "{name} — {location}" when location is present, "{name}" otherwise.
 */
export const buildPlaybookCustomerSite = ({
  name,
  location,
}: {
  name: string;
  location?: string;
}): string => (location ? `${name} — ${location}` : name);

/**
 * Returns the theme accent color at position `i`.
 * @deprecated Delegates to `themeAccentByIndex` from brand-tokens — use that directly for new code.
 */
export const playbookThemeAccentColor = (index: number): string => themeAccentByIndex(index);

/**
 * Returns the same accent color used for the theme header bottom border.
 * @deprecated Use `themeAccentByIndex` directly.
 */
export const playbookThemeHeaderAccentBorderColor = (index: number): string =>
  playbookThemeAccentColor(index);

/**
 * Returns true when a question string is a sub-prompt (starts with em-dash
 * or en-dash), allowing typographic differentiation without payload changes.
 */
export const playbookIsSubPrompt = (question: string): boolean =>
  question.startsWith("—") || question.startsWith("–");

export const playbookContinuationLabel = (customerName: string): string =>
  `${customerName} · Playbook (continued)`;

export type ResolvedPlaybookHeaderFields = {
  subStreamsSummary?: string;
  stageIntro?: string;
  insight?: string;
};

/**
 * Resolves spec-name Playbook header fields with backward-compatible aliases.
 * Preference order: spec names first, then aliases, then legacy orientation for insight.
 */
export const resolvePlaybookHeaderFields = (
  header?: PlaybookPayload["header"],
  legacyOrientation?: string,
): ResolvedPlaybookHeaderFields => ({
  subStreamsSummary:
    header?.subStreams && header.subStreams.length > 0
      ? header.subStreams.join(", ")
      : header?.subStreamsSummary,
  stageIntro: header?.stageIntro ?? header?.leadStageIntro,
  insight: header?.insight ?? header?.stageInsight ?? legacyOrientation,
});

export const resolvePlaybookThemeAccent = (
  theme: Pick<PlaybookPayload["themes"][number], "accentIndex">,
  position: number,
): string => themeAccentByIndex(theme.accentIndex ?? position);

/**
 * Returns true when the WhyItMattersCallout should be rendered.
 * Guards against undefined and empty arrays for graceful degradation.
 */
export const shouldRenderWhyItMatters = (items?: string[]): boolean =>
  Array.isArray(items) && items.length > 0;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    color: "#0F172A",
    fontFamily: "Helvetica",
    fontSize: 8.4,
    lineHeight: 1.18,
    paddingBottom: 34,
    paddingHorizontal: 44,
    paddingTop: 34,
  },
  pageWithContinuation: {
    paddingTop: 48,
  },
  // Sub-streams summary line — italic, muted, below MinimalHeader
  // Per discovery #4773: use "Helvetica-Oblique" for italic text (not fontStyle on a bold family)
  subStreamsSummary: {
    color: "#64748B",
    fontFamily: "Helvetica-Oblique",
    fontSize: 8,
    lineHeight: 1.2,
    marginBottom: 4,
  },
  // Lead-stage intro paragraph — italic, muted
  // Per discovery #4773: "Helvetica-Oblique" for italic body text
  leadStageIntro: {
    color: "#64748B",
    fontFamily: "Helvetica-Oblique",
    fontSize: 8.2,
    lineHeight: 1.25,
    marginBottom: 5,
  },
  themeBlock: {
    marginBottom: 8,
  },
  themeHeader: {
    borderBottomWidth: 1.2,
    display: "flex",
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
    paddingBottom: 3,
  },
  themeNumber: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    lineHeight: 1.1,
    width: 20,
  },
  themeTitleColumn: {
    flex: 1,
  },
  themeTitle: {
    color: "#03045E",
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    lineHeight: 1.2,
  },
  // Why-line in accent color — italic, directly under title
  // Per discovery #4773: "Helvetica-Oblique" explicitly; NOT fontFamily "Helvetica-Bold" + fontStyle
  themeWhyLine: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 8,
    lineHeight: 1.18,
    marginTop: 1,
  },
  substreamLabel: {
    color: "#03045E",
    fontFamily: "Helvetica-Bold",
    fontSize: 6.8,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  question: {
    display: "flex",
    flexDirection: "row",
    gap: 5,
    marginBottom: 2,
  },
  questionDot: {
    width: 8,
  },
  questionText: {
    flex: 1,
    fontSize: 8.2,
    lineHeight: 1.22,
  },
  // Sub-prompt: typographically muted, indented one level
  subPrompt: {
    display: "flex",
    flexDirection: "row",
    gap: 4,
    marginBottom: 1.5,
    paddingLeft: 12,
  },
  subPromptDot: {
    color: "#64748B",
    fontSize: 7,
    width: 7,
  },
  // Per discovery #4773: "Helvetica-Oblique" for italic sub-prompt text
  subPromptText: {
    color: "#64748B",
    flex: 1,
    fontFamily: "Helvetica-Oblique",
    fontSize: 7.6,
    lineHeight: 1.18,
  },
});

// ─── Components ───────────────────────────────────────────────────────────────

const ThemeBlock = ({
  index,
  theme,
}: {
  index: number;
  theme: PlaybookPayload["themes"][number];
}) => {
  // Use explicit accentIndex when provided; fall back to position-based index
  const accent = resolvePlaybookThemeAccent(theme, index);
  const whyItMatters = theme.whyItMatters;

  return (
    <View style={styles.themeBlock} wrap={false}>
      <View style={[styles.themeHeader, { borderBottomColor: accent }]}>
        <Text style={[styles.themeNumber, { color: accent }]}>{index + 1}</Text>
        <View style={styles.themeTitleColumn}>
          <Text style={styles.themeTitle}>{theme.title}</Text>
          {/* Framing renders as italic why-line in accent color */}
          {theme.framing ? (
            <Text style={[styles.themeWhyLine, { color: accent }]}>{theme.framing}</Text>
          ) : null}
        </View>
      </View>
      {theme.substreamTag ? (
        <Text style={styles.substreamLabel}>Sub-stream: {theme.substreamTag}</Text>
      ) : null}
      {theme.questions.map((question) => {
        if (playbookIsSubPrompt(question)) {
          return (
            <View key={question} style={styles.subPrompt}>
              <Text style={styles.subPromptDot}>›</Text>
              <Text style={styles.subPromptText}>{question.replace(/^[–—]\s*/, "")}</Text>
            </View>
          );
        }
        return (
          <View key={question} style={styles.question}>
            <Text style={[styles.questionDot, { color: accent }]}>•</Text>
            <Text style={styles.questionText}>{question}</Text>
          </View>
        );
      })}
      {shouldRenderWhyItMatters(whyItMatters) && whyItMatters ? (
        <WhyItMattersCallout items={whyItMatters} accentColor={accent} />
      ) : null}
    </View>
  );
};

export const PlaybookDocument = ({ payload }: { payload: PlaybookPayload }) => {
  const resolvedHeader = resolvePlaybookHeaderFields(payload.header, payload.orientation);

  return (
    <Document
      author="SecondstreamAI"
      subject="H2O Allegiant Conversation Playbook"
      title={`${payload.customer.name} Playbook`}
    >
      <Page size="LETTER" style={styles.page}>
        {/* Tier 2 text-only continuation header: no logo, no stage badge (R5) */}
        <View
          fixed
          render={({ pageNumber }) =>
            pageNumber === 1 ? null : (
              <MinimalContinuationHeader
                customerName={payload.customer.name}
                site={payload.customer.location}
                artifactLabel="Playbook"
                pageNumber={pageNumber}
              />
            )
          }
        />
        {/* Tier 2 text-only header: no logo, no stage badge (R1, R2) */}
        <MinimalHeader
          customerName={payload.customer.name}
          site={payload.customer.location}
          county={payload.customer.county ?? ""}
          state={payload.customer.state ?? ""}
          basin={payload.customer.basin}
          date=""
          artifactLabel="Playbook"
        />
        {/* Sub-streams summary line — italic, muted (R7) */}
        {resolvedHeader.subStreamsSummary ? (
          <Text style={styles.subStreamsSummary}>{resolvedHeader.subStreamsSummary}</Text>
        ) : null}
        {/* Lead-stage intro paragraph — italic (R7) */}
        {resolvedHeader.stageIntro ? (
          <Text style={styles.leadStageIntro}>{resolvedHeader.stageIntro}</Text>
        ) : null}
        {/* Stage insight box (R7) with legacy orientation fallback */}
        {resolvedHeader.insight ? <InsightBox>{resolvedHeader.insight}</InsightBox> : null}
        {payload.themes.map((theme, index) => (
          <ThemeBlock key={theme.title} index={index} theme={theme} />
        ))}
        <Footer />
      </Page>
    </Document>
  );
};

export const renderPlaybookPdf = async (payload: PlaybookPayload): Promise<Buffer> =>
  renderToBuffer(<PlaybookDocument payload={payload} />);
