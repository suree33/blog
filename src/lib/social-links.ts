export interface SocialLink {
  href: string;
  ariaLabel: string;
  icon: string;
}

export const socialLinks: readonly SocialLink[] = [
  {
    href: 'https://twitter.com/thisissuree',
    ariaLabel: 'Twitter profile page (@thisissuree)',
    icon: 'fa6-brands:x-twitter',
  },
  {
    href: 'https://www.instagram.com/thisissuree/',
    ariaLabel: 'Instagram profile page (@thisissuree)',
    icon: 'fa6-brands:instagram',
  },
  {
    href: 'https://github.com/Suree33',
    ariaLabel: 'GitHub profile page (@Suree33)',
    icon: 'fa6-brands:github',
  },
];
