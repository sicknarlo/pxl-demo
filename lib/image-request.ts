import { APIGatewayProxyEvent } from 'aws-lambda';
import S3 from 'aws-sdk/clients/s3';
import { EditParams, ImageRequestInfo } from './types';

export class ImageRequest {
  client: S3;
  constructor(private readonly s3Client: S3) {
    this.client = s3Client;
  }

  async init(
    key: string,
    event: APIGatewayProxyEvent
  ): Promise<ImageRequestInfo> {
    // get original image
    const params = {
      Bucket: 'ns-grailed-test',
      Key: key,
    };

    const data = await this.client.getObject(params).promise();

    if (!data.Body) {
      throw new Error('No image found');
    }

    const originalImageBuffer = Buffer.from(data.Body as Uint8Array);

    // get edits
    const { w, h, w64, h64 } =
      event.queryStringParameters || ({} as EditParams);

    let width: number | undefined;
    let height: number | undefined;

    if (w64) {
      width = Number(Buffer.from(w64, 'base64').toString('ascii'));
    }

    if (h64) {
      height = Number(Buffer.from(h64, 'base64').toString('ascii'));
    }

    if (w && !width) {
      width = Number(w);
    }

    if (h && !height) {
      height = Number(h);
    }

    return {
      originalImage: originalImageBuffer,
      edits: {
        width,
        height,
      },
    };
  }
}
