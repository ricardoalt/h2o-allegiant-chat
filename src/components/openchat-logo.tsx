import { useTheme } from "@/hooks/use-theme";

export function OpenChatLogo({
  className,
}: {
  className?: string;
}): React.JSX.Element {
  const { theme, systemTheme } = useTheme();

  const currentTheme = theme === "system" ? systemTheme : theme;
  // Logos invertidos: en modo oscuro usar el logo claro, y viceversa
  const logoSrc = currentTheme === "dark" ? "/logo-light.svg" : "/logo-dark.svg";

  return (
    <img 
      src={logoSrc} 
      alt="SecondStream Logo" 
      className={`h-full w-auto object-contain ${className}`}
    />
  );
}
