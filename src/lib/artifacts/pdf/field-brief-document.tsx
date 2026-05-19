import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { FieldBriefPayload } from "../payloads";
import { h2oBrand } from "./brand-tokens";
import { Footer, InsightBox, LogoMark, SectionHeader, StageBadge } from "./shared-document";

const styles = StyleSheet.create({
  page: {
    color: h2oBrand.colors.ink,
    fontFamily: h2oBrand.font.family,
    fontSize: 8.4,
    lineHeight: 1.18,
    paddingBottom: 34,
    paddingHorizontal: h2oBrand.page.paddingX,
    paddingTop: h2oBrand.page.paddingY,
  },
  pageWithContinuation: {
    paddingTop: 48,
  },
  continuationHeader: {
    alignItems: "center",
    borderBottomColor: h2oBrand.colors.line,
    borderBottomWidth: 1,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    left: h2oBrand.page.paddingX,
    paddingBottom: 4,
    position: "absolute",
    right: h2oBrand.page.paddingX,
    top: 16,
  },
  continuationMiddle: {
    color: h2oBrand.colors.navy,
    flex: 1,
    fontFamily: h2oBrand.font.bold,
    fontSize: 7.5,
    marginHorizontal: 10,
    textAlign: "center",
  },
  section: {
    marginBottom: 7,
  },
  body: {
    fontSize: 8.2,
    lineHeight: 1.18,
    marginBottom: 3,
  },
  subhead: {
    color: h2oBrand.colors.navy,
    fontFamily: h2oBrand.font.bold,
    fontSize: 8.4,
    marginBottom: 2,
    marginTop: 1,
  },
  bullet: {
    display: "flex",
    flexDirection: "row",
    gap: 4,
    marginBottom: 2,
  },
  bulletDot: {
    color: h2oBrand.colors.blue,
    width: 6,
  },
  bulletText: {
    flex: 1,
  },
  table: {
    marginTop: 3,
  },
  tableRow: {
    borderBottomColor: h2oBrand.colors.line,
    borderBottomWidth: 0.5,
    display: "flex",
    flexDirection: "row",
  },
  // Plain text header — no background panel, no navy border (R6)
  tableHeaderPlain: {
    borderBottomColor: h2oBrand.colors.line,
    borderBottomWidth: 0.5,
  },
  tableTotal: {
    backgroundColor: h2oBrand.colors.panelBlue,
    borderBottomWidth: 0,
    paddingVertical: 1,
  },
  tableCell: {
    fontSize: 6.7,
    lineHeight: 1.08,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  componentCell: {
    width: "30%",
  },
  pathCell: {
    borderLeftColor: h2oBrand.colors.line,
    borderLeftWidth: 0.5,
    width: "35%",
  },
  // Plain column header text — navy bold, no inverted background
  headerText: {
    color: h2oBrand.colors.navy,
    fontFamily: h2oBrand.font.bold,
  },
  totalText: {
    fontFamily: h2oBrand.font.bold,
    fontSize: 7.2,
  },
  totalNegative: {
    color: h2oBrand.colors.red,
  },
  totalPositive: {
    color: h2oBrand.colors.green,
  },
  // Shared card row layout — risk and action cards both use flat numeral pattern (R6)
  cardRow: {
    display: "flex",
    flexDirection: "row",
    gap: 6,
    marginBottom: 5,
  },
  // Flat numeral — large navy, no background, no border (R6: replaces circle + rounded box)
  flatNumeral: {
    color: h2oBrand.colors.navy,
    fontFamily: h2oBrand.font.bold,
    fontSize: 14,
    lineHeight: 1.0,
    width: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: h2oBrand.colors.navy,
    fontFamily: h2oBrand.font.bold,
    fontSize: 8.6,
    marginBottom: 1,
  },
  // Italic colored body line for risk mechanism (R6)
  // @react-pdf base fonts: use "Helvetica-Oblique" for italic (not fontStyle on Helvetica)
  riskMechanism: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 8.2,
    lineHeight: 1.18,
    marginBottom: 2,
  },
  mitigation: {
    color: h2oBrand.colors.muted,
    fontSize: 7.5,
    fontStyle: "italic",
    lineHeight: 1.12,
  },
  // Italic timeframe for action cards (R6)
  timeframe: {
    color: h2oBrand.colors.blue,
    fontFamily: "Helvetica-Oblique",
  },
  stopFlag: {
    borderColor: h2oBrand.colors.red,
    borderRadius: 5,
    borderWidth: 0.8,
    marginBottom: 4,
    padding: 5,
  },
  muted: {
    color: h2oBrand.colors.muted,
    fontSize: 7.5,
  },
  // R6: italic sensitivity caption under cost table total
  sensitivityCaption: {
    color: h2oBrand.colors.muted,
    fontFamily: "Helvetica-Oblique",
    fontSize: 7.5,
  },
  // Narrative risk callout block (R6, Option A)
  narrativeCallout: {
    marginBottom: 6,
  },
  narrativeCalloutItem: {
    fontSize: 8.2,
    lineHeight: 1.2,
    marginBottom: 3,
  },
  // R3: Field Brief cover block (local — avoids modifying shared-document.tsx in Slice C)
  cover: {
    marginBottom: 10,
  },
  coverTop: {
    alignItems: "center",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  coverTitle: {
    color: h2oBrand.colors.navy,
    fontFamily: h2oBrand.font.bold,
    fontSize: 15,
    lineHeight: 1.04,
    marginBottom: 1,
  },
  coverMetadata: {
    borderBottomColor: h2oBrand.colors.line,
    borderBottomWidth: 1,
    color: h2oBrand.colors.muted,
    fontSize: 7.5,
    lineHeight: 1.15,
    paddingBottom: 3,
  },
});

export type FieldBriefSectionKey =
  | "what-this-is"
  | "what-we-would-propose"
  | "what-could-kill-it"
  | "do-this-next";

export const sectionMarkerColor = (section: FieldBriefSectionKey): string => {
  if (section === "what-we-would-propose") return h2oBrand.colors.green;
  if (section === "what-could-kill-it") return h2oBrand.colors.red;
  if (section === "do-this-next") return h2oBrand.colors.navy;
  return h2oBrand.colors.blue;
};

export const riskRankColor = (rank: number): string =>
  rank === 1 ? h2oBrand.colors.severity.stop : h2oBrand.colors.severity.specialist;

export const fieldBriefContinuationLabel = (customerName: string): string =>
  `${customerName} · Field Brief (continued)`;

export type CostColumn = "component" | "theirPath" | "ourProposal";
export type CostRowStyleRole = "body" | "total-label" | "total-negative" | "total-positive";

type CostRows = FieldBriefPayload["sections"]["whatWeWouldPropose"]["costOfAlternativeRows"];

export const splitCostRowsForTwoPageBrief = (
  rows: CostRows,
): {
  pageOneRows: CostRows;
  pageTwoRows: CostRows;
} => {
  if (rows.length <= 3) return { pageOneRows: rows, pageTwoRows: [] };
  return { pageOneRows: rows.slice(0, 2), pageTwoRows: rows.slice(2) };
};

export const costRowStyleRole = ({
  column,
  isTotal,
}: {
  column: CostColumn;
  isTotal?: boolean;
}): CostRowStyleRole => {
  if (!isTotal) return "body";
  if (column === "theirPath") return "total-negative";
  if (column === "ourProposal") return "total-positive";
  return "total-label";
};

/**
 * Builds the Field Brief H1 title (R3).
 * Format: `{customer.name} — {customer.location}` when location is present;
 * falls back to `{customer.name}` when location is absent or empty (R11 backward compat).
 */
export const buildFieldBriefTitle = ({
  name,
  location,
}: {
  name: string;
  location?: string;
}): string => {
  if (location && location.trim().length > 0) {
    return `${name} — ${location}`;
  }
  return name;
};

/**
 * Builds the Field Brief header metadata line.
 * Format: `{County}, {State} ({Basin})? · {Date}? · Field Brief · Internal handover`
 * County+state are omitted silently when either is absent (R11 backward compat).
 * Basin parenthetical is omitted when basin is absent.
 */
export const buildFieldBriefMetadataLine = ({
  county,
  state,
  basin,
  date,
}: {
  county?: string;
  state?: string;
  basin?: string;
  date?: string;
}): string => {
  const parts: string[] = [];

  if (county && state) {
    const location = basin ? `${county}, ${state} (${basin})` : `${county}, ${state}`;
    parts.push(location);
  }

  if (date) parts.push(date);
  parts.push("Field Brief");
  parts.push("Internal handover");

  return parts.join(" · ");
};

/**
 * Determines how to render stop flags/narrative risk callouts (design §4 Option A).
 *
 * | narrativeRiskCallouts | stopFlags       | result      |
 * |-----------------------|-----------------|-------------|
 * | non-empty array       | any             | 'narrative' |
 * | absent / empty        | non-empty array | 'blocks'    |
 * | absent / empty        | absent / empty  | 'none'      |
 */
export const chooseStopFlagPresentation = ({
  narrativeRiskCallouts,
  stopFlags,
}: {
  narrativeRiskCallouts?: string[];
  stopFlags?: Array<{ title: string; summary: string }>;
}): "narrative" | "blocks" | "none" => {
  if (narrativeRiskCallouts && narrativeRiskCallouts.length > 0) return "narrative";
  if (stopFlags && stopFlags.length > 0) return "blocks";
  return "none";
};

const costCellStyle = (column: CostColumn, isTotal?: boolean) => {
  const role = costRowStyleRole({ column, isTotal });
  const widthStyle = column === "component" ? styles.componentCell : styles.pathCell;

  if (role === "total-negative") {
    return [styles.tableCell, widthStyle, styles.totalText, styles.totalNegative];
  }
  if (role === "total-positive") {
    return [styles.tableCell, widthStyle, styles.totalText, styles.totalPositive];
  }
  if (role === "total-label") {
    return [styles.tableCell, widthStyle, styles.totalText];
  }
  return [styles.tableCell, widthStyle];
};

// R3: Local cover block — H1 = "{Customer} — {Site}", small logo, metadata from helper
// Using LogoMark + StageBadge from shared-document; local styles to avoid Slice A territory.
const FieldBriefCover = ({
  title,
  metadataLine,
  stage,
}: {
  title: string;
  metadataLine: string;
  stage: string;
}) => (
  <View style={styles.cover}>
    <View style={styles.coverTop}>
      <LogoMark size="sm" />
      <StageBadge stage={stage} />
    </View>
    <Text style={styles.coverTitle}>{title}</Text>
    <Text style={styles.coverMetadata}>{metadataLine}</Text>
  </View>
);

const Bullet = ({ lead, body }: { lead: string; body: string }) => (
  <View style={styles.bullet}>
    <Text style={styles.bulletDot}>•</Text>
    <Text style={styles.bulletText}>
      <Text style={{ fontFamily: h2oBrand.font.bold }}>{lead}: </Text>
      {body}
    </Text>
  </View>
);

// R6: Plain text column headers, thin row separators, bold last-row total + italic sensitivity
const CostTable = ({ rows }: { rows: CostRows }) => (
  <View style={styles.table}>
    <View style={[styles.tableRow, styles.tableHeaderPlain]}>
      <Text style={[styles.tableCell, styles.componentCell, styles.headerText]}>
        Cost component
      </Text>
      <Text style={[styles.tableCell, styles.pathCell, styles.headerText]}>Their path</Text>
      <Text style={[styles.tableCell, styles.pathCell, styles.headerText]}>Our proposal</Text>
    </View>
    {rows.map((row) => (
      <View
        key={`${row.component}-${row.theirPath}`}
        style={row.isTotal ? [styles.tableRow, styles.tableTotal] : styles.tableRow}
      >
        <Text style={costCellStyle("component", row.isTotal)}>{row.component}</Text>
        <Text style={costCellStyle("theirPath", row.isTotal)}>{row.theirPath}</Text>
        <Text style={costCellStyle("ourProposal", row.isTotal)}>{row.ourProposal}</Text>
      </View>
    ))}
  </View>
);

const StopFlags = ({ flags }: { flags: NonNullable<FieldBriefPayload["stopFlags"]> }) => {
  if (!flags.length) return null;

  return (
    <View style={styles.section}>
      <SectionHeader color={sectionMarkerColor("what-could-kill-it")}>Stop flags</SectionHeader>
      {flags.map((flag) => (
        <View key={flag.title} style={styles.stopFlag} wrap={false}>
          <Text style={styles.cardTitle}>{flag.title}</Text>
          <Text>{flag.summary}</Text>
        </View>
      ))}
    </View>
  );
};

// R6, Option A: inline prose narrative risk callouts (suppress stopFlags when populated)
const NarrativeCallouts = ({ callouts }: { callouts: string[] }) => (
  <View style={styles.narrativeCallout}>
    <SectionHeader color={sectionMarkerColor("what-could-kill-it")}>Risk context</SectionHeader>
    {callouts.map((item, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: narrative items have no stable key
      <Text key={i} style={styles.narrativeCalloutItem}>
        {item}
      </Text>
    ))}
  </View>
);

// R5: Continuation header retains logo (small) + customer + "Field Brief (continued)" + stage badge
const ContinuationHeader = ({ customerName, stage }: { customerName: string; stage: string }) => (
  <View fixed style={styles.continuationHeader}>
    <LogoMark size="sm" />
    <Text style={styles.continuationMiddle}>{fieldBriefContinuationLabel(customerName)}</Text>
    <StageBadge stage={stage} />
  </View>
);

// R6: Risk card with flat numeral (no circle), bold title, italic colored mechanism, italic muted mitigation
const RiskCard = ({
  rank,
  risk,
}: {
  rank: number;
  risk: FieldBriefPayload["sections"]["whatCouldKillIt"]["risks"][number];
}) => (
  <View style={styles.cardRow} wrap={false}>
    <Text style={styles.flatNumeral}>{rank}</Text>
    <View style={styles.cardContent}>
      <Text style={styles.cardTitle}>{risk.name}</Text>
      <Text style={[styles.riskMechanism, { color: riskRankColor(rank) }]}>{risk.mechanism}</Text>
      <Text style={styles.mitigation}>Mitigation: {risk.mitigation}</Text>
    </View>
  </View>
);

// R6: Action card with flat numeral (no rounded box), bold title, italic timeframe, body paragraph
const ActionCard = ({
  action,
  index,
}: {
  action: FieldBriefPayload["sections"]["doThisNext"]["actions"][number];
  index: number;
}) => (
  <View style={styles.cardRow} wrap={false}>
    <Text style={styles.flatNumeral}>{index + 1}</Text>
    <View style={styles.cardContent}>
      <Text style={styles.cardTitle}>
        {action.title} <Text style={styles.timeframe}>· {action.timeframe}</Text>
      </Text>
      <Text style={styles.body}>{action.body}</Text>
    </View>
  </View>
);

export const FieldBriefDocument = ({ payload }: { payload: FieldBriefPayload }) => {
  const proposal = payload.sections.whatWeWouldPropose;
  const risks = payload.sections.whatCouldKillIt.risks;
  const actions = payload.sections.doThisNext.actions;
  const { pageOneRows, pageTwoRows } = splitCostRowsForTwoPageBrief(proposal.costOfAlternativeRows);

  // R3: H1 = `{customer.name} — {customer.location}` with name-only fallback
  const title = buildFieldBriefTitle({
    name: payload.customer.name,
    location: payload.customer.location,
  });

  // R3: Metadata line via pure helper
  const metadataLine = buildFieldBriefMetadataLine({
    county: payload.customer.county,
    state: payload.customer.state,
    basin: payload.customer.basin,
    date: payload.date,
  });

  // R6, Option A: choose stop-flag presentation mode
  const stopFlagMode = chooseStopFlagPresentation({
    narrativeRiskCallouts: payload.narrativeRiskCallouts,
    stopFlags: payload.stopFlags,
  });

  return (
    <Document
      author="SecondstreamAI"
      subject="H2O Allegiant Field Brief"
      title={`${payload.customer.name} Field Brief`}
    >
      <Page size={h2oBrand.page.size} style={styles.page}>
        {/* R3: FieldBriefCover — H1 = customer name only, small logo, metadata from helper */}
        <FieldBriefCover title={title} metadataLine={metadataLine} stage={payload.stage} />

        {/* R6, Option A: narrative callouts woven between "What this is" and "What we'd propose" */}
        {stopFlagMode === "narrative" && payload.narrativeRiskCallouts ? (
          <NarrativeCallouts callouts={payload.narrativeRiskCallouts} />
        ) : null}
        {stopFlagMode === "blocks" ? <StopFlags flags={payload.stopFlags ?? []} /> : null}

        <View style={styles.section}>
          <SectionHeader color={sectionMarkerColor("what-this-is")}>What this is</SectionHeader>
          <InsightBox>{payload.sections.whatThisIs.insight}</InsightBox>
          <Text style={styles.body}>{payload.sections.whatThisIs.body}</Text>
        </View>

        <View style={styles.section}>
          <SectionHeader color={sectionMarkerColor("what-we-would-propose")}>
            What we'd propose
          </SectionHeader>
          <InsightBox>{proposal.insight}</InsightBox>
          <Text style={styles.subhead}>Recommended approach</Text>
          <Text style={styles.body}>{proposal.recommendedApproach}</Text>
          <Text style={styles.subhead}>
            Why the customer should want this — the win-win argument
          </Text>
          {proposal.winWinArguments.map((argument) => (
            <Bullet key={argument.lead} lead={argument.lead} body={argument.body} />
          ))}
          <Text style={styles.subhead}>Cost of the alternative — fully priced over 5 years</Text>
          <CostTable rows={pageOneRows} />
          {proposal.dealSizeSensitivity && !pageTwoRows.length ? (
            <Text style={styles.sensitivityCaption}>
              Sensitivity: {proposal.dealSizeSensitivity}
            </Text>
          ) : null}
        </View>
        {/* R4: Footer text-only, no label prop */}
        <Footer />
      </Page>

      <Page size={h2oBrand.page.size} style={[styles.page, styles.pageWithContinuation]}>
        <ContinuationHeader customerName={payload.customer.name} stage={payload.stage} />
        {pageTwoRows.length ? (
          <View style={styles.section}>
            <CostTable rows={pageTwoRows} />
            {proposal.dealSizeSensitivity ? (
              <Text style={styles.sensitivityCaption}>
                Sensitivity: {proposal.dealSizeSensitivity}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.section}>
          <SectionHeader color={sectionMarkerColor("what-could-kill-it")}>
            What could kill it
          </SectionHeader>
          <InsightBox>{payload.sections.whatCouldKillIt.insight}</InsightBox>
          {risks.map((risk, index) => (
            <RiskCard key={risk.name} rank={index + 1} risk={risk} />
          ))}
        </View>

        <View style={styles.section}>
          <SectionHeader color={sectionMarkerColor("do-this-next")}>Do this next</SectionHeader>
          <InsightBox>{payload.sections.doThisNext.insight}</InsightBox>
          {actions.map((action, index) => (
            <ActionCard key={action.title} action={action} index={index} />
          ))}
        </View>
        {/* R4: Footer text-only, no label prop */}
        <Footer />
      </Page>
    </Document>
  );
};

export const renderFieldBriefPdf = async (payload: FieldBriefPayload): Promise<Buffer> =>
  renderToBuffer(<FieldBriefDocument payload={payload} />);
