"use client";

import { nanoid } from "nanoid";
import type * as React from "react";
import { useState } from "react";
import { ChatInterface } from "@/components/chat-interface";

export function NewChatPage(): React.JSX.Element {
  const [threadId] = useState(() => nanoid());

  return <ChatInterface initialMessages={[]} threadId={threadId} />;
}
