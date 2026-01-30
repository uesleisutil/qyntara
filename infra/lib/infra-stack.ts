import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import * as path from "path";
import * as dotenv from "dotenv";

import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as cw from "aws-cdk-lib/aws-cloudwatch";
import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import * as cr from "aws-cdk-lib/custom-resources";

import { QuickSightStack } from "./quicksight-stack";

// Lê infra/.env (somente local). Em CI/prod você passa env vars no workflow.
dotenv.config({ path: path.join(__dirname, "..", ".env") });

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function envOr(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

function sanitizeBucketPrefix(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 20);
}

// ✅ Overwrite real (SSM PutParameter Overwrite=true) via Custom Resource
function putSsmParamOverwrite(scope: Construct, id: string, name: string, value: string) {
  return new cr.AwsCustomResource(scope, id, {
    onCreate: {
      service: "SSM",
      action: "putParameter",
      parameters: {
        Name: name,
        Value: value,
        Type: "String",
        Overwrite: true,
      },
      physicalResourceId: cr.PhysicalResourceId.of(name),
    },
    onUpdate: {
      service: "SSM",
      action: "putParameter",
      parameters: {
        Name: name,
        Value: value,
        Type: "String",
        Overwrite: true,
      },
      physicalResourceId: cr.PhysicalResourceId.of(name),
    },
    // opcional: no delete do stack, remove o parameter também
    onDelete: {
      service: "SSM",
      action: "deleteParameter",
      parameters: { Name: name },
    },
    policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
      resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
    }),
  });
}

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // -----------------------
    // Config (via env)
    // -----------------------
    const deepArImageUri = envOr("DEEPAR_IMAGE_URI", "382416733822.dkr.ecr.us-east-1.amazonaws.com/forecasting-deepar:1");
    const brapiSecretId = envOr("BRAPI_SECRET_ID", "brapi/pro/token");

    const universeS3Key = envOr("B3TR_UNIVERSE_S3_KEY", "config/universe.txt");
    const holidaysS3Key = envOr("HOLIDAYS_S3_KEY", "config/b3_holidays_2026.json");

    const scheduleMinutes = envOr("B3TR_SCHEDULE_MINUTES", "5");

    // Janela pregão em UTC (EventBridge usa UTC)
    const b3OpenHourUtc = envOr("B3_OPEN_HOUR_UTC", "13"); // 10:00 BRT
    const b3CloseHourUtc = envOr("B3_CLOSE_HOUR_UTC", "20"); // ~17:xx BRT

    // Dataset/model params
    const contextLength = envOr("B3TR_CONTEXT_LENGTH", "60");
    const predictionLength = envOr("B3TR_PREDICTION_LENGTH", "20");
    const testDays = envOr("B3TR_TEST_DAYS", "60");
    const minPoints = envOr("B3TR_MIN_POINTS", "252");
    const topN = envOr("B3TR_TOP_N", "10");

    // Monitoring
    const ingestLookbackMinutes = envOr("INGEST_LOOKBACK_MINUTES", "15");

    // Runtime config em PROD via SSM
    const ssmPrefix = envOr("B3TR_SSM_PREFIX", "/b3tr");

    // Bootstrap histórico (10y)
    const historyRange = envOr("B3TR_HISTORY_RANGE", "10y");
    const bootstrapTickersPerRun = envOr("BOOTSTRAP_TICKERS_PER_RUN", "10");
    const bootstrapSleepS = envOr("BOOTSTRAP_SLEEP_S", "0.2");

    // -----------------------
    // Bucket (nome <= 63)
    // -----------------------
    const bucketPrefixRaw = envOr("B3TR_BUCKET_PREFIX", "b3tr");
    const bucketPrefix = sanitizeBucketPrefix(bucketPrefixRaw);
    const bucketName = `${bucketPrefix}-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`.slice(0, 63);

    const bucket = new s3.Bucket(this, "B3TRBucket", {
      bucketName,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    // -----------------------
    // Upload automático de config/ -> s3://bucket/config/
    // -----------------------
    new s3deploy.BucketDeployment(this, "DeployLocalConfigFolder", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "..", "..", "config"))],
      destinationBucket: bucket,
      destinationKeyPrefix: "config",
      retainOnDelete: true, // evita dor de cabeça no delete do stack
    });

    // -----------------------
    // Secret (BRAPI)
    // -----------------------
    const brapiSecret = secrets.Secret.fromSecretNameV2(this, "BrapiSecret", brapiSecretId);

    // -----------------------
    // SNS Alerts
    // -----------------------
    const alertsTopic = new sns.Topic(this, "B3TRAlertsTopic", {
      topicName: "b3tr-alerts",
      displayName: "B3TR Alerts",
    });

    const alertEmail = process.env.ALERT_EMAIL;
    if (alertEmail) {
      alertsTopic.addSubscription(new subs.EmailSubscription(alertEmail));
    }

    // -----------------------
    // IAM: policies comuns
    // -----------------------
    const s3RwPolicy = new iam.PolicyStatement({
      actions: ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
      resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
    });

    const secretsPolicy = new iam.PolicyStatement({
      actions: ["secretsmanager:GetSecretValue"],
      resources: [`arn:aws:secretsmanager:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:secret:${brapiSecretId}-*`],
    });

    const cwPutMetricPolicy = new iam.PolicyStatement({
      actions: ["cloudwatch:PutMetricData"],
      resources: ["*"],
    });

    const ssmReadPolicy = new iam.PolicyStatement({
      actions: ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
      resources: [
        `arn:aws:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter${ssmPrefix}/*`,
      ],
    });

    // -----------------------
    // SageMaker Role (treino/transform)
    // -----------------------
    const sagemakerRole = new iam.Role(this, "B3TRSageMakerRole", {
      assumedBy: new iam.ServicePrincipal("sagemaker.amazonaws.com"),
    });

    sagemakerRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
          "s3:AbortMultipartUpload",
          "s3:ListBucketMultipartUploads",
          "s3:ListMultipartUploadParts",
        ],
        resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
      }),
    );

    sagemakerRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        resources: ["*"],
      }),
    );

    sagemakerRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ecr:GetAuthorizationToken", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"],
        resources: ["*"],
      }),
    );

    // -----------------------
    // SSM params (overwrite real)
    // -----------------------
    putSsmParamOverwrite(this, "ParamBucket", `${ssmPrefix}/bucket`, bucket.bucketName);
    putSsmParamOverwrite(this, "ParamUniverseKey", `${ssmPrefix}/universe_s3_key`, universeS3Key);
    putSsmParamOverwrite(this, "ParamHolidaysKey", `${ssmPrefix}/holidays_s3_key`, holidaysS3Key);
    putSsmParamOverwrite(this, "ParamDeepArImage", `${ssmPrefix}/deepar_image_uri`, deepArImageUri);
    putSsmParamOverwrite(this, "ParamSageMakerRoleArn", `${ssmPrefix}/sagemaker_role_arn`, sagemakerRole.roleArn);

    // -----------------------
    // Lambda Layer (AWS managed pandas layer)
    // -----------------------
    const pythonLayer = lambda.LayerVersion.fromLayerVersionArn(
      this, 
      "PythonDependenciesLayer", 
      "arn:aws:lambda:us-east-1:336392948345:layer:AWSSDKPandas-Python311:25"
    );

    // -----------------------
    // Lambda code (repo root)
    // -----------------------
    const lambdaCode = lambda.Code.fromAsset(path.join(__dirname, "..", ".."), {
      exclude: ["infra", ".git", ".venv", "node_modules", "**/__pycache__", "**/*.pyc", ".DS_Store", "lambda-layer*.zip", "lambda-layer*"],
    });

    // -----------------------
    // ENV compartilhado pras lambdas (NÃO coloque AWS_REGION aqui)
    // -----------------------
    const commonEnv: Record<string, string> = {
      BUCKET: bucket.bucketName,
      BRAPI_SECRET_ID: brapiSecretId,
      B3TR_UNIVERSE_S3_KEY: universeS3Key,
      HOLIDAYS_S3_KEY: holidaysS3Key,

      B3TR_CONTEXT_LENGTH: contextLength,
      B3TR_PREDICTION_LENGTH: predictionLength,
      B3TR_TEST_DAYS: testDays,
      B3TR_MIN_POINTS: minPoints,
      B3TR_TOP_N: topN,

      B3_OPEN_HOUR_UTC: b3OpenHourUtc,
      B3_CLOSE_HOUR_UTC: b3CloseHourUtc,
      B3TR_SCHEDULE_MINUTES: scheduleMinutes,

      DEEPAR_IMAGE_URI: deepArImageUri,
      INGEST_LOOKBACK_MINUTES: ingestLookbackMinutes,

      SAGEMAKER_ROLE_ARN: sagemakerRole.roleArn,

      // runtime discovery via SSM
      B3TR_SSM_PREFIX: ssmPrefix,
    };

    // -----------------------
    // Factory Lambda Python
    // -----------------------
    const mkPyLambda = (
      logicalId: string,
      handlerPath: string,
      extraEnv?: Record<string, string>,
    ): lambda.Function => {
      const fn = new lambda.Function(this, logicalId, {
        runtime: lambda.Runtime.PYTHON_3_11,
        code: lambdaCode,
        handler: handlerPath,
        timeout: cdk.Duration.minutes(10),
        memorySize: 1024,
        logRetention: logs.RetentionDays.ONE_WEEK,
        environment: { ...commonEnv, ...(extraEnv ?? {}) },
        layers: [pythonLayer], // Adiciona o layer com dependências
      });

      fn.addToRolePolicy(s3RwPolicy);
      fn.addToRolePolicy(cwPutMetricPolicy);
      fn.addToRolePolicy(ssmReadPolicy);
      return fn;
    };

    // -----------------------
    // Lambdas
    // -----------------------
    const ingestFn = mkPyLambda("Quotes5mIngest", "ml.src.lambdas.ingest_quotes.handler");
    ingestFn.addToRolePolicy(secretsPolicy);

    const rankStartFn = mkPyLambda("RankStart", "ml.src.lambdas.rank_start.handler");
    const rankFinalizeFn = mkPyLambda("RankFinalize", "ml.src.lambdas.rank_finalize.handler");

    const monitorIngestionFn = mkPyLambda("MonitorIngestion", "ml.src.lambdas.monitor_ingestion.handler");
    const monitorQualityFn = mkPyLambda("MonitorModelQuality", "ml.src.lambdas.monitor_model_quality.handler");
    
    // Lambda para gerar dados de exemplo para QuickSight
    const generateSampleDataFn = mkPyLambda("GenerateSampleData", "ml.src.lambdas.generate_sample_data.handler");

    // Bootstrap histórico diário (incremental + idempotente)
    const bootstrapHistoryFn = mkPyLambda(
      "BootstrapHistoryDaily",
      "ml.src.lambdas.bootstrap_history_daily.handler",
      {
        B3TR_HISTORY_RANGE: historyRange,
        BOOTSTRAP_TICKERS_PER_RUN: bootstrapTickersPerRun,
        BOOTSTRAP_SLEEP_S: bootstrapSleepS,
      },
    );
    bootstrapHistoryFn.addToRolePolicy(secretsPolicy);

    // Preparação automática de dados de treino
    const prepareTrainingFn = mkPyLambda(
      "PrepareTrainingData", 
      "ml.src.lambdas.prepare_training_data.handler"
    );

    // Treinamento automático de modelo
    const trainModelFn = mkPyLambda(
      "TrainModel",
      "ml.src.lambdas.train_model.handler"
    );
    bootstrapHistoryFn.addToRolePolicy(secretsPolicy);

    // SageMaker APIs
    const sagemakerApiPolicy = new iam.PolicyStatement({
      actions: [
        "sagemaker:CreateModel",
        "sagemaker:DeleteModel",
        "sagemaker:CreateTransformJob",
        "sagemaker:DescribeTransformJob",
        "sagemaker:StopTransformJob",
        "sagemaker:CreateTrainingJob",
        "sagemaker:DescribeTrainingJob",
        "sagemaker:ListTrainingJobs",
        "sagemaker:AddTags",
      ],
      resources: ["*"],
    });
    
    // PassRole para SageMaker
    const passRolePolicy = new iam.PolicyStatement({
      actions: ["iam:PassRole"],
      resources: [sagemakerRole.roleArn],
    });
    
    rankStartFn.addToRolePolicy(sagemakerApiPolicy);
    rankStartFn.addToRolePolicy(passRolePolicy);
    trainModelFn.addToRolePolicy(sagemakerApiPolicy);
    trainModelFn.addToRolePolicy(passRolePolicy);

    // -----------------------
    // EventBridge schedules (UTC)
    // -----------------------
    const ingestRule = new events.Rule(this, "IngestDuringB3", {
      schedule: events.Schedule.expression(
        `cron(0/${scheduleMinutes} ${b3OpenHourUtc}-${b3CloseHourUtc} ? * MON-FRI *)`,
      ),
    });
    ingestRule.addTarget(new targets.LambdaFunction(ingestFn));

    const monitorIngestRule = new events.Rule(this, "MonitorIngestionDuringB3", {
      schedule: events.Schedule.expression(
        `cron(0/5 ${b3OpenHourUtc}-${b3CloseHourUtc} ? * MON-FRI *)`,
      ),
    });
    monitorIngestRule.addTarget(new targets.LambdaFunction(monitorIngestionFn));

    const rankStartRule = new events.Rule(this, "RankDailyStart", {
      schedule: events.Schedule.expression("cron(10 21 ? * MON-FRI *)"),
    });
    rankStartRule.addTarget(new targets.LambdaFunction(rankStartFn));

    const rankFinalizeRule = new events.Rule(this, "RankDailyFinalize", {
      schedule: events.Schedule.expression("cron(40 21 ? * MON-FRI *)"),
    });
    rankFinalizeRule.addTarget(new targets.LambdaFunction(rankFinalizeFn));

    const monitorQualityRule = new events.Rule(this, "MonitorQualityDaily", {
      schedule: events.Schedule.expression("cron(0 22 ? * MON-FRI *)"),
    });
    monitorQualityRule.addTarget(new targets.LambdaFunction(monitorQualityFn));

    // Bootstrap histórico: roda 30/30 min até terminar (depois a lambda deve “skipp ar”)
    const bootstrapRule = new events.Rule(this, "BootstrapHistorySchedule", {
      schedule: events.Schedule.expression("cron(0/30 * ? * * *)"),
    });
    bootstrapRule.addTarget(new targets.LambdaFunction(bootstrapHistoryFn));

    // Preparação de dados: roda 1x por dia após bootstrap ou quando necessário
    const prepareDataRule = new events.Rule(this, "PrepareTrainingDataDaily", {
      schedule: events.Schedule.expression("cron(0 20 ? * MON-FRI *)"), // 17:00 BRT
    });
    prepareDataRule.addTarget(new targets.LambdaFunction(prepareTrainingFn));

    // Treinamento de modelo: roda 1x por dia após preparação de dados
    const trainModelRule = new events.Rule(this, "TrainModelDaily", {
      schedule: events.Schedule.expression("cron(30 20 ? * MON-FRI *)"), // 17:30 BRT
    });
    trainModelRule.addTarget(new targets.LambdaFunction(trainModelFn));

    // -----------------------
    // Alarm -> SNS
    // -----------------------
    const ingestionOkMetric = new cw.Metric({
      namespace: "B3TR",
      metricName: "IngestionOK",
      statistic: "Minimum",
      period: cdk.Duration.minutes(5),
    });

    const ingestionAlarm = new cw.Alarm(this, "IngestionFailedAlarm", {
      metric: ingestionOkMetric,
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cw.TreatMissingData.BREACHING,
      alarmDescription: "B3TR: ingestão falhando (IngestionOK < 1).",
    });

    ingestionAlarm.addAlarmAction(new cw_actions.SnsAction(alertsTopic));

    // -----------------------
    // QuickSight Dashboard
    // -----------------------
    // Reutilizar a variável alertEmail já declarada acima
    const finalAlertEmail = alertEmail || "admin@example.com";
    
    // Upload QuickSight manifest
    const manifestContent = JSON.stringify({
      "fileLocations": [
        {
          "URIPrefixes": [
            `s3://${bucket.bucketName}/recommendations/`,
            `s3://${bucket.bucketName}/monitoring/model_quality/`,
            `s3://${bucket.bucketName}/monitoring/ingestion/`,
            `s3://${bucket.bucketName}/curated/daily/`
          ]
        }
      ],
      "globalUploadSettings": {
        "format": "JSON",
        "delimiter": ",",
        "textqualifier": "\"",
        "containsHeader": "true"
      }
    }, null, 2);

    new s3deploy.BucketDeployment(this, "DeployQuickSightManifest", {
      sources: [s3deploy.Source.data("manifest.json", manifestContent)],
      destinationBucket: bucket,
      destinationKeyPrefix: "quicksight",
      retainOnDelete: true,
    });

    const quickSightStack = new QuickSightStack(this, "QuickSight", {
      bucket: bucket,
      alertEmail: finalAlertEmail,
    });

    // -----------------------
    // Outputs
    // -----------------------
    new cdk.CfnOutput(this, "BucketName", { value: bucket.bucketName });
    new cdk.CfnOutput(this, "AlertsTopicArn", { value: alertsTopic.topicArn });
    new cdk.CfnOutput(this, "SageMakerRoleArn", { value: sagemakerRole.roleArn });
    new cdk.CfnOutput(this, "SsmPrefix", { value: ssmPrefix });
    new cdk.CfnOutput(this, "QuickSightDashboardUrl", { 
      value: quickSightStack.dashboardUrl,
      description: "URL to access the B3TR MLOps Dashboard in QuickSight"
    });
  }
}