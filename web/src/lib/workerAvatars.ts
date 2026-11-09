import aminaSrc from '../assets/avatars/amina.webp';
import salmaSrc from '../assets/avatars/salma.webp';
import youssefSrc from '../assets/avatars/youssef.webp';
import { firstName } from './format.js';

/** What a name-picker tile shows behind (and instead of) a photo. */
export type WorkerAvatar = {
  /** Cut-out portrait, or null when the worker has none (the tile then shows initials). */
  src: string | null;
  /** CSS gradient the portrait sits on, taken from the design's Memoji tiles. */
  gradient: string;
};

const NEUTRAL_GRADIENT = 'linear-gradient(160deg, #b6bbc4 0%, #7d838e 100%)';

/** Portraits are matched on the first name, so a worker added later simply gets initials. */
const AVATARS: Record<string, WorkerAvatar> = {
  amina: { src: aminaSrc, gradient: 'linear-gradient(160deg, #b9aceb 0%, #8872d3 100%)' },
  youssef: { src: youssefSrc, gradient: NEUTRAL_GRADIENT },
  salma: { src: salmaSrc, gradient: 'linear-gradient(160deg, #e4c995 0%, #c2924a 100%)' },
};

const FALLBACK: WorkerAvatar = { src: null, gradient: NEUTRAL_GRADIENT };

export function avatarFor(fullName: string): WorkerAvatar {
  return AVATARS[firstName(fullName).toLowerCase()] ?? FALLBACK;
}
