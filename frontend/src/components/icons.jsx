function Icon({ size = 18, strokeWidth = 1.9, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconDrop = (p) => (
  <Icon {...p}>
    <path d="M12 2.5c3.5 4 7 7.8 7 12.1a7 7 0 1 1-14 0c0-4.3 3.5-8.1 7-12.1Z" />
    <path d="M8.5 15a3.5 3.5 0 0 0 3.5 3.5" />
  </Icon>
);

export const IconMap = (p) => (
  <Icon {...p}>
    <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5Z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </Icon>
);

export const IconList = (p) => (
  <Icon {...p}>
    <path d="M4 6.5h16M4 12h16M4 17.5h10" />
  </Icon>
);

export const IconUsers = (p) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" />
    <path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.6" />
    <path d="M18 19.5c0-1.9-.6-3.6-1.7-5" />
  </Icon>
);

export const IconUserPlus = (p) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" />
    <path d="M19 8v6M16 11h6" />
  </Icon>
);

export const IconLogout = (p) => (
  <Icon {...p}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M10 16l-4-4 4-4M6 12h10" />
  </Icon>
);

export const IconPlus = (p) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const IconImage = (p) => (
  <Icon strokeWidth={1.6} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M3 15.5 8.5 11l4 3.5L16 11l5 4" />
    <circle cx="8.5" cy="9" r="1.4" />
  </Icon>
);

export const IconPin = (p) => (
  <Icon {...p}>
    <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.4" />
  </Icon>
);

export const IconLink = (p) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </Icon>
);

export const IconClose = (p) => (
  <Icon strokeWidth={2.4} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const IconChevronRight = (p) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);

export const IconChevronLeft = (p) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Icon>
);

export const IconUpload = (p) => (
  <Icon {...p}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </Icon>
);

export const IconCheck = (p) => (
  <Icon strokeWidth={3} {...p}>
    <path d="M4 12.5 9.5 18 20 6.5" />
  </Icon>
);
