import type { SVGProps } from 'react'

// A compact line-icon set drawn in a schematic style (1.6px stroke, currentColor).
const paths = {
  overview: (<><rect x="3.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.2" /></>),
  topology: (<><circle cx="5" cy="12" r="2.4" /><circle cx="19" cy="6" r="2.4" /><circle cx="19" cy="18" r="2.4" /><path d="M7.2 11 16.8 6.6M7.2 13 16.8 17.4" /></>),
  sites: (<><path d="M4 20V7l8-3 8 3v13" /><path d="M4 20h16" /><path d="M9 20v-5h6v5" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></>),
  tunnels: (<><circle cx="5.5" cy="12" r="2.2" /><circle cx="18.5" cy="12" r="2.2" /><path d="M7.7 12h8.6" strokeDasharray="2.5 2.5" /></>),
  gateways: (<><rect x="3.5" y="8" width="17" height="9" rx="1.6" /><path d="M7 12.5h.01M11 12.5h5" /><path d="M12 8V4M9.5 4h5" /></>),
  cloud: (<><path d="M7 18a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17.5 11 3.5 3.5 0 0 1 17 18Z" /></>),
  users: (<><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 6.5a3 3 0 0 1 0 5.8M20.5 19a5 5 0 0 0-3.5-4.4" /></>),
  sessions: (<><path d="M3 12h3l2.5 6 4-14 2.5 8H21" /></>),
  resources: (<><ellipse cx="12" cy="6" rx="7" ry="2.8" /><path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6" /><path d="M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6" /></>),
  vault: (<><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><circle cx="12" cy="15" r="1.4" /></>),
  monitoring: (<><path d="M3 12h4l2-5 3 10 2.5-7 1.5 2H21" /></>),
  analytics: (<><path d="M4 20V4" /><path d="M4 20h16" /><rect x="7" y="12" width="3" height="5" /><rect x="12" y="8" width="3" height="9" /><rect x="17" y="14" width="3" height="3" /></>),
  settings: (<><line x1="4" y1="8" x2="20" y2="8" /><circle cx="9" cy="8" r="2.3" /><line x1="4" y1="16" x2="20" y2="16" /><circle cx="15" cy="16" r="2.3" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></>),
  moon: (<><path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" /></>),
  logout: (<><path d="M15 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9" /><path d="M15 12H9M18.5 12l-3-3M18.5 12l-3 3" /></>),
  chevronRight: (<><path d="M9 6l6 6-6 6" /></>),
  chevronDown: (<><path d="M6 9l6 6 6-6" /></>),
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>),
  plus: (<><path d="M12 5v14M5 12h14" /></>),
  close: (<><path d="M6 6l12 12M18 6 6 18" /></>),
  check: (<><path d="M5 12.5 10 17.5 19 7" /></>),
  alert: (<><path d="M12 3 22 20H2Z" /><path d="M12 10v4M12 17h.01" /></>),
  shield: (<><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6Z" /><path d="M9 12l2 2 4-4" /></>),
  copy: (<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>),
  download: (<><path d="M12 4v10M8 11l4 4 4-4" /><path d="M5 19h14" /></>),
  signal: (<><path d="M5 18v-3M10 18v-6M15 18v-9M20 18V6" /></>),
  menu: (<><path d="M4 7h16M4 12h16M4 17h16" /></>),
  refresh: (<><path d="M20 11a8 8 0 1 0-.7 4.5" /><path d="M20 5v6h-6" /></>),
  route: (<><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8 16.5 15.8 8" strokeDasharray="2.5 2" /></>),
  dot: (<><circle cx="12" cy="12" r="4" /></>),
  qr: (<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h3v3M20 14v6M14 20h3" /></>),
  key: (<><circle cx="8" cy="8" r="4" /><path d="M11 11l8 8M16 16l2-2M18.5 18.5 20 17" /></>),
  eye: (<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>),
  eyeOff: (<><path d="M4 4l16 16" /><path d="M9.6 5.4A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17.3 17.3 0 0 1-3.3 3.9M6.2 6.3A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 3.4-.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>),
}

export type IconName = keyof typeof paths

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {paths[name]}
    </svg>
  )
}
