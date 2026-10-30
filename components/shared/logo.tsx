import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "full" | "icon";
  theme?: "light" | "dark";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  href?: string;
}

// Proporções reais do asset public/logo-completa.png (283x95 -> ratio ~2.98).
// Manter width/height coerentes com a classe de altura evita qualquer
// letterbox (object-contain cortando as bordas do logo).
const SIZE_MAP = {
  sm: { width: 95, height: 32, className: "h-8" },
  md: { width: 119, height: 40, className: "h-10" },
  lg: { width: 143, height: 48, className: "h-12" },
  xl: { width: 191, height: 64, className: "h-16" },
};

export function Logo({
  variant = "full",
  theme = "light",
  size = "md",
  className,
  href,
}: LogoProps) {
  const sizing = SIZE_MAP[size];

  // No tema dark (sidebar slate-900), usa versão clara
  // Como só temos a versão laranja, ela funciona em ambos os contextos
  // (laranja contrasta bem com dark E light backgrounds)
  const src =
    variant === "icon" ? "/logo-direta.png" : "/logo-completa.png";

  const content = (
    <Image
      src={src}
      alt="Direta Cursos"
      width={sizing.width}
      height={sizing.height}
      className={cn(
        "w-auto object-contain",
        sizing.className,
        theme === "dark" ? "brightness-110" : "",
        className
      )}
      priority
    />
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center">
        {content}
      </Link>
    );
  }

  return content;
}
