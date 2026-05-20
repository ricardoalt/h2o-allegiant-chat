"use client";

import type { ToolUIPart } from "ai";
import { fetchAuthSession } from "aws-amplify/auth";
import { DownloadIcon, ExternalLinkIcon } from "lucide-react";
import type * as React from "react";
import { type ComponentType, type SVGProps, useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { ArtifactToolUIOutput } from "@/types/ui-message";

export type ArtifactCardIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type ArtifactToolCardProps = {
  Icon: ArtifactCardIcon;
  title: string;
  state: ToolUIPart["state"];
  output?: ArtifactToolUIOutput | null;
  errorText?: string;
};

type PresignDisposition = "inline" | "attachment";

type PresignResponse = { url?: unknown };

export const resolveArtifactPresignedUrl = async (
  downloadUrl: string,
  disposition: PresignDisposition,
): Promise<string> => {
  const session = await fetchAuthSession();
  const token = session.tokens?.accessToken?.toString();
  if (!token) {
    throw new Error("Sign in to download artifacts.");
  }
  const requestUrl = new URL(downloadUrl, "http://artifact.local");
  requestUrl.searchParams.set("disposition", disposition);
  const response = await fetch(requestUrl.toString(), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Artifact request failed (${response.status}).`);
  }
  const body = (await response.json()) as PresignResponse;
  if (typeof body.url !== "string" || body.url.length === 0) {
    throw new Error("Artifact response did not include a URL.");
  }
  return body.url;
};

export function ArtifactToolCard({
  Icon,
  title,
  state,
  output,
  errorText,
}: ArtifactToolCardProps): React.JSX.Element | null {
  if (state === "input-streaming" || state === "input-available") {
    const message =
      state === "input-streaming"
        ? `Preparing ${title.toLowerCase()}…`
        : `Generating ${title.toLowerCase()}…`;

    return (
      <div className="not-prose w-full rounded-lg border bg-card px-3 py-3 sm:max-w-sm">
        <div className="flex items-center gap-3">
          <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-xs">{title}</p>
            <Shimmer as="p" className="text-xs">
              {message}
            </Shimmer>
          </div>
        </div>
      </div>
    );
  }

  if (state === "output-error") {
    return (
      <div
        role="alert"
        className="not-prose w-full rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 sm:max-w-sm"
      >
        <div className="flex items-start gap-3">
          <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-xs">{title}</p>
            <p className="text-destructive/90 text-xs">
              {errorText ?? `Could not generate ${title.toLowerCase()}.`}
            </p>
            <p className="mt-1 text-muted-foreground text-xs">Ask the agent to retry.</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "output-available" && output && output.status !== "ready") {
    return (
      <div className="not-prose w-full rounded-lg border bg-card px-3 py-3 sm:max-w-sm">
        <div className="flex items-center gap-3">
          <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-xs">{output.title || title}</p>
            <Shimmer as="p" className="text-xs">
              {output.message}
            </Shimmer>
          </div>
        </div>
      </div>
    );
  }

  const pdf = output?.status === "ready" ? output.formats[0] : undefined;
  if (state === "output-available" && pdf?.downloadUrl) {
    return (
      <ReadyArtifactCard
        Icon={Icon}
        title={output?.title ?? title}
        filename={pdf.filename}
        downloadUrl={pdf.downloadUrl}
      />
    );
  }

  return (
    <div className="not-prose w-full rounded-lg border bg-card px-3 py-3 sm:max-w-sm">
      <div className="flex items-center gap-3">
        <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-xs">{title}</p>
          <Shimmer as="p" className="text-xs">
            {`Preparing ${title.toLowerCase()}…`}
          </Shimmer>
        </div>
      </div>
    </div>
  );
}

type ReadyArtifactCardProps = {
  Icon: ArtifactCardIcon;
  title: string;
  filename: string;
  downloadUrl: string;
};

function ReadyArtifactCard({
  Icon,
  title,
  filename,
  downloadUrl,
}: ReadyArtifactCardProps): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PresignDisposition | null>(null);

  const open = async (disposition: PresignDisposition): Promise<void> => {
    setError(null);
    setPending(disposition);
    try {
      const url = await resolveArtifactPresignedUrl(downloadUrl, disposition);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open artifact.");
    } finally {
      setPending(null);
    }
  };

  const buttonClass =
    "inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 font-medium text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="not-prose w-full rounded-lg border bg-card px-3 py-3 sm:max-w-sm">
      <div className="flex items-start gap-3">
        <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-xs">{title}</p>
          <p className="truncate text-muted-foreground text-xs" title={filename}>
            {filename}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label={`View ${filename} in a new tab`}
          className={buttonClass}
          disabled={pending !== null}
          onClick={() => {
            void open("inline");
          }}
          title={`View ${filename}`}
        >
          <ExternalLinkIcon aria-hidden className="size-3.5" />
          {pending === "inline" ? "Opening…" : "View"}
        </button>
        <button
          type="button"
          aria-label={`Download ${filename}`}
          className={buttonClass}
          disabled={pending !== null}
          onClick={() => {
            void open("attachment");
          }}
          title={`Download ${filename}`}
        >
          <DownloadIcon aria-hidden className="size-3.5" />
          {pending === "attachment" ? "Preparing…" : "Download"}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-destructive/90 text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
