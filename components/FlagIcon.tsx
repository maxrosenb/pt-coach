import { Box, Image } from '@chakra-ui/react';

interface FlagIconProps {
  country: 'BR' | 'PT';
  size?: string | number;
}

export function FlagIcon({ country, size = '1.5em' }: FlagIconProps) {
  const flagSrc = country === 'BR' ? '/flags/brazil.svg' : '/flags/portugal.svg';
  const alt = country === 'BR' ? 'Brazilian flag' : 'Portuguese flag';

  return (
    <Image
      src={flagSrc}
      alt={alt}
      width={size}
      height={size}
      display="inline-block"
      verticalAlign="middle"
      borderRadius="sm"
    />
  );
}
