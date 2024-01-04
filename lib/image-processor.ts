import sharp from 'sharp';

import { ImageRequestInfo } from './types';

export class ImageProcessor {
  applyEdits(imageRequestInfo: ImageRequestInfo) {
    // apply edits
    const { edits, originalImage } = imageRequestInfo;
    const { width, height } = edits;
    let image = sharp(originalImage);
    if (width || height) {
      image = image.resize(width, height);
    }
    return image.toBuffer();
  }
}
