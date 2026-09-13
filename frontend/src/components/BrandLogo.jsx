/**
 * Shared brand mark — dark brown rounded square with scales of justice
 * and subtle laurel hints. Used on the landing page and navbar.
 */

export default function BrandLogo({ className = "brand-logo", size = 44 }) {
  return (
    <div className={className} aria-hidden="true">
      <svg viewBox="0 0 44 44" width={size} height={size} fill="none">
        <rect width="44" height="44" rx="12" fill="#3B2115" />
        {/* Laurel hints */}
        <path
          d="M8 34c2-4 5-6 9-7M36 34c-2-4-5-6-9-7"
          stroke="#B8894A"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M10 30c1.5-2 3.5-3.2 6-3.8M34 30c-1.5-2-3.5-3.2-6-3.8"
          stroke="#B8894A"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.4"
        />
        {/* Scales */}
        <line x1="22" y1="11" x2="22" y2="32" stroke="#F7EEDC" strokeWidth="2" strokeLinecap="round" />
        <line x1="14" y1="15" x2="30" y2="15" stroke="#F7EEDC" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 15l-2.5 6M14 15l2.5 6" stroke="#B8894A" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M8.5 21a5.5 5.5 0 0011 0" stroke="#B8894A" strokeWidth="1.8" fill="#B8894A" fillOpacity="0.2" strokeLinecap="round" />
        <path d="M30 15l-2.5 6M30 15l2.5 6" stroke="#B8894A" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M24.5 21a5.5 5.5 0 0011 0" stroke="#B8894A" strokeWidth="1.8" fill="#B8894A" fillOpacity="0.2" strokeLinecap="round" />
        <circle cx="22" cy="10" r="1.8" fill="#B8894A" />
        <line x1="18" y1="32" x2="26" y2="32" stroke="#F7EEDC" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}
