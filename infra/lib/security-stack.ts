/**
 * Security Stack for B3 Dashboard
 * 
 * Implements:
 * - Requirement 82: Security and Authentication
 * - DynamoDB tables for API keys, auth logs, rate limits
 * - KMS key for encryption
 * - Security audit Lambda
 */

import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as kms from "aws-cdk-lib/aws-kms";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export interface SecurityStackProps extends cdk.StackProps {
  bucket: string;
  userPoolId: string;
  lambdaCode: lambda.Code;
}

export class SecurityStack extends cdk.Stack {
  public readonly apiKeysTable: dynamodb.Table;
  public readonly authLogsTable: dynamodb.Table;
  public readonly rateLimitsTable: dynamodb.Table;
  public readonly kmsKey: kms.Key;
  public readonly securityAuditFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);

    // KMS Key for encryption
    this.kmsKey = new kms.Key(this, "DashboardKMSKey", {
      description: "KMS key for B3 Dashboard data encryption",
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      alias: "b3-dashboard-encryption-key",
    });

    // API Keys Table
    this.apiKeysTable = new dynamodb.Table(this, "APIKeysTable", {
      tableName: "B3Dashboard-APIKeys",
      partitionKey: {
        name: "apiKeyHash",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for querying by userId
    this.apiKeysTable.addGlobalSecondaryIndex({
      indexName: "UserIdIndex",
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Auth Logs Table
    this.authLogsTable = new dynamodb.Table(this, "AuthLogsTable", {
      tableName: "B3Dashboard-AuthLogs",
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "timestamp",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Rate Limits Table
    this.rateLimitsTable = new dynamodb.Table(this, "RateLimitsTable", {
      tableName: "B3Dashboard-RateLimits",
      partitionKey: {
        name: "identifier",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Can be recreated
    });

    // Security Audit Lambda Function
    this.securityAuditFunction = new lambda.Function(this, "SecurityAuditFunction", {
      functionName: "B3Dashboard-SecurityAudit",
      runtime: lambda.Runtime.PYTHON_3_11,
      code: props.lambdaCode,
      handler: "ml.src.lambdas.security_audit.handler",
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
      environment: {
        BUCKET: props.bucket,
        USER_POOL_ID: props.userPoolId,
        API_KEYS_TABLE: this.apiKeysTable.tableName,
        AUTH_LOGS_TABLE: this.authLogsTable.tableName,
        KMS_KEY_ID: this.kmsKey.keyId,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant permissions to Security Audit Lambda
    this.apiKeysTable.grantReadData(this.securityAuditFunction);
    this.authLogsTable.grantReadData(this.securityAuditFunction);
    this.kmsKey.grantEncryptDecrypt(this.securityAuditFunction);

    // Grant S3 permissions
    this.securityAuditFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:GetBucketEncryption",
          "s3:GetBucketAcl",
        ],
        resources: [
          `arn:aws:s3:::${props.bucket}`,
          `arn:aws:s3:::${props.bucket}/*`,
        ],
      })
    );

    // Grant Cognito permissions
    this.securityAuditFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:DescribeUserPool",
          "cognito-idp:ListUsers",
        ],
        resources: [
          `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${props.userPoolId}`,
        ],
      })
    );

    // Grant IAM read permissions for audit
    this.securityAuditFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "iam:ListRoles",
          "iam:ListAttachedRolePolicies",
          "iam:GetRole",
          "iam:GetRolePolicy",
        ],
        resources: ["*"],
      })
    );

    // Grant CloudWatch permissions
    this.securityAuditFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cloudwatch:PutMetricData",
          "cloudwatch:GetMetricStatistics",
        ],
        resources: ["*"],
      })
    );

    // Schedule quarterly security audits
    const auditRule = new events.Rule(this, "QuarterlySecurityAudit", {
      ruleName: "B3Dashboard-QuarterlySecurityAudit",
      description: "Run security audit every quarter",
      schedule: events.Schedule.cron({
        minute: "0",
        hour: "0",
        day: "1",
        month: "*/3", // Every 3 months
      }),
    });

    auditRule.addTarget(
      new targets.LambdaFunction(this.securityAuditFunction, {
        event: events.RuleTargetInput.fromObject({
          bucket: props.bucket,
          userPoolId: props.userPoolId,
        }),
      })
    );

    // CloudWatch Alarms for security monitoring
    
    // Alarm for failed authentication attempts
    const failedAuthMetric = new cdk.aws_cloudwatch.Metric({
      namespace: "B3Dashboard/Authentication",
      metricName: "AuthenticationAttempts",
      dimensionsMap: {
        Success: "false",
      },
      statistic: "Sum",
      period: cdk.Duration.minutes(5),
    });

    new cdk.aws_cloudwatch.Alarm(this, "FailedAuthAlarm", {
      alarmName: "B3Dashboard-FailedAuthenticationAttempts",
      alarmDescription: "Alert when failed authentication attempts exceed threshold",
      metric: failedAuthMetric,
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Outputs
    new cdk.CfnOutput(this, "APIKeysTableName", {
      value: this.apiKeysTable.tableName,
      description: "DynamoDB table for API keys",
    });

    new cdk.CfnOutput(this, "AuthLogsTableName", {
      value: this.authLogsTable.tableName,
      description: "DynamoDB table for authentication logs",
    });

    new cdk.CfnOutput(this, "RateLimitsTableName", {
      value: this.rateLimitsTable.tableName,
      description: "DynamoDB table for rate limits",
    });

    new cdk.CfnOutput(this, "KMSKeyId", {
      value: this.kmsKey.keyId,
      description: "KMS key ID for encryption",
    });

    new cdk.CfnOutput(this, "KMSKeyArn", {
      value: this.kmsKey.keyArn,
      description: "KMS key ARN for encryption",
    });

    new cdk.CfnOutput(this, "SecurityAuditFunctionName", {
      value: this.securityAuditFunction.functionName,
      description: "Security audit Lambda function name",
    });
  }
}
