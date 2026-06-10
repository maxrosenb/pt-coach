import { ChakraProvider } from '@chakra-ui/react';
import type { AppProps } from 'next/app';
import { Fraunces, Karla } from 'next/font/google';
import { system } from '../lib/theme';

const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
});

const karla = Karla({
  subsets: ['latin'],
  variable: '--font-karla',
});

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider value={system}>
      <div
        className={`${fraunces.variable} ${karla.variable}`}
        style={{ fontFamily: 'var(--font-karla), -apple-system, sans-serif' }}
      >
        <Component {...pageProps} />
      </div>
    </ChakraProvider>
  );
}

export default MyApp;
