import Image from "next/image";

type BrandSize = "nav" | "auth" | "footer" | "mini";

const sizeStyles: Record<BrandSize, string> = {
  nav: "w-[178px]",
  auth: "w-[220px]",
  footer: "w-[160px]",
  mini: "w-[120px]",
};

export default function BrandLogo({ size = "nav", className = "" }: { size?: BrandSize; className?: string }) {
  return (
    <Image
      src="/brand/time2pay-logo.svg"
      alt="Time2Pay"
      width={900}
      height={280}
      className={`block h-auto ${sizeStyles[size]} ${className}`}
      priority={size === "nav"}
    />
  );
}
