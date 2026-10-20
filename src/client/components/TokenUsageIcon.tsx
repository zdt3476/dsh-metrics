import type { FC } from 'react'

export const TokenUsageIcon: FC<{ size?: number }> = ({ size = 20 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', verticalAlign: 'middle' }}
    >
      <path
        d="M3 13.5L7 9.5L11 13.5L16 6.5L21 11.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="6.5" r="2" fill="currentColor" />
      <path
        d="M4 19H20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.4"
      />
      <path
        d="M8 19V17M12 19V16M16 19V17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.4"
      />
    </svg>
  )
}
