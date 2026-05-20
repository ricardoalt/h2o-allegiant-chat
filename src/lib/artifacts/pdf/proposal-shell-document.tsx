import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ProposalShellPayload } from "../payloads";
import { h2oBrand } from "./brand-tokens";
import {
  DataTable,
  Footer,
  FullWidthBanner,
  KVTable,
  MinimalContinuationHeader,
  MinimalHeader,
  SectionHeader,
  tier2ContinuationTopReserve,
} from "./shared-document";

// ─── Pure helpers (testable, no React) ───────────────────────────────────────

/** Returns the left-accent bar color for the executive summary block. */
export const proposalExecSummaryAccentColor = (): string => h2oBrand.colors.blue;

export const proposalBannerDefaultsToTrue = (field?: boolean): boolean => field !== false;

export const PROPOSAL_TOP_BANNER_TEXT =
  "DRAFT INTENT — STAGE: LEAD · THIS IS NOT A CUSTOMER-FACING DRAFT";

export const PROPOSAL_BOTTOM_BANNER_TEXT =
  "Treat this document as Internal scoping intent only. Refresh at every stage advance.";

export const buildGatesToCloseColumns = (rows: Array<Record<string, string>>) => {
  const keys = Object.keys(rows[0] ?? {});
  if (!keys.length) {
    return [];
  }
  const flexBasis = Math.floor(450 / keys.length);
  return keys.map((key) => ({ key, header: key, flexBasis }));
};

type ProposalCommitment = ProposalShellPayload["commitments"][number];

export const shouldRenderCommitments = (
  commitments?: ProposalShellPayload["commitments"],
): boolean => Boolean(commitments?.length);

export const proposalCommitmentMetaLine = (
  commitment: Pick<ProposalCommitment, "date" | "owner">,
): string | undefined =>
  [commitment.date, commitment.owner].filter(Boolean).join(" · ") || undefined;

export const proposalShellPagePaddingTop = tier2ContinuationTopReserve;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    color: h2oBrand.colors.ink,
    fontFamily: h2oBrand.font.family,
    fontSize: 8.4,
    lineHeight: 1.18,
    paddingBottom: 34,
    paddingHorizontal: h2oBrand.page.paddingX,
    paddingTop: proposalShellPagePaddingTop,
  },
  section: {
    marginBottom: 6,
  },
  body: {
    fontSize: 8.2,
    lineHeight: 1.15,
    marginBottom: 2,
  },
  // Executive summary block — left accent, denser line height
  execSummaryBlock: {
    backgroundColor: h2oBrand.colors.panelBlue,
    borderLeftColor: h2oBrand.colors.blue,
    borderLeftWidth: 3,
    color: h2oBrand.colors.navy,
    fontFamily: h2oBrand.font.bold,
    fontSize: 8.2,
    lineHeight: 1.15,
    marginBottom: 2,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  // Scope bullets — consistent glyph, tight indent matching Field Brief
  bullet: {
    display: "flex",
    flexDirection: "row",
    gap: 5,
    marginBottom: 1.5,
  },
  bulletDot: {
    color: h2oBrand.colors.blue,
    fontFamily: h2oBrand.font.bold,
    width: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 8.2,
    lineHeight: 1.15,
  },
  // Panel treatment for risk/funding blocks
  panelBlock: {
    backgroundColor: h2oBrand.colors.panel,
    borderColor: h2oBrand.colors.line,
    borderRadius: 3,
    borderWidth: 0.5,
    marginBottom: 2,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  panelBody: {
    fontSize: 8.2,
    lineHeight: 1.15,
  },
  statusBody: {
    fontSize: 8.2,
    lineHeight: 1.16,
    marginBottom: 4,
  },
  outOfScopeItem: {
    marginBottom: 4,
  },
  outOfScopeHeading: {
    color: h2oBrand.colors.navy,
    fontFamily: h2oBrand.font.bold,
    fontSize: 8.1,
    marginBottom: 1,
  },
  commitmentMeta: {
    color: h2oBrand.colors.muted,
    fontFamily: "Helvetica-Oblique",
    fontSize: 7,
    marginTop: 1,
  },
  // Commit cards — tighter internal spacing
  commitGrid: {
    display: "flex",
    flexDirection: "row",
    gap: 6,
    marginBottom: 3,
  },
  commitCard: {
    borderColor: h2oBrand.colors.line,
    borderRadius: 4,
    borderWidth: 0.8,
    flex: 1,
    padding: 5,
  },
  commitTitle: {
    color: h2oBrand.colors.navy,
    fontFamily: h2oBrand.font.bold,
    fontSize: 8,
    marginBottom: 2,
  },
});

// ─── Components ───────────────────────────────────────────────────────────────

const BulletList = ({ items }: { items: string[] }) => (
  <View>
    {items.map((item) => (
      <View key={item} style={styles.bullet}>
        <Text style={styles.bulletDot}>•</Text>
        <Text style={styles.bulletText}>{item}</Text>
      </View>
    ))}
  </View>
);

const Commitments = ({ items }: { items: ProposalCommitment[] }) => (
  <View style={styles.commitGrid}>
    {items.map((item) => {
      const meta = proposalCommitmentMetaLine(item);
      return (
        <View key={`${item.label}-${item.text}`} style={styles.commitCard}>
          <Text style={styles.commitTitle}>{item.label}</Text>
          <Text style={styles.bulletText}>{item.text}</Text>
          {meta ? <Text style={styles.commitmentMeta}>{meta}</Text> : null}
        </View>
      );
    })}
  </View>
);

export const ProposalShellDocument = ({ payload }: { payload: ProposalShellPayload }) => {
  const commitments = payload.commitments;
  const gatesColumns = buildGatesToCloseColumns(payload.gatesToClose ?? []);
  return (
    <Document
      author="SecondstreamAI"
      subject="H2O Allegiant Proposal Shell"
      title={`${payload.customer.name} Proposal Shell`}
    >
      <Page size={h2oBrand.page.size} style={styles.page}>
        <View
          fixed
          render={({ pageNumber }) =>
            pageNumber === 1 ? null : (
              <MinimalContinuationHeader
                artifactLabel="Proposal Shell"
                customerName={payload.customer.name}
                site={payload.customer.location}
              />
            )
          }
        />
        <MinimalHeader
          artifactLabel="Proposal Shell"
          basin={payload.customer.basin}
          county={payload.customer.county ?? ""}
          customerName={payload.customer.name}
          date=""
          site={payload.customer.location}
          state={payload.customer.state ?? ""}
        />
        {proposalBannerDefaultsToTrue(payload.draftIntentBanner) ? (
          <FullWidthBanner tone="red" text={PROPOSAL_TOP_BANNER_TEXT} />
        ) : null}
        <View style={styles.section}>
          <SectionHeader color={proposalExecSummaryAccentColor()}>Executive summary</SectionHeader>
          <Text style={styles.execSummaryBlock}>{payload.executiveSummary}</Text>
        </View>
        {payload.statusOfDocument ? (
          <View style={styles.section}>
            <SectionHeader color={h2oBrand.colors.navy}>Status of this document</SectionHeader>
            <Text style={styles.statusBody}>{payload.statusOfDocument}</Text>
          </View>
        ) : null}
        {payload.workPackages?.length ? (
          <View style={styles.section}>
            <SectionHeader color={h2oBrand.colors.navy}>Work packages</SectionHeader>
            <DataTable
              columns={[
                { key: "name", header: "Work package", flexBasis: 200 },
                { key: "outcome", header: "Outcome / deliverable", flexBasis: 250 },
              ]}
              headerStyle="navy-dark"
              rows={payload.workPackages.map((row) => ({ name: row.name, outcome: row.outcome }))}
            />
          </View>
        ) : null}
        <View style={styles.section}>
          <SectionHeader color={h2oBrand.colors.green}>Proposed scope</SectionHeader>
          <BulletList items={payload.proposedScope} />
        </View>
        <View style={styles.section}>
          <SectionHeader color={h2oBrand.colors.navy}>Sizing and pricing</SectionHeader>
          {payload.sizingRows?.length ? (
            <KVTable rows={payload.sizingRows} />
          ) : (
            <Text style={styles.body}>{payload.sizingAndPricing}</Text>
          )}
        </View>
        <View style={styles.section}>
          <SectionHeader color={h2oBrand.colors.navy}>Schedule</SectionHeader>
          <Text style={styles.body}>{payload.schedule}</Text>
        </View>
        {payload.outOfScope?.length ? (
          <View style={styles.section}>
            <SectionHeader color={h2oBrand.colors.navy}>Out of scope</SectionHeader>
            {payload.outOfScope.map((item) => (
              <View key={item.heading} style={styles.outOfScopeItem}>
                <Text style={styles.outOfScopeHeading}>{item.heading}</Text>
                <Text style={styles.body}>{item.body}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {payload.gatesToClose?.length ? (
          <View style={styles.section}>
            <SectionHeader color={h2oBrand.colors.navy}>Gates to close</SectionHeader>
            <DataTable
              columns={gatesColumns}
              headerStyle="navy-light"
              rows={payload.gatesToClose}
            />
          </View>
        ) : null}
        {shouldRenderCommitments(commitments) ? (
          <View style={styles.section} wrap={false}>
            <SectionHeader color={h2oBrand.colors.navy}>Commitments</SectionHeader>
            <Commitments items={commitments} />
          </View>
        ) : null}
        {payload.fundingPathway ? (
          <View style={styles.section}>
            <SectionHeader color={h2oBrand.colors.navy}>Funding pathway</SectionHeader>
            <View style={styles.panelBlock}>
              <Text style={styles.panelBody}>{payload.fundingPathway}</Text>
            </View>
          </View>
        ) : null}
        {payload.riskAllocation ? (
          <View style={styles.section}>
            <SectionHeader color={h2oBrand.colors.red}>Risk allocation</SectionHeader>
            <View
              style={[
                styles.panelBlock,
                {
                  borderColor: h2oBrand.colors.red,
                  borderLeftColor: h2oBrand.colors.red,
                  borderLeftWidth: 2,
                },
              ]}
            >
              <Text style={styles.panelBody}>{payload.riskAllocation}</Text>
            </View>
          </View>
        ) : null}
        {proposalBannerDefaultsToTrue(payload.internalOnlyFooterBanner) ? (
          <FullWidthBanner tone="red" text={PROPOSAL_BOTTOM_BANNER_TEXT} />
        ) : null}
        <Footer />
      </Page>
    </Document>
  );
};

export const renderProposalShellPdf = async (payload: ProposalShellPayload): Promise<Buffer> =>
  renderToBuffer(<ProposalShellDocument payload={payload} />);
