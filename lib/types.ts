export type EditParams = {
  w?: string;
  h?: string;
  w64?: string;
  h64?: string;
};

export type Edits = {
  width?: number;
  height?: number;
};

export type ImageRequestInfo = {
  originalImage: Buffer;
  edits: Edits;
};

export enum ContentTypes {
  PNG = 'image/png',
  JPEG = 'image/jpeg',
  WEBP = 'image/webp',
  TIFF = 'image/tiff',
  GIF = 'image/gif',
  SVG = 'image/svg+xml',
}

export enum StatusCodes {
  OK = 200,
  BAD_REQUEST = 400,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  REQUEST_TOO_LONG = 413,
  INTERNAL_SERVER_ERROR = 500,
}
