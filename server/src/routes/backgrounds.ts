import { Router, Request, Response } from 'express';
import {
  ALL_BACKGROUNDS,
  CURATED_GRADIENTS,
  CURATED_UNSPLASH_IMAGES,
  CardBackground,
} from '../../../shared';

export const backgroundsRouter = Router();

/**
 * GET /api/v1/backgrounds
 * Returns all curated high-energy gradients & Unsplash streetwear backgrounds
 */
backgroundsRouter.get('/', (_req: Request, res: Response) => {
  return res.json({
    gradients: CURATED_GRADIENTS,
    images: CURATED_UNSPLASH_IMAGES,
    all: ALL_BACKGROUNDS,
  });
});

/**
 * GET /api/v1/backgrounds/shuffle
 * Powers the 🎲 Card Shuffler micro-interaction.
 * Cycles through energetic gradients and Unsplash photos (live Unsplash API if UNSPLASH_ACCESS_KEY is configured, otherwise curated pack).
 */
backgroundsRouter.get('/shuffle', async (req: Request, res: Response) => {
  const currentId = (req.query.excludeId as string) || '';
  const preferType = req.query.type as 'gradient' | 'image' | undefined;
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;

  // If user specifically requests a live Unsplash image and an API key is configured
  if (unsplashKey && (preferType === 'image' || Math.random() > 0.65)) {
    try {
      const response = await fetch(
        'https://api.unsplash.com/photos/random?query=neon+streetwear+cyberpunk+abstract&orientation=portrait',
        {
          headers: {
            Authorization: `Client-ID ${unsplashKey}`,
          },
        }
      );
      if (response.ok) {
        const data: any = await response.json();
        const liveBg: CardBackground = {
          id: `unsplash-${data.id}`,
          type: 'image',
          name: data.description || data.alt_description || 'Unsplash Street Vibe',
          value: data.urls?.regular || CURATED_UNSPLASH_IMAGES[0].value,
          colors: [data.color || '#120458', '#FF1E8E'],
          textColor: '#FFFFFF',
          badgeBg: '#CCFF00',
          badgeText: '#0D0D11',
          attribution: `Photo by ${data.user?.name || 'Unsplash'}`,
        };
        return res.json({ background: liveBg, source: 'unsplash-live' });
      }
    } catch (err) {
      // Fallback silently to curated pool
    }
  }

  let pool = ALL_BACKGROUNDS;
  if (preferType === 'gradient') pool = CURATED_GRADIENTS;
  if (preferType === 'image') pool = CURATED_UNSPLASH_IMAGES;

  const candidates = pool.filter((item) => item.id !== currentId);
  const chosen =
    candidates[Math.floor(Math.random() * candidates.length)] || pool[0];

  return res.json({
    background: chosen,
    source: 'curated-pack',
  });
});
