import { StatusCodes } from './types';

export class ImageHandlerError extends Error {
  constructor(
    public readonly status: StatusCodes,
    public readonly code: string,
    public readonly message: string
  ) {
    super();
  }
}
