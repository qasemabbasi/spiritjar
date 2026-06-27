import { Keyword } from '../types';

interface KeywordChipProps {
  key?: string | number;
  keyword: Keyword;
  size?: 'sm' | 'md';
}

const KEYWORD_INFO: Record<Keyword, { label: string; color: string; desc: string }> = {
  taunt: {
    label: 'TAUNT',
    color: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
    desc: 'Enemies must attack a Taunt spirit first.'
  },
  burn: {
    label: 'BURN',
    color: 'bg-red-500/20 text-red-300 border-red-400/40',
    desc: 'Takes 1 damage at End phase, then Burn is removed.'
  },
  splash: {
    label: 'SPLASH',
    color: 'bg-pink-500/20 text-pink-300 border-pink-400/40',
    desc: 'When attacking, deals 1 damage to all other enemy spirits.'
  },
  lure: {
    label: 'LURE',
    color: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
    desc: 'Attracts Wisp tokens at End phase if none present.'
  },
  regen: {
    label: 'REGEN',
    color: 'bg-slate-500/20 text-slate-200 border-slate-400/40',
    desc: 'Defeat leaves a Bone Pile that revives at Start of turn.'
  },
  cat: {
    label: 'CAT',
    color: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/40',
    desc: 'Can only be damaged by Cat Ghosts. Cannot attack Jar.'
  },
  rush: {
    label: 'RUSH',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    desc: 'Can attack immediately on Manifest turn.'
  },
  token: {
    label: 'TOKEN',
    color: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
    desc: 'Disappears when defeated instead of entering discard pile.'
  }
};

export function KeywordChip({ keyword, size = 'sm' }: KeywordChipProps) {
  const info = KEYWORD_INFO[keyword] || { label: keyword.toUpperCase(), color: 'bg-purple-500/20 text-purple-200', desc: '' };

  return (
    <span
      title={info.desc}
      className={`inline-flex items-center font-mono font-bold tracking-wider uppercase border rounded shadow-xs select-none ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
      } ${info.color}`}
    >
      {info.label}
    </span>
  );
}
