/* أيقونات خط بسيطة (stroke) — بلا مكتبة خارجية، بنفس روح لوحات SaaS الحديثة */
type IconProps = { className?: string };

const base = "h-5 w-5";

export function HomeIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BuildingIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 3 4 7v13h16V7l-8-4Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12v8M9 21v-4a3 3 0 0 1 6 0v4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="8" r="1.5" />
    </svg>
  );
}

export function UsersIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.5 13a5 5 0 0 1 5.5 5" strokeLinecap="round" />
    </svg>
  );
}

export function BookIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 5.5v16" strokeLinecap="round" />
    </svg>
  );
}

export function TrendUpIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 17 9 11l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 6h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LinkIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M9.5 14.5 14.5 9.5" strokeLinecap="round" />
      <path d="M11 7l1.5-1.5a3.5 3.5 0 0 1 5 5L16 12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 17l-1.5 1.5a3.5 3.5 0 0 1-5-5L8 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LogoutIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12h11M9 8l-5 4 5 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function ShieldIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
