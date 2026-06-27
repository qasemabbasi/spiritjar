interface GhostIconProps {
  artKey: string;
  className?: string;
}

export function GhostIcon({ artKey, className = "w-24 h-24" }: GhostIconProps) {
  switch (artKey) {
    case 'fat_ghost':
      return (
        <svg viewBox="0 0 100 100" className={className}>
          <path d="M 20 60 C 20 20, 80 20, 80 60 L 80 85 Q 70 75, 60 85 Q 50 75, 40 85 Q 30 75, 20 85 Z" fill="#c4b5fd" stroke="#8b5cf6" strokeWidth="4" />
          <circle cx="40" cy="48" r="4" fill="#312e81" />
          <circle cx="60" cy="48" r="4" fill="#312e81" />
          <path d="M 45 58 Q 50 64, 55 58" fill="none" stroke="#312e81" strokeWidth="3" strokeLinecap="round" />
          {/* Chubby cheeks */}
          <circle cx="32" cy="54" r="5" fill="#f43f5e" opacity="0.4" />
          <circle cx="68" cy="54" r="5" fill="#f43f5e" opacity="0.4" />
          {/* Tiny arms */}
          <path d="M 20 55 Q 10 50, 14 42" fill="none" stroke="#8b5cf6" strokeWidth="4" strokeLinecap="round" />
          <path d="M 80 55 Q 90 50, 86 42" fill="none" stroke="#8b5cf6" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case 'lantern_ghost':
      return (
        <svg viewBox="0 0 100 100" className={className}>
          <path d="M 30 55 C 30 25, 70 25, 70 55 L 70 85 Q 60 78, 50 85 Q 40 78, 30 85 Z" fill="#fed7aa" stroke="#f97316" strokeWidth="4" />
          <circle cx="43" cy="45" r="3.5" fill="#7c2d12" />
          <circle cx="57" cy="45" r="3.5" fill="#7c2d12" />
          <path d="M 46 52 Q 50 56, 54 52" fill="none" stroke="#7c2d12" strokeWidth="2.5" strokeLinecap="round" />
          {/* Lantern arm */}
          <path d="M 70 50 L 85 45" fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
          <rect x="80" y="45" width="12" height="18" rx="2" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
          <circle cx="86" cy="54" r="4" fill="#fff" />
        </svg>
      );
    case 'wisp_token':
      return (
        <svg viewBox="0 0 100 100" className={className}>
          <circle cx="50" cy="50" r="28" fill="#67e8f9" stroke="#06b6d4" strokeWidth="4" />
          <circle cx="50" cy="50" r="36" fill="#a5f3fc" opacity="0.3" />
          <circle cx="42" cy="46" r="3" fill="#164e63" />
          <circle cx="58" cy="46" r="3" fill="#164e63" />
          <path d="M 46 54 Q 50 58, 54 54" fill="none" stroke="#164e63" strokeWidth="2.5" strokeLinecap="round" />
          {/* Glow particles */}
          <circle cx="25" cy="30" r="3" fill="#67e8f9" />
          <circle cx="75" cy="65" r="4" fill="#67e8f9" />
          <circle cx="50" cy="15" r="3" fill="#67e8f9" />
        </svg>
      );
    case 'loud_ghost':
      return (
        <svg viewBox="0 0 100 100" className={className}>
          <path d="M 25 55 C 25 25, 65 25, 65 55 L 65 85 Q 55 78, 45 85 Q 35 78, 25 85 Z" fill="#fbcfe8" stroke="#ec4899" strokeWidth="4" />
          {/* Angry eyebrows */}
          <path d="M 34 38 L 44 42" fill="none" stroke="#831843" strokeWidth="3" strokeLinecap="round" />
          <path d="M 56 38 L 46 42" fill="none" stroke="#831843" strokeWidth="3" strokeLinecap="round" />
          <circle cx="39" cy="45" r="3.5" fill="#831843" />
          <circle cx="51" cy="45" r="3.5" fill="#831843" />
          {/* Megaphone / shouting mouth */}
          <path d="M 40 52 L 60 52 L 55 64 L 45 64 Z" fill="#831843" />
          {/* Sound waves */}
          <path d="M 70 35 Q 82 45, 70 55" fill="none" stroke="#ec4899" strokeWidth="4" strokeLinecap="round" />
          <path d="M 78 28 Q 94 45, 78 62" fill="none" stroke="#ec4899" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case 'soldier_ghost':
      return (
        <svg viewBox="0 0 100 100" className={className}>
          <path d="M 28 60 C 28 30, 72 30, 72 60 L 72 85 Q 61 78, 50 85 Q 39 78, 28 85 Z" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="4" />
          {/* Helmet */}
          <path d="M 24 40 C 24 15, 76 15, 76 40 L 70 40 L 50 32 L 30 40 Z" fill="#1e40af" stroke="#1d4ed8" strokeWidth="2" />
          <circle cx="42" cy="48" r="3.5" fill="#1e3a8a" />
          <circle cx="58" cy="48" r="3.5" fill="#1e3a8a" />
          {/* Shield */}
          <path d="M 60 55 L 85 55 L 85 75 Q 72.5 88, 60 75 Z" fill="#f59e0b" stroke="#b45309" strokeWidth="3" />
          <path d="M 72.5 58 L 72.5 75 M 63 66 L 82 66" stroke="#fff" strokeWidth="3" />
        </svg>
      );
    case 'old_ghost':
      return (
        <svg viewBox="0 0 100 100" className={className}>
          <path d="M 28 55 C 28 25, 72 25, 72 55 L 72 85 Q 61 78, 50 85 Q 39 78, 28 85 Z" fill="#a7f3d0" stroke="#10b981" strokeWidth="4" />
          {/* Beard */}
          <path d="M 35 52 Q 50 75, 65 52 Q 50 62, 35 52" fill="#ecfdf5" stroke="#047857" strokeWidth="2" />
          <circle cx="41" cy="42" r="3" fill="#064e3b" />
          <circle cx="59" cy="42" r="3" fill="#064e3b" />
          {/* Wizard staff */}
          <line x1="75" y1="20" x2="75" y2="85" stroke="#92400e" strokeWidth="4" strokeLinecap="round" />
          <circle cx="75" cy="20" r="7" fill="#34d399" stroke="#059669" strokeWidth="2" />
        </svg>
      );
    case 'flame_ghost':
      return (
        <svg viewBox="0 0 100 100" className={className}>
          <path d="M 30 60 C 30 30, 70 30, 70 60 L 70 85 Q 60 78, 50 85 Q 40 78, 30 85 Z" fill="#fca5a5" stroke="#ef4444" strokeWidth="4" />
          {/* Fire crown */}
          <path d="M 35 30 Q 40 10, 50 25 Q 60 10, 65 30 Q 50 18, 35 30" fill="#f97316" stroke="#dc2626" strokeWidth="2" />
          {/* Eyes */}
          <path d="M 38 42 L 46 45" stroke="#7f1d1d" strokeWidth="3" strokeLinecap="round" />
          <path d="M 62 42 L 54 45" stroke="#7f1d1d" strokeWidth="3" strokeLinecap="round" />
          <circle cx="42" cy="48" r="3.5" fill="#7f1d1d" />
          <circle cx="58" cy="48" r="3.5" fill="#7f1d1d" />
          {/* Mischievous grin */}
          <path d="M 43 58 Q 50 65, 57 58" fill="none" stroke="#7f1d1d" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'bones_ghost':
      return (
        <svg viewBox="0 0 100 100" className={className}>
          <path d="M 30 55 C 30 25, 70 25, 70 55 L 70 85 Q 60 78, 50 85 Q 40 78, 30 85 Z" fill="#cbd5e1" stroke="#64748b" strokeWidth="4" />
          <circle cx="43" cy="42" r="4" fill="#0f172a" />
          <circle cx="57" cy="42" r="4" fill="#0f172a" />
          {/* Ribcage on chest */}
          <line x1="50" y1="52" x2="50" y2="72" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <path d="M 40 56 Q 50 60, 60 56" fill="none" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <path d="M 42 63 Q 50 67, 58 63" fill="none" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <path d="M 44 70 Q 50 73, 56 70" fill="none" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'bone_pile_token':
      return (
        <svg viewBox="0 0 100 100" className={className}>
          <ellipse cx="50" cy="75" rx="35" ry="12" fill="#475569" opacity="0.4" />
          {/* Bones crossed */}
          <path d="M 25 70 C 20 65, 30 55, 35 60 L 65 40 C 70 35, 80 45, 75 50 Z" fill="#e2e8f0" stroke="#64748b" strokeWidth="3" />
          <path d="M 75 70 C 80 65, 70 55, 65 60 L 35 40 C 30 35, 20 45, 25 50 Z" fill="#f1f5f9" stroke="#64748b" strokeWidth="3" />
          {/* Skull on top */}
          <circle cx="50" cy="52" r="16" fill="#f8fafc" stroke="#64748b" strokeWidth="3" />
          {/* Glowing purple eyes */}
          <circle cx="44" cy="50" r="3.5" fill="#a855f7" />
          <circle cx="56" cy="50" r="3.5" fill="#a855f7" />
          {/* Teeth */}
          <line x1="46" y1="64" x2="46" y2="68" stroke="#64748b" strokeWidth="2" />
          <line x1="50" y1="64" x2="50" y2="68" stroke="#64748b" strokeWidth="2" />
          <line x1="54" y1="64" x2="54" y2="68" stroke="#64748b" strokeWidth="2" />
        </svg>
      );
    case 'cat_ghost':
      return (
        <svg viewBox="0 0 100 100" className={className}>
          <path d="M 30 55 C 30 28, 70 28, 70 55 L 70 85 Q 60 78, 50 85 Q 40 78, 30 85 Z" fill="#f5d0fe" stroke="#d946ef" strokeWidth="4" />
          {/* Cat ears */}
          <path d="M 32 35 L 24 16 L 44 28 Z" fill="#f5d0fe" stroke="#d946ef" strokeWidth="3" strokeLinejoin="round" />
          <path d="M 68 35 L 76 16 L 56 28 Z" fill="#f5d0fe" stroke="#d946ef" strokeWidth="3" strokeLinejoin="round" />
          <polygon points="30,30 27,20 38,28" fill="#f43f5e" opacity="0.5" />
          <polygon points="70,30 73,20 62,28" fill="#f43f5e" opacity="0.5" />
          {/* Cat eyes */}
          <ellipse cx="42" cy="46" rx="3.5" ry="5" fill="#4a044e" />
          <ellipse cx="58" cy="46" rx="3.5" ry="5" fill="#4a044e" />
          {/* Nose & mouth */}
          <polygon points="50,52 47,49 53,49" fill="#f43f5e" />
          <path d="M 50 52 Q 46 56, 42 54 M 50 52 Q 54 56, 58 54" fill="none" stroke="#4a044e" strokeWidth="2" strokeLinecap="round" />
          {/* Whiskers */}
          <line x1="20" y1="48" x2="33" y2="50" stroke="#d946ef" strokeWidth="2" strokeLinecap="round" />
          <line x1="20" y1="55" x2="33" y2="53" stroke="#d946ef" strokeWidth="2" strokeLinecap="round" />
          <line x1="80" y1="48" x2="67" y2="50" stroke="#d946ef" strokeWidth="2" strokeLinecap="round" />
          <line x1="80" y1="55" x2="67" y2="53" stroke="#d946ef" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 100" className={className}>
          <path d="M 30 55 C 30 25, 70 25, 70 55 L 70 85 Q 60 78, 50 85 Q 40 78, 30 85 Z" fill="#e0e7ff" stroke="#6366f1" strokeWidth="4" />
          <circle cx="43" cy="45" r="4" fill="#312e81" />
          <circle cx="57" cy="45" r="4" fill="#312e81" />
        </svg>
      );
  }
}
