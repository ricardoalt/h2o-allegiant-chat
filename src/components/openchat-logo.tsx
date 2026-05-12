import Image from "next/image";

export function OpenChatLogo({ className }: { className?: string }): React.JSX.Element {
  return (
    <Image
      src="/logo.svg"
      alt="SecondStream"
      className={`object-contain ${className ?? ""}`}
      height={40}
      priority
      width={200}
    />
  );
}
