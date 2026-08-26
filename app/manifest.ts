import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sistema de Ingreso ACOFI',
    short_name: 'ACOFI App',
    description: 'Evaluación de ponencias y control de ingreso para WEEF/ACOFI',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#c81474',
    icons: [
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}