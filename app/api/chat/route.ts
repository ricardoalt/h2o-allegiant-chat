import { chatPost } from "@/lib/chat-handler-next";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  return chatPost({ request });
}
