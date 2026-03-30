import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import * as path from 'path';

export class PrediktStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domainName = 'qyntara.tech';
    const apiSubdomain = `api.${domainName}`;
    const hostedZoneId = 'Z0895962DIMZ2UX4JP0M';
    const certificateArn = 'arn:aws:acm:us-east-1:200093399689:certificate/a01724c8-e707-4141-8d18-cb7141fc7fd7';

    // Import hosted zone and certificate
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId,
      zoneName: domainName,
    });
    const certificate = acm.Certificate.fromCertificateArn(this, 'Cert', certificateArn);

    // ══════════════════════════════════════
    // LAMBDA (Backend API)
    // ══════════════════════════════════════

    // Dead Letter Queue for failed invocations
    const dlq = new sqs.Queue(this, 'PrediktDLQ', {
      queueName: 'predikt-api-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    const apiFunction = new lambda.DockerImageFunction(this, 'PrediktApi', {
      functionName: 'predikt-api',
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '..'), {
        file: 'Dockerfile.lambda',
        exclude: ['infra', 'node_modules', '.git', '.venv', 'data', 'frontend/node_modules'],
        platform: ecr_assets.Platform.LINUX_AMD64,
      }),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        APP_ENV: 'production',
        FRONTEND_URL: `https://${domainName}`,
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
      deadLetterQueue: dlq,
      retryAttempts: 2,
    });

    // DynamoDB permissions
    apiFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: [
        'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem',
        'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan',
        'dynamodb:CreateTable', 'dynamodb:DescribeTable', 'dynamodb:ListTables',
      ],
      resources: ['arn:aws:dynamodb:us-east-1:200093399689:table/predikt-*'],
    }));

    // S3 permissions (data storage)
    apiFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:HeadBucket', 's3:CreateBucket'],
      resources: [
        'arn:aws:s3:::predikt-data-200093399689',
        'arn:aws:s3:::predikt-data-200093399689/*',
      ],
    }));

    // API Gateway HTTP (mais barato que REST)
    const httpApi = new apigatewayv2.HttpApi(this, 'PrediktHttpApi', {
      apiName: 'predikt-api',
      corsPreflight: {
        allowOrigins: [`https://${domainName}`, 'http://localhost:5173'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Authorization', 'Content-Type'],
        maxAge: cdk.Duration.seconds(600),
      },
    });

    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration('LambdaIntegration', apiFunction),
    });

    // ══════════════════════════════════════
    // S3 + CLOUDFRONT (Frontend)
    // ══════════════════════════════════════
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `predikt-frontend-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'FrontendCDN', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      domainNames: [domainName],
      certificate,
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
      ],
    });

    // DNS record: qyntara.tech → CloudFront
    new route53.ARecord(this, 'FrontendAlias', {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(new route53targets.CloudFrontTarget(distribution)),
    });

    // Deploy frontend
    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '..', 'frontend', 'dist'))],
      destinationBucket: frontendBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // ══════════════════════════════════════
    // MONITORING — CloudWatch Alarms + SNS
    // ══════════════════════════════════════

    const alertTopic = new sns.Topic(this, 'PrediktAlerts', {
      topicName: 'predikt-alerts',
      displayName: 'Qyntara Alerts',
    });

    alertTopic.addSubscription(
      new sns_subs.EmailSubscription('uesleisutil@gmail.com')
    );

    // Lambda error rate alarm
    new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      alarmName: 'predikt-lambda-errors',
      alarmDescription: 'Lambda error rate > 5 in 5 minutes',
      metric: apiFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cw_actions.SnsAction(alertTopic));

    // Lambda throttles alarm
    new cloudwatch.Alarm(this, 'LambdaThrottleAlarm', {
      alarmName: 'predikt-lambda-throttles',
      alarmDescription: 'Lambda throttled > 3 in 5 minutes',
      metric: apiFunction.metricThrottles({ period: cdk.Duration.minutes(5) }),
      threshold: 3,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cw_actions.SnsAction(alertTopic));

    // Lambda duration alarm (p95 > 20s = close to timeout)
    new cloudwatch.Alarm(this, 'LambdaDurationAlarm', {
      alarmName: 'predikt-lambda-slow',
      alarmDescription: 'Lambda p95 duration > 20s',
      metric: apiFunction.metricDuration({ period: cdk.Duration.minutes(5), statistic: 'p95' }),
      threshold: 20000,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cw_actions.SnsAction(alertTopic));

    // DLQ messages alarm (any message = something failed)
    new cloudwatch.Alarm(this, 'DLQAlarm', {
      alarmName: 'predikt-dlq-messages',
      alarmDescription: 'Messages in DLQ (failed Lambda invocations)',
      metric: dlq.metricApproximateNumberOfMessagesVisible({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cw_actions.SnsAction(alertTopic));

    // ══════════════════════════════════════
    // OUTPUTS
    // ══════════════════════════════════════
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
      description: 'Backend API URL (API Gateway)',
    });

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Frontend URL (CloudFront)',
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
    });
  }
}
