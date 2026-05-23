import type { Metadata } from "next";
import type * as React from "react";
import { NewChatPage } from "@/components/new-chat-page";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ new?: string }>;
};

export default async function ChatPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const resetKey = params.new ?? "initial";

  return <NewChatPage key={resetKey} />;
}
