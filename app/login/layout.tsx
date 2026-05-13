import "@aws-amplify/ui-react/styles.css";
import type * as React from "react";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <>{children}</>;
}
