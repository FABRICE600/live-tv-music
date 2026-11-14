import { useState } from 'react';
import { Disc3 } from 'lucide-react';

interface CoverArtworkProps {
  src?: string;
  alt: string;
  className?: string;
  roundedClassName?: string;
  sizeIcon?: number;
}

export function CoverArtwork({
  src,
  alt,
  className = 'w-full h-full object-cover',
  roundedClassName = 'rounded-lg',
  sizeIcon = 22,
}: CoverArtworkProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--sm-muted)] text-[var(--sm-text-muted)] ${roundedClassName} ${className}`}
        aria-label={alt}
      >
        <Disc3 size={sizeIcon} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${roundedClassName} ${className}`}
      loading="lazy"
    />
  );
}
