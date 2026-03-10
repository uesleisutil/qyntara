import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import * as path from "path";
import * as dotenv from "dotenv";

import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
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
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as apigateway from "aws-cdk-lib/aws-apigateway";



// Lê infra/.env (somente local). Em CI/prod você passa env vars no workflow.
dotenv.config({ path: path.join(__dirname, "..", ".env") });

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
    const ensembleImageUri = envOr("ENSEMBLE_IMAGE_URI", "");  // Vazio = usar XGBoost da AWS
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
    const topN = envOr("B3TR_TOP_N", "50");

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
    // Secret (BRAPI) - referenced by Lambda functions via environment
    // -----------------------
    const brapiSecret = secrets.Secret.fromSecretNameV2(this, "BrapiSecret", brapiSecretId);
    // Note: brapiSecret is used implicitly by Lambda functions that access the secret via brapiSecretId

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

    // ML Dependencies Layer (XGBoost, Pandas, NumPy, SciPy)
    const mlLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "MLDependenciesLayer",
      "arn:aws:lambda:us-east-1:200093399689:layer:b3tr-ml-deps:2"
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
      ENSEMBLE_IMAGE_URI: ensembleImageUri,
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

    // Factory para Lambdas com ML dependencies
    const mkMLLambda = (
      logicalId: string,
      handlerPath: string,
      extraEnv?: Record<string, string>,
    ): lambda.Function => {
      const fn = new lambda.Function(this, logicalId, {
        runtime: lambda.Runtime.PYTHON_3_11,
        code: lambdaCode,
        handler: handlerPath,
        timeout: cdk.Duration.minutes(15), // Mais tempo para ML
        memorySize: 2048, // Mais memória para ML
        logRetention: logs.RetentionDays.ONE_WEEK,
        environment: { ...commonEnv, ...(extraEnv ?? {}) },
        layers: [pythonLayer], // Usar pythonLayer que tem numpy, pandas, etc
      });

      fn.addToRolePolicy(s3RwPolicy);
      fn.addToRolePolicy(cwPutMetricPolicy);
      fn.addToRolePolicy(ssmReadPolicy);
      return fn;
    };

    // -----------------------
    // Lambdas
    // -----------------------
    // Lambdas
    // -----------------------
    const ingestFn = mkPyLambda("Quotes5mIngest", "ml.src.lambdas.ingest_quotes.handler");
    ingestFn.addToRolePolicy(secretsPolicy);

    // SageMaker APIs (declarar antes de usar)
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

    // SageMaker: Treinar modelos
    const trainSageMakerFn = mkPyLambda("TrainSageMaker", "ml.src.lambdas.train_sagemaker.handler");
    trainSageMakerFn.addToRolePolicy(sagemakerApiPolicy);
    trainSageMakerFn.addToRolePolicy(passRolePolicy);
    
    // SageMaker: Ranking com inferência (precisa de XGBoost)
    const rankSageMakerFn = mkMLLambda("RankSageMaker", "ml.src.lambdas.rank_sagemaker.handler");
    rankSageMakerFn.addToRolePolicy(sagemakerApiPolicy);

    // Monitoramento
    const monitorIngestionFn = mkPyLambda("MonitorIngestion", "ml.src.lambdas.monitor_ingestion.handler");
    const monitorQualityFn = mkPyLambda("MonitorModelQuality", "ml.src.lambdas.monitor_model_quality.handler");
    const monitorPerformanceFn = mkPyLambda("MonitorModelPerformance", "ml.src.lambdas.monitor_model_performance.handler", {
      ALERTS_TOPIC_ARN: alertsTopic.topicArn,
    });
    const monitorCostsFn = mkPyLambda("MonitorCosts", "ml.src.lambdas.monitor_costs.handler");
    const monitorSageMakerFn = mkPyLambda("MonitorSageMaker", "ml.src.lambdas.monitor_sagemaker.handler", {
      ALERTS_TOPIC_ARN: alertsTopic.topicArn,
    });
    
    // Lambda para gerar dados de exemplo para o dashboard web
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

    // Model Optimization Pipeline Lambdas
    const featureEngineeringFn = mkPyLambda(
      "FeatureEngineering",
      "ml.src.lambdas.feature_engineering.handler"
    );

    // Hyperparameter optimization needs longer timeout and more memory
    const optimizeHyperparametersFn = new lambda.Function(this, "OptimizeHyperparameters", {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambdaCode,
      handler: "ml.src.lambdas.optimize_hyperparameters.handler",
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: commonEnv,
      layers: [pythonLayer],
    });
    optimizeHyperparametersFn.addToRolePolicy(s3RwPolicy);
    optimizeHyperparametersFn.addToRolePolicy(cwPutMetricPolicy);
    optimizeHyperparametersFn.addToRolePolicy(ssmReadPolicy);

    // Model training needs longer timeout and more memory
    const trainModelsFn = new lambda.Function(this, "TrainModels", {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambdaCode,
      handler: "ml.src.lambdas.train_models.handler",
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: commonEnv,
      layers: [pythonLayer],
    });
    trainModelsFn.addToRolePolicy(s3RwPolicy);
    trainModelsFn.addToRolePolicy(cwPutMetricPolicy);
    trainModelsFn.addToRolePolicy(ssmReadPolicy);
    trainModelsFn.addToRolePolicy(sagemakerApiPolicy);
    trainModelsFn.addToRolePolicy(passRolePolicy);

    const ensemblePredictFn = mkPyLambda(
      "EnsemblePredict",
      "ml.src.lambdas.ensemble_predict.handler"
    );
    ensemblePredictFn.addToRolePolicy(sagemakerApiPolicy);

    const monitoringFn = mkPyLambda(
      "Monitoring",
      "ml.src.lambdas.monitoring.handler"
    );

    const dashboardApiFn = mkPyLambda(
      "DashboardAPI",
      "ml.src.lambdas.public_recommendations_api.handler"
    );
    
    // -----------------------
    // API Gateway with API Key authentication
    // -----------------------
    const api = new apigateway.RestApi(this, "B3TRDashboardAPI", {
      restApiName: "B3TR Dashboard API",
      description: "Secure API for B3 Tactical Ranking Dashboard",
      deployOptions: {
        stageName: "prod",
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Api-Key', 'Authorization'],
      },
    });

    // Create API Key
    const apiKey = api.addApiKey("DashboardApiKey", {
      apiKeyName: "b3tr-dashboard-key",
      description: "API Key for B3TR Dashboard access",
    });

    // Create Usage Plan
    const usagePlan = api.addUsagePlan("DashboardUsagePlan", {
      name: "B3TR Dashboard Usage Plan",
      description: "Usage plan for dashboard API access",
      throttle: {
        rateLimit: 100,
        burstLimit: 200,
      },
      quota: {
        limit: 10000,
        period: apigateway.Period.DAY,
      },
    });

    usagePlan.addApiKey(apiKey);
    usagePlan.addApiStage({
      stage: api.deploymentStage,
    });

    // Lambda integration
    const dashboardIntegration = new apigateway.LambdaIntegration(dashboardApiFn, {
      proxy: true,
      allowTestInvoke: false,
    });

    // Add endpoints
    const recommendationsResource = api.root.addResource("recommendations");
    recommendationsResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });

    const metricsResource = api.root.addResource("metrics");
    metricsResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });

    const qualityResource = api.root.addResource("quality");
    qualityResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });
    
    // Advanced Features Lambdas
    const backtestingFn = new lambda.Function(this, "Backtesting", {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambdaCode,
      handler: "ml.src.lambdas.run_backtest.handler",
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: commonEnv,
      layers: [pythonLayer],
    });
    backtestingFn.addToRolePolicy(s3RwPolicy);
    backtestingFn.addToRolePolicy(cwPutMetricPolicy);
    backtestingFn.addToRolePolicy(ssmReadPolicy);

    const portfolioOptimizerFn = new lambda.Function(this, "PortfolioOptimizer", {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambdaCode,
      handler: "ml.src.lambdas.optimize_portfolio.handler",
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: commonEnv,
      layers: [pythonLayer],
    });
    portfolioOptimizerFn.addToRolePolicy(s3RwPolicy);
    portfolioOptimizerFn.addToRolePolicy(cwPutMetricPolicy);
    portfolioOptimizerFn.addToRolePolicy(ssmReadPolicy);

    const sentimentAnalysisFn = new lambda.Function(this, "SentimentAnalysis", {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambdaCode,
      handler: "ml.src.lambdas.analyze_sentiment.handler",
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: commonEnv,
      layers: [pythonLayer],
    });
    sentimentAnalysisFn.addToRolePolicy(s3RwPolicy);
    sentimentAnalysisFn.addToRolePolicy(cwPutMetricPolicy);
    sentimentAnalysisFn.addToRolePolicy(ssmReadPolicy);
    sentimentAnalysisFn.addToRolePolicy(secretsPolicy);

    const stopLossCalculatorFn = mkPyLambda(
      "StopLossCalculator",
      "ml.src.lambdas.calculate_stop_loss.handler"
    );
    
    // Grant SNS publish permissions to monitoring Lambda
    monitoringFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["sns:Publish"],
        resources: [alertsTopic.topicArn],
      })
    );

    // Preparação automática de dados de treino
    const prepareTrainingFn = mkPyLambda(
      "PrepareTrainingData", 
      "ml.src.lambdas.prepare_training_data.handler"
    );

    bootstrapHistoryFn.addToRolePolicy(secretsPolicy);
    
    // Permissões para Cost Explorer
    const costExplorerPolicy = new iam.PolicyStatement({
      actions: ["ce:GetCostAndUsage", "ce:GetCostForecast"],
      resources: ["*"],
    });
    monitorCostsFn.addToRolePolicy(costExplorerPolicy);
    
    // Permissões SNS para monitoramento de performance
    const snsPublishPolicy = new iam.PolicyStatement({
      actions: ["sns:Publish"],
      resources: [alertsTopic.topicArn],
    });
    monitorPerformanceFn.addToRolePolicy(snsPublishPolicy);
    monitorSageMakerFn.addToRolePolicy(snsPublishPolicy);
    
    // Permissões SageMaker para monitoramento
    const sagemakerReadPolicy = new iam.PolicyStatement({
      actions: [
        "sagemaker:ListTrainingJobs",
        "sagemaker:DescribeTrainingJob",
        "sagemaker:ListEndpoints",
        "sagemaker:DescribeEndpoint",
        "sagemaker:DescribeEndpointConfig",
        "sagemaker:ListTransformJobs",
        "sagemaker:DescribeTransformJob",
      ],
      resources: ["*"],
    });
    monitorSageMakerFn.addToRolePolicy(sagemakerReadPolicy);

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

    // Ranking SageMaker diário (18:10 BRT = 21:10 UTC)
    const rankSageMakerRule = new events.Rule(this, "RankSageMakerDaily", {
      schedule: events.Schedule.expression("cron(10 21 ? * MON-FRI *)"),
    });
    rankSageMakerRule.addTarget(new targets.LambdaFunction(rankSageMakerFn));

    // Monitor de custos diário (08:00 UTC = 05:00 BRT)
    const monitorCostsRule = new events.Rule(this, "MonitorCostsDaily", {
      schedule: events.Schedule.expression("cron(0 8 * * ? *)"),
    });
    monitorCostsRule.addTarget(new targets.LambdaFunction(monitorCostsFn));

    // Manter rank_finalize por compatibilidade (desabilitado por padrão)
    // const rankFinalizeRule = new events.Rule(this, "RankDailyFinalize", {
    //   schedule: events.Schedule.expression("cron(40 21 ? * MON-FRI *)"),
    // });
    // rankFinalizeRule.addTarget(new targets.LambdaFunction(rankFinalizeFn));

    const monitorQualityRule = new events.Rule(this, "MonitorQualityDaily", {
      schedule: events.Schedule.expression("cron(0 22 ? * MON-FRI *)"),
    });
    monitorQualityRule.addTarget(new targets.LambdaFunction(monitorQualityFn));

    // Monitor de performance do modelo: roda diariamente para validar predições de 20 dias atrás
    const monitorPerformanceRule = new events.Rule(this, "MonitorPerformanceDaily", {
      schedule: events.Schedule.expression("cron(30 22 ? * MON-FRI *)"), // 19:30 BRT
    });
    monitorPerformanceRule.addTarget(new targets.LambdaFunction(monitorPerformanceFn));
    
    // Monitor do SageMaker: roda a cada 5 minutos para detectar recursos ativos
    const monitorSageMakerRule = new events.Rule(this, "MonitorSageMakerFrequent", {
      schedule: events.Schedule.expression("cron(0/5 * * * ? *)"), // A cada 5 minutos
    });
    monitorSageMakerRule.addTarget(new targets.LambdaFunction(monitorSageMakerFn));

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

    // Geração de dados de exemplo para o dashboard (roda 1x por semana para manter dados atualizados)
    const generateSampleDataRule = new events.Rule(this, "GenerateSampleDataWeekly", {
      schedule: events.Schedule.expression("cron(0 23 ? * SUN *)"), // Domingo 20:00 BRT
    });
    generateSampleDataRule.addTarget(new targets.LambdaFunction(generateSampleDataFn));

    // Model Optimization Pipeline Schedules
    
    // Feature Engineering: roda diariamente após ingestão de dados
    const featureEngineeringRule = new events.Rule(this, "FeatureEngineeringDaily", {
      schedule: events.Schedule.expression("cron(0 22 ? * MON-FRI *)"), // 19:00 BRT
    });
    featureEngineeringRule.addTarget(new targets.LambdaFunction(featureEngineeringFn));

    // Hyperparameter Optimization: roda mensalmente no primeiro dia útil
    const optimizeHyperparametersRule = new events.Rule(this, "OptimizeHyperparametersMonthly", {
      schedule: events.Schedule.expression("cron(0 2 1 * ? *)"), // 1st day of month, 23:00 BRT
    });
    optimizeHyperparametersRule.addTarget(new targets.LambdaFunction(optimizeHyperparametersFn));

    // Model Training: roda semanalmente aos domingos
    const trainModelsRule = new events.Rule(this, "TrainModelsWeekly", {
      schedule: events.Schedule.expression("cron(0 3 ? * SUN *)"), // Domingo 00:00 BRT
    });
    trainModelsRule.addTarget(new targets.LambdaFunction(trainModelsFn));

    // Ensemble Prediction: roda diariamente após feature engineering
    const ensemblePredictRule = new events.Rule(this, "EnsemblePredictDaily", {
      schedule: events.Schedule.expression("cron(30 22 ? * MON-FRI *)"), // 19:30 BRT
    });
    ensemblePredictRule.addTarget(new targets.LambdaFunction(ensemblePredictFn));

    // Monitoring: roda diariamente após predictions
    const monitoringRule = new events.Rule(this, "MonitoringDaily", {
      schedule: events.Schedule.expression("cron(0 23 ? * MON-FRI *)"), // 20:00 BRT
    });
    monitoringRule.addTarget(new targets.LambdaFunction(monitoringFn));

    // Advanced Features Schedules
    
    // Backtesting: roda diariamente para validar predições de 20 dias atrás
    const backtestingRule = new events.Rule(this, "BacktestingDaily", {
      schedule: events.Schedule.expression("cron(0 1 ? * MON-FRI *)"), // 22:00 BRT
    });
    backtestingRule.addTarget(new targets.LambdaFunction(backtestingFn));

    // Portfolio Optimization: roda diariamente após recomendações
    const portfolioOptimizerRule = new events.Rule(this, "PortfolioOptimizerDaily", {
      schedule: events.Schedule.expression("cron(50 21 ? * MON-FRI *)"), // 18:50 BRT
    });
    portfolioOptimizerRule.addTarget(new targets.LambdaFunction(portfolioOptimizerFn));

    // Sentiment Analysis: roda diariamente pela manhã
    const sentimentAnalysisRule = new events.Rule(this, "SentimentAnalysisDaily", {
      schedule: events.Schedule.expression("cron(0 12 ? * MON-FRI *)"), // 09:00 BRT
    });
    sentimentAnalysisRule.addTarget(new targets.LambdaFunction(sentimentAnalysisFn));

    // Stop Loss Calculator: roda diariamente após recomendações
    const stopLossCalculatorRule = new events.Rule(this, "StopLossCalculatorDaily", {
      schedule: events.Schedule.expression("cron(45 21 ? * MON-FRI *)"), // 18:45 BRT
    });
    stopLossCalculatorRule.addTarget(new targets.LambdaFunction(stopLossCalculatorFn));

    // S3 Event Triggers
    
    // Trigger feature engineering when new raw data is uploaded
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(featureEngineeringFn),
      { prefix: 'raw/', suffix: '.csv' }
    );

    // Trigger training when hyperparameters are updated
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(trainModelsFn),
      { prefix: 'hyperparameters/', suffix: 'best_params.json' }
    );

    // Trigger predictions when new features are available
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(ensemblePredictFn),
      { prefix: 'features/', suffix: 'features.csv' }
    );

    // Trigger monitoring when new predictions are available
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(monitoringFn),
      { prefix: 'predictions/', suffix: 'ensemble_predictions.json' }
    );

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

    // Model Optimization Pipeline Alarms
    
    // Alarm for feature engineering failures
    const featureEngineeringErrorMetric = featureEngineeringFn.metricErrors({
      period: cdk.Duration.minutes(5),
      statistic: "Sum",
    });
    
    const featureEngineeringAlarm = new cw.Alarm(this, "FeatureEngineeringFailedAlarm", {
      metric: featureEngineeringErrorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: "Feature engineering Lambda failed",
    });
    featureEngineeringAlarm.addAlarmAction(new cw_actions.SnsAction(alertsTopic));

    // Alarm for model training failures
    const trainModelsErrorMetric = trainModelsFn.metricErrors({
      period: cdk.Duration.minutes(5),
      statistic: "Sum",
    });
    
    const trainModelsAlarm = new cw.Alarm(this, "TrainModelsFailedAlarm", {
      metric: trainModelsErrorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: "Model training Lambda failed",
    });
    trainModelsAlarm.addAlarmAction(new cw_actions.SnsAction(alertsTopic));

    // Alarm for ensemble prediction failures
    const ensemblePredictErrorMetric = ensemblePredictFn.metricErrors({
      period: cdk.Duration.minutes(5),
      statistic: "Sum",
    });
    
    const ensemblePredictAlarm = new cw.Alarm(this, "EnsemblePredictFailedAlarm", {
      metric: ensemblePredictErrorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: "Ensemble prediction Lambda failed",
    });
    ensemblePredictAlarm.addAlarmAction(new cw_actions.SnsAction(alertsTopic));

    // Alarm for monitoring failures
    const monitoringErrorMetric = monitoringFn.metricErrors({
      period: cdk.Duration.minutes(5),
      statistic: "Sum",
    });
    
    const monitoringAlarm = new cw.Alarm(this, "MonitoringFailedAlarm", {
      metric: monitoringErrorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: "Monitoring Lambda failed",
    });
    monitoringAlarm.addAlarmAction(new cw_actions.SnsAction(alertsTopic));

    // Advanced Features Alarms
    
    // Alarm for backtesting failures
    const backtestingErrorMetric = backtestingFn.metricErrors({
      period: cdk.Duration.minutes(5),
      statistic: "Sum",
    });
    
    const backtestingAlarm = new cw.Alarm(this, "BacktestingFailedAlarm", {
      metric: backtestingErrorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: "Backtesting Lambda failed",
    });
    backtestingAlarm.addAlarmAction(new cw_actions.SnsAction(alertsTopic));

    // Alarm for portfolio optimizer failures
    const portfolioOptimizerErrorMetric = portfolioOptimizerFn.metricErrors({
      period: cdk.Duration.minutes(5),
      statistic: "Sum",
    });
    
    const portfolioOptimizerAlarm = new cw.Alarm(this, "PortfolioOptimizerFailedAlarm", {
      metric: portfolioOptimizerErrorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: "Portfolio Optimizer Lambda failed",
    });
    portfolioOptimizerAlarm.addAlarmAction(new cw_actions.SnsAction(alertsTopic));

    // Alarm for sentiment analysis failures
    const sentimentAnalysisErrorMetric = sentimentAnalysisFn.metricErrors({
      period: cdk.Duration.minutes(5),
      statistic: "Sum",
    });
    
    const sentimentAnalysisAlarm = new cw.Alarm(this, "SentimentAnalysisFailedAlarm", {
      metric: sentimentAnalysisErrorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: "Sentiment Analysis Lambda failed",
    });
    sentimentAnalysisAlarm.addAlarmAction(new cw_actions.SnsAction(alertsTopic));

    // Alarm for stop loss calculator failures
    const stopLossCalculatorErrorMetric = stopLossCalculatorFn.metricErrors({
      period: cdk.Duration.minutes(5),
      statistic: "Sum",
    });
    
    const stopLossCalculatorAlarm = new cw.Alarm(this, "StopLossCalculatorFailedAlarm", {
      metric: stopLossCalculatorErrorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: "Stop Loss Calculator Lambda failed",
    });
    stopLossCalculatorAlarm.addAlarmAction(new cw_actions.SnsAction(alertsTopic));

    // CloudWatch Dashboard for Model Optimization
    const modelOptimizationDashboard = new cw.Dashboard(this, "ModelOptimizationDashboard", {
      dashboardName: "B3TR-ModelOptimization",
    });

    modelOptimizationDashboard.addWidgets(
      new cw.GraphWidget({
        title: "Lambda Invocations",
        left: [
          featureEngineeringFn.metricInvocations(),
          trainModelsFn.metricInvocations(),
          ensemblePredictFn.metricInvocations(),
          monitoringFn.metricInvocations(),
          backtestingFn.metricInvocations(),
          portfolioOptimizerFn.metricInvocations(),
        ],
        width: 12,
      }),
      new cw.GraphWidget({
        title: "Lambda Errors",
        left: [
          featureEngineeringErrorMetric,
          trainModelsErrorMetric,
          ensemblePredictErrorMetric,
          monitoringErrorMetric,
          backtestingErrorMetric,
          portfolioOptimizerErrorMetric,
        ],
        width: 12,
      })
    );

    modelOptimizationDashboard.addWidgets(
      new cw.GraphWidget({
        title: "Lambda Duration",
        left: [
          featureEngineeringFn.metricDuration(),
          trainModelsFn.metricDuration(),
          ensemblePredictFn.metricDuration(),
          monitoringFn.metricDuration(),
          backtestingFn.metricDuration(),
          portfolioOptimizerFn.metricDuration(),
        ],
        width: 12,
      }),
      new cw.GraphWidget({
        title: "Advanced Features",
        left: [
          sentimentAnalysisFn.metricInvocations(),
          stopLossCalculatorFn.metricInvocations(),
        ],
        width: 12,
      })
    );

    // -----------------------
    // Dashboard Web - REMOVIDO (usando GitHub Pages)
    // -----------------------
    // Dashboard agora está hospedado no GitHub Pages:
    // https://uesleisutil.github.io/b3-tactical-ranking
    
    // -----------------------
    // Outputs
    // -----------------------
    new cdk.CfnOutput(this, "BucketName", { value: bucket.bucketName });
    new cdk.CfnOutput(this, "AlertsTopicArn", { value: alertsTopic.topicArn });
    new cdk.CfnOutput(this, "SageMakerRoleArn", { value: sagemakerRole.roleArn });
    new cdk.CfnOutput(this, "SsmPrefix", { value: ssmPrefix });
    new cdk.CfnOutput(this, "DashboardUrl", {
      value: "https://uesleisutil.github.io/b3-tactical-ranking",
      description: "URL do Dashboard Web B3TR (GitHub Pages)"
    });
    new cdk.CfnOutput(this, "ModelOptimizationDashboardUrl", {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${cdk.Aws.REGION}#dashboards:name=B3TR-ModelOptimization`,
      description: "CloudWatch Dashboard for Model Optimization Pipeline"
    });
    new cdk.CfnOutput(this, "FeatureEngineeringLambda", {
      value: featureEngineeringFn.functionName,
      description: "Feature Engineering Lambda Function"
    });
    new cdk.CfnOutput(this, "TrainModelsLambda", {
      value: trainModelsFn.functionName,
      description: "Model Training Lambda Function"
    });
    new cdk.CfnOutput(this, "EnsemblePredictLambda", {
      value: ensemblePredictFn.functionName,
      description: "Ensemble Prediction Lambda Function"
    });
    new cdk.CfnOutput(this, "MonitoringLambda", {
      value: monitoringFn.functionName,
      description: "Monitoring Lambda Function"
    });
    new cdk.CfnOutput(this, "BacktestingLambda", {
      value: backtestingFn.functionName,
      description: "Backtesting Lambda Function"
    });
    new cdk.CfnOutput(this, "PortfolioOptimizerLambda", {
      value: portfolioOptimizerFn.functionName,
      description: "Portfolio Optimizer Lambda Function"
    });
    new cdk.CfnOutput(this, "SentimentAnalysisLambda", {
      value: sentimentAnalysisFn.functionName,
      description: "Sentiment Analysis Lambda Function"
    });
    new cdk.CfnOutput(this, "StopLossCalculatorLambda", {
      value: stopLossCalculatorFn.functionName,
      description: "Stop Loss Calculator Lambda Function"
    });
    new cdk.CfnOutput(this, "DashboardApiUrl", {
      value: api.url,
      description: "Dashboard API Gateway URL"
    });
    new cdk.CfnOutput(this, "DashboardApiKeyId", {
      value: apiKey.keyId,
      description: "Dashboard API Key ID (use 'aws apigateway get-api-key' to retrieve value)"
    });
  }
}