import Image from "next/image";

export function H2OAllegiantLogo({ className }: { className?: string }): React.JSX.Element {
  return (
    <Image
      src="/h2o-allegiant.png"
      alt="H2O Allegiant"
      className={`object-contain ${className ?? ""}`}
      height={40}
      priority
      width={204}
    />
  );
}
