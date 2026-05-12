import type * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ThreadLoading(): React.JSX.Element {
  return (
    <main className="flex h-dvh flex-col" aria-busy="true" aria-label="Loading chat">
      <div className="flex-1 space-y-6 overflow-hidden px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <Skeleton className="h-16 w-3/4 rounded-2xl" />
          <Skeleton className="ml-auto h-24 w-4/5 rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
      <div className="border-t bg-background px-4 py-4 md:px-8">
        <Skeleton className="mx-auto h-16 max-w-3xl rounded-2xl" />
      </div>
    </main>
  );
}
