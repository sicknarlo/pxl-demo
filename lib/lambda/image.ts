import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from 'aws-lambda';
import S3 from 'aws-sdk/clients/s3';

import { ImageRequest } from '../image-request';
import { applyEdits } from '../apply-edits';
import { StatusCodes } from '../types';

const handler = async function (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.log('request:', JSON.stringify(event, null, 2));

    const { path } = event;

    // get key from path
    const key = path.replace(/^\//, '');

    if (!key) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        body: JSON.stringify({
          message: 'No key provided',
        }),
      };
    }

    // get image request info
    const s3 = new S3();
    const imageRequest = new ImageRequest(s3);

    const imageRequestInfo = await imageRequest.init(key, event);

    const editedImage = await applyEdits(
      imageRequestInfo.originalImage,
      imageRequestInfo.edits
    );

    const headers: Record<string, any> = {
      'Content-Type': 'image',
    };

    return {
      statusCode: StatusCodes.OK,
      body: editedImage.toString('base64'),
      headers,
      isBase64Encoded: true,
    };
  } catch (e: any) {
    console.error(e);

    if (e.message === 'No image found') {
      return {
        statusCode: StatusCodes.NOT_FOUND,
        body: JSON.stringify({
          message: 'No image found',
        }),
      };
    }

    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      body: JSON.stringify(e),
    };
  }
};

export { handler };
