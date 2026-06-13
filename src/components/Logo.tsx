interface LogoMarkProps {
  size?: number
  className?: string
}

export function LogoMark({ size = 28, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
      <rect width="32" height="32" rx="7" fill="#1D4ED8" />
      {/* C arc — drawn as SVG arc, not a letter */}
      <path
        d="M 22.5 9.5 A 10.5 10.5 0 1 0 22.5 24.5"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Dot in the C opening — suggests a claim being processed */}
      <circle cx="25.5" cy="17" r="2" fill="white" opacity="0.5" />
    </svg>
  )
}

interface LogoProps {
  size?: number
  className?: string
  textClassName?: string
}

export function Logo({ size = 28, className, textClassName }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark size={size} />
      <span className={`font-semibold tracking-tight ${textClassName ?? "text-sm text-gray-900"}`}>
        Claima
      </span>
    </div>
  )
}
