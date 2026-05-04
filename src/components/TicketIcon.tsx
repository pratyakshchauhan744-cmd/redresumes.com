import { type SVGProps } from 'react';

export const TicketIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M7 9v6" />
    <path d="M17 9v6" />
  </svg>
);
