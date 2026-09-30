import { useState } from 'react';

const defaultLogo = '/logos/default.svg';

interface CompanyLogoProps {
  name: string;
  logoUrl?: string | undefined;
}

export function CompanyLogo({ name, logoUrl }: CompanyLogoProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const configuredUrl = logoUrl ?? defaultLogo;
  const src = configuredUrl === failedUrl ? defaultLogo : configuredUrl;

  return (
    <div className="company-icon">
      <img
        src={src}
        alt={src === defaultLogo ? `${name}: logo unavailable` : `${name} logo`}
        width={48}
        height={48}
        loading="lazy"
        decoding="async"
        onError={() => {
          if (src !== defaultLogo) {
            setFailedUrl(configuredUrl);
          }
        }}
      />
    </div>
  );
}
