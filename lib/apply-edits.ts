import sharp from 'sharp';
import { Edits } from './types';

export function applyEdits(originalImage: Buffer, edits: Edits) {
  // apply edits
  const { width, height } = edits;
  let image = sharp(originalImage);
  if (width || height) {
    image = image.resize(width, height);
  }
  return image.toBuffer();
}
