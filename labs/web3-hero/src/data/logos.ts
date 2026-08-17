export interface LogoItem {
  name: string;
  src: string;
  gradient: [string, string];
}

export const logos: LogoItem[] = [
  { name: 'Procure', src: 'https://svgl.app/library/procure.svg', gradient: ['#60a5fa', '#1d4ed8'] },
  { name: 'Shopify', src: 'https://svgl.app/library/shopify.svg', gradient: ['#fef08a', '#ca8a04'] },
  { name: 'Blender', src: 'https://svgl.app/library/blender.svg', gradient: ['#7dd3fc', '#2563eb'] },
  { name: 'Figma', src: 'https://svgl.app/library/figma.svg', gradient: ['#c4b5fd', '#7c3aed'] },
  { name: 'Spotify', src: 'https://svgl.app/library/spotify.svg', gradient: ['#f9a8d4', '#ef4444'] },
  { name: 'Lottielab', src: 'https://svgl.app/library/lottielab.svg', gradient: ['#fde047', '#4ade80'] },
  { name: 'Google Cloud', src: 'https://svgl.app/library/google-cloud.svg', gradient: ['#bae6fd', '#38bdf8'] },
  { name: 'Bing', src: 'https://svgl.app/library/bing.svg', gradient: ['#67e8f9', '#0d9488'] }
];
