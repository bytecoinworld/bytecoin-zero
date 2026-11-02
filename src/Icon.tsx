import React from 'react';

export type IconName =
  | 'home'
  | 'overview'
  | 'activity'
  | 'transactions'
  | 'send'
  | 'receive'
  | 'backup'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'sparkle'
  | 'wallet'
  | 'walletPlus'
  | 'walletRestore'
  | 'shield'
  | 'network'
  | 'community'
  | 'search'
  | 'arrowRight'
  | 'chevronRight'
  | 'copy'
  | 'download'
  | 'share'
  | 'eye'
  | 'eyeOff'
  | 'paste'
  | 'plus'
  | 'check'
  | 'close'
  | 'edit'
  | 'trash'
  | 'warning'
  | 'help';

const icons: Record<IconName, React.ReactNode> = {
  home: <g><path d='m3 10 9-7 9 7'/><path d='M5 9v11h14V9'/><path d='M9 20v-6h6v6'/></g>,
  overview: <g><rect x='3' y='3' width='8' height='8' rx='2'/><rect x='13' y='3' width='8' height='5' rx='2'/><rect x='13' y='10' width='8' height='11' rx='2'/><rect x='3' y='13' width='8' height='8' rx='2'/></g>,
  activity: <polyline points='22 12 18 12 15 21 9 3 6 12 2 12'/>,
  transactions: <g><path d='M5 3h10l4 4v14H5z'/><path d='M14 3v5h5M8 12h8M8 16h8'/></g>,
  send: <g><path d='M22 2 11 13'/><path d='m22 2-7 20-4-9-9-4 20-7Z'/></g>,
  receive: <g><path d='M12 3v12'/><path d='m7 10 5 5 5-5'/><path d='M5 21h14'/></g>,
  backup: <g><path d='M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z'/><path d='m9 12 2 2 4-4'/></g>,
  settings: <g><path d='M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3'/><path d='M2 14h4M10 8h4m4 8h4'/></g>,
  sun: <g><circle cx='12' cy='12' r='4'/><path d='M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42'/></g>,
  moon: <path d='M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z'/>,
  sparkle: <g><path d='m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z'/><path d='m19 14 1 2.5 2.5 1-2.5 1L19 21l-1-2.5-2.5-1 2.5-1L19 14Z'/></g>,
  wallet: <g><rect x='3' y='5' width='18' height='15' rx='2'/><path d='M3 9h18'/><path d='M16 14h2'/></g>,
  walletPlus: <g><rect x='3' y='6' width='17' height='14' rx='2'/><path d='M3 10h17'/><path d='M16 15h1'/><path d='M19 2v6m-3-3h6'/></g>,
  walletRestore: <g><path d='M12 2v8m-3-3 3 3 3-3'/><path d='M3 13v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6'/><path d='M5 13h14m-3 4h2'/></g>,
  shield: <path d='M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z'/>,
  network: <g><circle cx='12' cy='5' r='2.5'/><circle cx='5' cy='18' r='2.5'/><circle cx='19' cy='18' r='2.5'/><path d='m10.8 7.2-4.6 8.6m7-8.6 4.6 8.6M7.5 18h9'/></g>,
  community: <g><circle cx='9' cy='8' r='3'/><path d='M3 20v-1a6 6 0 0 1 12 0v1H3Z'/><path d='M16 5.5a3 3 0 0 1 0 5.8m2 3a5 5 0 0 1 3 4.7V20h-3'/></g>,
  search: <g><circle cx='10.8' cy='10.8' r='6.8'/><path d='m16 16 5 5'/></g>,
  arrowRight: <g><path d='M5 12h14'/><path d='m13 6 6 6-6 6'/></g>,
  chevronRight: <path d='m9 18 6-6-6-6'/>,
  copy: <g><rect x='8' y='8' width='13' height='13' rx='2'/><path d='M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3'/></g>,
  download: <g><path d='M12 3v12'/><path d='m7 10 5 5 5-5'/><path d='M5 21h14'/></g>,
  share: <g><circle cx='18' cy='5' r='3'/><circle cx='6' cy='12' r='3'/><circle cx='18' cy='19' r='3'/><path d='m8.6 10.5 6.8-4m-6.8 7 6.8 4'/></g>,
  eye: <g><path d='M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z'/><circle cx='12' cy='12' r='3'/></g>,
  eyeOff: <g><path d='m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8'/><path d='M9.9 5.2A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a14.8 14.8 0 0 1-3.1 3.8M6.2 6.2C3.5 8.1 2 12 2 12s3.6 7 10 7a10.7 10.7 0 0 0 2.1-.2'/></g>,
  paste: <g><path d='M8 4H6a2 2 0 0 0-2 2v15h12v-2'/><path d='M10 2h4a2 2 0 0 1 2 2v2H8V4a2 2 0 0 1 2-2Z'/><path d='M16 12h5m-2.5-2.5L21 12l-2.5 2.5'/></g>,
  plus: <g><path d='M12 5v14M5 12h14'/></g>,
  check: <path d='m5 12 4 4L19 6'/>,
  close: <g><path d='m18 6-12 12M6 6l12 12'/></g>,
  edit: <g><path d='m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z'/></g>,
  trash: <g><path d='M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6'/></g>,
  warning: <g><path d='M12 3 2.8 19h18.4L12 3Z'/><path d='M12 9v4m0 3h.01'/></g>,
  help: <g><circle cx='12' cy='12' r='9'/><path d='M9.6 9a2.5 2.5 0 1 1 4.7 1.2c-.7 1.1-2.3 1.4-2.3 3.3'/><path d='M12 17.5h.01'/></g>,
};

const Icon = (props: {name: IconName, size?: number}) => (
  <svg
    aria-hidden='true'
    viewBox='0 0 24 24'
    width={props.size || 18}
    height={props.size || 18}
    fill='none'
    stroke='currentColor'
    strokeWidth='1.8'
    strokeLinecap='round'
    strokeLinejoin='round'
    focusable='false'
    style={{display: 'block', flexShrink: 0}}
  >
    {icons[props.name]}
  </svg>
);

export default Icon;
