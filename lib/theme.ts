import { createSystem, defaultConfig } from '@chakra-ui/react';

export const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: {
        // Custom color tokens can go here
      },
    },
  },
});
