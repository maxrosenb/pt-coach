import { Html, Head, Main, NextScript } from 'next/document';

// Apply the saved (or system) color mode before first paint so dark-mode
// users don't get a cream flash on every load. Must match the keys/attributes
// ColorModeToggle writes.
const setInitialColorMode = `(function () {
  try {
    var mode = localStorage.getItem('chakra-ui-color-mode');
    if (mode !== 'light' && mode !== 'dark') {
      mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.classList.toggle('dark', mode === 'dark');
  } catch (e) {}
})();`;

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <script dangerouslySetInnerHTML={{ __html: setInitialColorMode }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
