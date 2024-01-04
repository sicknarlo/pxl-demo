import * as path from 'path';
import { Construct } from 'constructs';
import {
  ArnFormat,
  Aws,
  Duration,
  Lazy,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import {
  AuthorizationType,
  LambdaRestApiProps,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
  AllowedMethods,
  CacheHeaderBehavior,
  CachePolicy,
  CacheQueryStringBehavior,
  DistributionProps,
  IOrigin,
  OriginRequestPolicy,
  OriginSslPolicy,
  PriceClass,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { CloudFrontToApiGatewayToLambda } from '@aws-solutions-constructs/aws-cloudfront-apigateway-lambda';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  Policy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';

const PARAMS = ['w', 'h'];

const PARAMS64 = PARAMS.map((param) => `${param}64`);

const PARAMS_ALL = PARAMS.concat(PARAMS64);

export class PxlStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const imageHandlerLambdaFunctionRole = new Role(
      this,
      'ImageHandlerFunctionRole',
      {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        path: '/',
      }
    );

    const imageHandlerLambdaFunctionRolePolicy = new Policy(
      this,
      'ImageHandlerFunctionPolicy',
      {
        statements: [
          new PolicyStatement({
            actions: [
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:PutLogEvents',
            ],
            resources: [
              Stack.of(this).formatArn({
                service: 'logs',
                resource: 'log-group',
                resourceName: '/aws/lambda/*',
                arnFormat: ArnFormat.COLON_RESOURCE_NAME,
              }),
            ],
          }),
          new PolicyStatement({
            actions: [
              's3:GetObject',
              's3:PutObject',
              's3:ListBucket',
            ],
            resources: [
              Stack.of(this).formatArn({
                service: 's3',
                resource: '*',
                region: '',
                account: '',
              }),
            ],
          }),
        ],
      }
    );

    imageHandlerLambdaFunctionRole.attachInlinePolicy(
      imageHandlerLambdaFunctionRolePolicy
    );

    const imageHandlerLambdaFunction = new NodejsFunction(
      this,
      'ImageHandlerLambdaFunction',
      {
        description: `PXL: Performs image edits and manipulations`,
        memorySize: 1024,
        runtime: Runtime.NODEJS_20_X,
        timeout: Duration.seconds(29),
        role: imageHandlerLambdaFunctionRole,
        entry: path.join(__dirname, './lambda/image.ts'),
        bundling: {
          externalModules: ['sharp'],
          nodeModules: ['sharp'],
          commandHooks: {
            beforeBundling(
              inputDir: string,
              outputDir: string
            ): string[] {
              return [];
            },
            beforeInstall(
              inputDir: string,
              outputDir: string
            ): string[] {
              return [];
            },
            afterBundling(
              inputDir: string,
              outputDir: string
            ): string[] {
              return [
                `cd ${outputDir}`,
                'rm -rf node_modules/sharp && npm install --arch=x64 --platform=linux sharp',
              ];
            },
          },
        },
      }
    );

    const cachePolicy = new CachePolicy(this, 'CachePolicy', {
      cachePolicyName: `PxlStackCachePolicy`,
      defaultTtl: Duration.days(1),
      minTtl: Duration.seconds(1),
      maxTtl: Duration.days(365),
      enableAcceptEncodingGzip: false,
      headerBehavior: CacheHeaderBehavior.allowList(
        'origin',
        'accept'
      ),
      queryStringBehavior: CacheQueryStringBehavior.allowList(
        ...PARAMS_ALL
      ),
    });

    const originRequestPolicy = new OriginRequestPolicy(
      this,
      'OriginRequestPolicy',
      {
        originRequestPolicyName: `PxlStackOriginRequestPolicy`,
        headerBehavior: CacheHeaderBehavior.allowList(
          'origin',
          'accept'
        ),
        queryStringBehavior: CacheQueryStringBehavior.allowList(
          ...PARAMS_ALL
        ),
      }
    );

    const apiGatewayRestApi = RestApi.fromRestApiId(
      this,
      'ApiGatewayRestApi',
      Lazy.string({
        produce: () =>
          imageHandlerCloudFrontApiGatewayLambda.apiGateway.restApiId,
      })
    );

    const origin: IOrigin = new HttpOrigin(
      `${apiGatewayRestApi.restApiId}.execute-api.${Aws.REGION}.amazonaws.com`,
      {
        originPath: '/',
        originSslProtocols: [
          OriginSslPolicy.TLS_V1_1,
          OriginSslPolicy.TLS_V1_2,
        ],
      }
    );

    const cloudFrontDistributionProps: DistributionProps = {
      comment:
        'Image Handler Distribution for Serverless Image Handler',
      defaultBehavior: {
        origin,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
        originRequestPolicy,
        cachePolicy,
      },
      priceClass: PriceClass.PRICE_CLASS_ALL,
      enableLogging: true,
      logFilePrefix: 'api-cloudfront/',
      errorResponses: [
        { httpStatus: 500, ttl: Duration.minutes(10) },
        { httpStatus: 501, ttl: Duration.minutes(10) },
        { httpStatus: 502, ttl: Duration.minutes(10) },
        { httpStatus: 503, ttl: Duration.minutes(10) },
        { httpStatus: 504, ttl: Duration.minutes(10) },
      ],
    };

    const logGroupProps = {
      retention: RetentionDays.ONE_WEEK,
    };

    const apiGatewayProps: LambdaRestApiProps = {
      handler: imageHandlerLambdaFunction,
      binaryMediaTypes: ['*/*'],
      defaultMethodOptions: {
        authorizationType: AuthorizationType.NONE,
      },
    };

    const imageHandlerCloudFrontApiGatewayLambda =
      new CloudFrontToApiGatewayToLambda(
        this,
        'ImageHandlerCloudFrontApiGatewayLambda',
        {
          existingLambdaObj: imageHandlerLambdaFunction,
          insertHttpSecurityHeaders: false,
          logGroupProps,
          cloudFrontDistributionProps,
          apiGatewayProps,
        }
      );
  }
}
