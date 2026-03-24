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
  public readonly bucket: s3.Bucket;
  public readonly alertsTopic: sns.Topic;

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
    // S3 Bucket com estrutura de particionamento por data
    // -----------------------
    const bucketPrefixRaw = envOr("B3TR_BUCKET_PREFIX", "b3tr");
    const bucketPrefix = sanitizeBucketPrefix(bucketPrefixRaw);
    const bucketName = `${bucketPrefix}-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`.slice(0, 63);

    this.bucket = new s3.Bucket(this, "B3TRBucket", {
      bucketName,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      lifecycleRules: [
        {
          // Mover dados antigos de quotes_5m para Glacier após 90 dias
          id: "ArchiveOldQuotes",
          enabled: true,
          prefix: "quotes_5m/",
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
        {
          // Deletar dados de monitoring após 1 ano
          id: "DeleteOldMonitoring",
          enabled: true,
          prefix: "monitoring/",
          expiration: cdk.Duration.days(365),
        },
      ],
    });
    
    // Estrutura de pastas esperada no S3:
    // - config/                          # Configurações (universe.txt, holidays.json)
    // - quotes_5m/dt=YYYY-MM-DD/        # Dados brutos de cotações
    // - recommendations/dt=YYYY-MM-DD/   # Recomendações diárias
    // - monitoring/
    //   ├── ingestion/dt=YYYY-MM-DD/    # Metadados de ingestão
    //   ├── data_quality/dt=YYYY-MM-DD/ # Métricas de qualidade
    //   ├── lineage/dt=YYYY-MM-DD/      # Rastreamento de linhagem
    //   ├── performance/dt=YYYY-MM-DD/  # Métricas de performance do modelo
    //   ├── drift/dt=YYYY-MM-DD/        # Detecção de drift
    //   ├── costs/dt=YYYY-MM-DD/        # Monitoramento de custos
    //   ├── ensemble_weights/dt=YYYY-MM-DD/ # Pesos do ensemble
    //   ├── api_latency/dt=YYYY-MM-DD/  # Latência da API BRAPI
    //   ├── completeness/dt=YYYY-MM-DD/ # Completude dos dados
    //   ├── errors/dt=YYYY-MM-DD/       # Erros e retries
    //   └── validation/                  # Relatórios de validação histórica

    const bucket = this.bucket;

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
    // Secrets Manager - BRAPI token (já existe)
    // -----------------------
    const brapiSecret = secrets.Secret.fromSecretNameV2(this, "BrapiSecret", brapiSecretId);
    // Note: brapiSecret is used implicitly by Lambda functions that access the secret via brapiSecretId
    
    // Validação: garantir que o secret existe (será criado manualmente ou via script)
    // O secret deve conter: { "token": "seu-token-brapi" }

    // -----------------------
    // SNS Alerts
    // -----------------------
    this.alertsTopic = new sns.Topic(this, "B3TRAlertsTopic", {
      topicName: "b3tr-alerts",
      displayName: "B3TR Alerts",
    });

    const alertsTopic = this.alertsTopic;
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

    // Docker image para Lambdas ML (XGBoost + scipy + pandas + requests)
    const mlDockerCode = lambda.DockerImageCode.fromImageAsset(
      path.join(__dirname, "..", ".."),
      {
        file: "ml/Dockerfile.rank",
        exclude: ["infra", ".git", ".venv", "node_modules", "dashboard", "**/__pycache__", "**/*.pyc"],
        platform: cdk.aws_ecr_assets.Platform.LINUX_AMD64,
      }
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

    // Factory para Lambdas com ML dependencies (Docker container)
    const mkMLLambda = (
      logicalId: string,
      handlerPath: string,
      extraEnv?: Record<string, string>,
    ): lambda.Function => {
      const fn = new lambda.DockerImageFunction(this, logicalId, {
        code: mlDockerCode,
        timeout: cdk.Duration.minutes(15),
        memorySize: 2048,
        logRetention: logs.RetentionDays.ONE_WEEK,
        environment: { ...commonEnv, ...(extraEnv ?? {}) },
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
    const ingestFn = mkPyLambda("Quotes5mIngest", "ml.src.lambdas.ingest_quotes.handler", {
      BRAPI_SECRET_ID: brapiSecretId,
    });
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
    const monitorDriftFn = mkPyLambda("MonitorDrift", "ml.src.lambdas.monitor_drift.handler");
    const generateEnsembleInsightsFn = mkPyLambda("GenerateEnsembleInsights", "ml.src.lambdas.generate_ensemble_insights.handler");
    const generateFeatureImportanceFn = mkPyLambda("GenerateFeatureImportance", "ml.src.lambdas.generate_feature_importance.handler");
    const generatePredictionIntervalsFn = mkPyLambda("GeneratePredictionIntervals", "ml.src.lambdas.generate_prediction_intervals.handler");
    const generateModelMetricsFn = mkPyLambda("GenerateModelMetrics", "ml.src.lambdas.generate_model_metrics.handler");

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

    const dashboardApiFn = mkPyLambda(
      "DashboardAPI",
      "ml.src.lambdas.dashboard_api.handler"
    );
    
    // S3 Proxy Lambda para dashboard acessar dados do S3 via API
    const s3ProxyFn = mkPyLambda(
      "S3Proxy",
      "ml.src.lambdas.s3_proxy.handler"
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
    
    const s3ProxyIntegration = new apigateway.LambdaIntegration(s3ProxyFn, {
      proxy: true,
      allowTestInvoke: false,
    });

    // Add API endpoints - Req 13.1, 13.6
    const apiResource = api.root.addResource("api");
    
    // /api/recommendations/latest
    const recommendationsResource = apiResource.addResource("recommendations");
    const recommendationsLatestResource = recommendationsResource.addResource("latest");
    recommendationsLatestResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });
    
    // /api/recommendations/history
    const recommendationsHistoryResource = recommendationsResource.addResource("history");
    recommendationsHistoryResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });
    
    // /api/recommendations/validation
    const recommendationsValidationResource = recommendationsResource.addResource("validation");
    recommendationsValidationResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });

    // /api/monitoring/*
    const monitoringResource = apiResource.addResource("monitoring");
    
    // /api/monitoring/data-quality
    const dataQualityResource = monitoringResource.addResource("data-quality");
    dataQualityResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });
    
    // /api/data-quality/* endpoints (Req 80.1, 80.10)
    const dataQualityRootResource = apiResource.addResource("data-quality");
    
    // /api/data-quality/completeness
    const completenessResource = dataQualityRootResource.addResource("completeness");
    completenessResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });
    
    // /api/data-quality/anomalies
    const anomaliesResource = dataQualityRootResource.addResource("anomalies");
    anomaliesResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });
    
    // /api/data-quality/freshness
    const freshnessResource = dataQualityRootResource.addResource("freshness");
    freshnessResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });
    
    // /api/data-quality/coverage
    const coverageResource = dataQualityRootResource.addResource("coverage");
    coverageResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });
    
    // /api/monitoring/model-performance
    const modelPerformanceResource = monitoringResource.addResource("model-performance");
    modelPerformanceResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });
    
    // /api/monitoring/drift
    const driftResource = monitoringResource.addResource("drift");
    driftResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });
    
    // /api/monitoring/costs
    const costsResource = monitoringResource.addResource("costs");
    costsResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });
    
    // /api/monitoring/ensemble-weights
    const ensembleWeightsResource = monitoringResource.addResource("ensemble-weights");
    ensembleWeightsResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });
    
    // Legacy endpoints (backward compatibility)
    const metricsResource = api.root.addResource("metrics");
    metricsResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });

    const qualityResource = api.root.addResource("quality");
    qualityResource.addMethod("GET", dashboardIntegration, {
      apiKeyRequired: true,
    });
    
    // S3 Proxy endpoints
    const s3ProxyResource = api.root.addResource("s3-proxy");
    s3ProxyResource.addMethod("GET", s3ProxyIntegration, {
      apiKeyRequired: true,
      requestParameters: {
        'method.request.querystring.key': false
      }
    });
    
    const s3ProxyListResource = s3ProxyResource.addResource("list");
    s3ProxyListResource.addMethod("GET", s3ProxyIntegration, {
      apiKeyRequired: true,
      requestParameters: {
        'method.request.querystring.prefix': false
      }
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

    // Preparação automática de dados de treino
    const prepareTrainingFn = mkPyLambda(
      "PrepareTrainingData", 
      "ml.src.lambdas.prepare_training_data.handler"
    );

    bootstrapHistoryFn.addToRolePolicy(secretsPolicy);
    
    // Permissões SageMaker para monitoramento (declarar antes de usar)
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
    
    // Permissões para Cost Explorer
    const costExplorerPolicy = new iam.PolicyStatement({
      actions: ["ce:GetCostAndUsage", "ce:GetCostForecast"],
      resources: ["*"],
    });
    monitorCostsFn.addToRolePolicy(costExplorerPolicy);
    monitorCostsFn.addToRolePolicy(sagemakerReadPolicy);
    
    // Permissões SNS para monitoramento de performance
    const snsPublishPolicy = new iam.PolicyStatement({
      actions: ["sns:Publish"],
      resources: [alertsTopic.topicArn],
    });
    monitorPerformanceFn.addToRolePolicy(snsPublishPolicy);
    monitorSageMakerFn.addToRolePolicy(snsPublishPolicy);
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

    // Ranking SageMaker diário (18:30 BRT = 21:30 UTC) - Req 6.1
    const rankSageMakerRule = new events.Rule(this, "RankSageMakerDaily", {
      schedule: events.Schedule.expression("cron(30 21 ? * MON-FRI *)"),
    });
    rankSageMakerRule.addTarget(new targets.LambdaFunction(rankSageMakerFn));

    // Monitor de custos diário (21:00 BRT = 00:00 UTC do dia seguinte) - Req 9.1
    const monitorCostsRule = new events.Rule(this, "MonitorCostsDaily", {
      schedule: events.Schedule.expression("cron(0 0 * * ? *)"),
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

    // Monitor de performance do modelo: roda diariamente para validar predições de 20 dias atrás (Req 7.6)
    const monitorPerformanceRule = new events.Rule(this, "MonitorPerformanceDaily", {
      schedule: events.Schedule.expression("cron(0 23 ? * MON-FRI *)"), // 20:00 BRT
    });
    monitorPerformanceRule.addTarget(new targets.LambdaFunction(monitorPerformanceFn));
    
    // Monitor do SageMaker: roda a cada 5 minutos para detectar recursos ativos
    const monitorSageMakerRule = new events.Rule(this, "MonitorSageMakerFrequent", {
      schedule: events.Schedule.expression("cron(0/5 * * * ? *)"), // A cada 5 minutos
    });
    monitorSageMakerRule.addTarget(new targets.LambdaFunction(monitorSageMakerFn));

    // Monitor de drift: roda diariamente após o performance monitor (Req 8.1)
    const monitorDriftRule = new events.Rule(this, "MonitorDriftDaily", {
      schedule: events.Schedule.expression("cron(30 23 ? * MON-FRI *)"), // 20:30 BRT
    });
    monitorDriftRule.addTarget(new targets.LambdaFunction(monitorDriftFn));

    // Gerar ensemble insights: roda diariamente
    const generateEnsembleInsightsRule = new events.Rule(this, "GenerateEnsembleInsightsDaily", {
      schedule: events.Schedule.expression("cron(20 21 ? * MON-FRI *)"), // 18:20 BRT
    });
    generateEnsembleInsightsRule.addTarget(new targets.LambdaFunction(generateEnsembleInsightsFn));

    // Gerar feature importance: roda diariamente
    const generateFeatureImportanceRule = new events.Rule(this, "GenerateFeatureImportanceDaily", {
      schedule: events.Schedule.expression("cron(25 21 ? * MON-FRI *)"), // 18:25 BRT
    });
    generateFeatureImportanceRule.addTarget(new targets.LambdaFunction(generateFeatureImportanceFn));

    // Gerar prediction intervals: roda diariamente após o ranking
    const generatePredictionIntervalsRule = new events.Rule(this, "GeneratePredictionIntervalsDaily", {
      schedule: events.Schedule.expression("cron(30 21 ? * MON-FRI *)"), // 18:30 BRT
    });
    generatePredictionIntervalsRule.addTarget(new targets.LambdaFunction(generatePredictionIntervalsFn));

    // Gerar model metrics: roda diariamente
    const generateModelMetricsRule = new events.Rule(this, "GenerateModelMetricsDaily", {
      schedule: events.Schedule.expression("cron(35 21 ? * MON-FRI *)"), // 18:35 BRT
    });
    generateModelMetricsRule.addTarget(new targets.LambdaFunction(generateModelMetricsFn));

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

    // S3 Event Triggers - REMOVED (obsolete Lambdas)

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

    // CloudWatch Dashboard for Advanced Features
    const advancedFeaturesDashboard = new cw.Dashboard(this, "AdvancedFeaturesDashboard", {
      dashboardName: "B3TR-AdvancedFeatures",
    });

    advancedFeaturesDashboard.addWidgets(
      new cw.GraphWidget({
        title: "Lambda Invocations",
        left: [
          backtestingFn.metricInvocations(),
          portfolioOptimizerFn.metricInvocations(),
          sentimentAnalysisFn.metricInvocations(),
          stopLossCalculatorFn.metricInvocations(),
        ],
        width: 12,
      }),
      new cw.GraphWidget({
        title: "Lambda Errors",
        left: [
          backtestingErrorMetric,
          portfolioOptimizerErrorMetric,
          sentimentAnalysisErrorMetric,
          stopLossCalculatorErrorMetric,
        ],
        width: 12,
      })
    );

    advancedFeaturesDashboard.addWidgets(
      new cw.GraphWidget({
        title: "Lambda Duration",
        left: [
          backtestingFn.metricDuration(),
          portfolioOptimizerFn.metricDuration(),
          sentimentAnalysisFn.metricDuration(),
          stopLossCalculatorFn.metricDuration(),
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
    // Task 28.1: Storage Optimizer Lambda
    // -----------------------
    const storageOptimizerFn = mkPyLambda(
      "StorageOptimizer",
      "ml.src.lambdas.storage_optimizer.handler"
    );
    
    // Grant additional S3 permissions for storage analysis
    storageOptimizerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:GetBucketLocation",
          "s3:GetBucketVersioning",
          "s3:GetLifecycleConfiguration",
          "s3:ListBucketVersions",
          "s3:GetBucketTagging",
        ],
        resources: [bucket.bucketArn],
      })
    );
    
    // Schedule storage optimizer to run daily
    const storageOptimizerRule = new events.Rule(this, "StorageOptimizerDaily", {
      schedule: events.Schedule.expression("cron(0 2 * * ? *)"), // 02:00 UTC daily
    });
    storageOptimizerRule.addTarget(new targets.LambdaFunction(storageOptimizerFn));

    // -----------------------
    // DynamoDB Users Table (Auth)
    // -----------------------
    const usersTable = new cdk.aws_dynamodb.Table(this, "UsersTable", {
      tableName: "B3Dashboard-Users",
      partitionKey: { name: "email", type: cdk.aws_dynamodb.AttributeType.STRING },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: cdk.aws_dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // DynamoDB Notifications Table (import existing)
    const notificationsTable = cdk.aws_dynamodb.Table.fromTableName(this, "NotificationsTable", "B3Dashboard-Notifications");

    // JWT Secret via SSM
    const jwtSecret = envOr("JWT_SECRET", "b3tr-jwt-secret-change-in-production-" + cdk.Aws.ACCOUNT_ID);
    const adminEmail = envOr("ADMIN_EMAIL", "");

    // User Auth Lambda
    const userAuthFn = mkPyLambda("UserAuth", "ml.src.lambdas.user_auth.handler", {
      USERS_TABLE: usersTable.tableName,
      AUTH_LOGS_TABLE: "B3Dashboard-AuthLogs",
      RATE_LIMITS_TABLE: "B3Dashboard-RateLimits",
      NOTIFICATIONS_TABLE: "B3Dashboard-Notifications",
      CHAT_TABLE: "B3Dashboard-Chat",
      JWT_SECRET: jwtSecret,
      ADMIN_EMAIL: adminEmail,
      SES_SENDER_EMAIL: adminEmail,
      STRIPE_SECRET_KEY: envOr("STRIPE_SECRET_KEY", ""),
      STRIPE_WEBHOOK_SECRET: envOr("STRIPE_WEBHOOK_SECRET", ""),
      STRIPE_PRICE_ID: envOr("STRIPE_PRICE_ID", ""),
      FRONTEND_URL: "https://uesleisutil.github.io/b3-tactical-ranking",
    });
    usersTable.grantReadWriteData(userAuthFn);

    // Grant auth logs write + delete (for LGPD account deletion)
    userAuthFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:PutItem", "dynamodb:Query", "dynamodb:BatchWriteItem"],
      resources: [`arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/B3Dashboard-AuthLogs`],
    }));

    // Grant rate limits table access
    userAuthFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:PutItem", "dynamodb:DeleteItem"],
      resources: [`arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/B3Dashboard-RateLimits`],
    }));

    // Grant notifications table access
    userAuthFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Scan", "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"],
      resources: [`arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/B3Dashboard-Notifications`],
    }));

    // Grant chat table access
    userAuthFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Scan", "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"],
      resources: [`arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/B3Dashboard-Chat`],
    }));

    const userAuthIntegration = new apigateway.LambdaIntegration(userAuthFn, {
      proxy: true,
      allowTestInvoke: false,
    });

    // /auth routes (NO API key required - public endpoints)
    const authResource = api.root.addResource("auth");
    const authRegister = authResource.addResource("register");
    authRegister.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });
    const authLogin = authResource.addResource("login");
    authLogin.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });
    const authMe = authResource.addResource("me");
    authMe.addMethod("GET", userAuthIntegration, { apiKeyRequired: false });
    authMe.addMethod("DELETE", userAuthIntegration, { apiKeyRequired: false });

    // Email verification & password reset routes
    const authVerifyEmail = authResource.addResource("verify-email");
    authVerifyEmail.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });
    const authResendCode = authResource.addResource("resend-code");
    authResendCode.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });
    const authForgotPassword = authResource.addResource("forgot-password");
    authForgotPassword.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });
    const authResetPassword = authResource.addResource("reset-password");
    authResetPassword.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });
    const authChangePassword = authResource.addResource("change-password");
    authChangePassword.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });
    const authStats = authResource.addResource("stats");
    authStats.addMethod("GET", userAuthIntegration, { apiKeyRequired: false });
    const authPhone = authResource.addResource("phone");
    authPhone.addMethod("GET", userAuthIntegration, { apiKeyRequired: false });
    authPhone.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });

    // Stripe payment routes
    const authCreateCheckout = authResource.addResource("create-checkout");
    authCreateCheckout.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });
    const authStripeWebhook = authResource.addResource("stripe-webhook");
    authStripeWebhook.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });
    const authCheckSession = authResource.addResource("check-session");
    authCheckSession.addMethod("GET", userAuthIntegration, { apiKeyRequired: false });
    const authManageBilling = authResource.addResource("manage-billing");
    authManageBilling.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });

    // /admin/notifications routes (JWT-protected, admin only)
    const adminResource = api.root.addResource("admin");
    const adminNotifications = adminResource.addResource("notifications");
    adminNotifications.addMethod("GET", userAuthIntegration, { apiKeyRequired: false });
    adminNotifications.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });
    adminNotifications.addMethod("PUT", userAuthIntegration, { apiKeyRequired: false });
    adminNotifications.addMethod("DELETE", userAuthIntegration, { apiKeyRequired: false });

    // /admin/whatsapp route (JWT-protected, admin only)
    const adminWhatsapp = adminResource.addResource("whatsapp");
    adminWhatsapp.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });

    // /admin/users routes (JWT-protected, admin only)
    const adminUsers = adminResource.addResource("users");
    adminUsers.addMethod("GET", userAuthIntegration, { apiKeyRequired: false });
    const adminUsersSetPlan = adminUsers.addResource("set-plan");
    adminUsersSetPlan.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });
    const adminUsersSetRole = adminUsers.addResource("set-role");
    adminUsersSetRole.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });

    // /admin/chat routes (JWT-protected, admin only)
    const adminChat = adminResource.addResource("chat");
    adminChat.addMethod("GET", userAuthIntegration, { apiKeyRequired: false });
    const adminChatReply = adminChat.addResource("reply");
    adminChatReply.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });
    const adminChatClose = adminChat.addResource("close");
    adminChatClose.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });

    // /chat routes (JWT-protected, user-facing)
    const chatResource = api.root.addResource("chat");
    const chatMessages = chatResource.addResource("messages");
    chatMessages.addMethod("POST", userAuthIntegration, { apiKeyRequired: false });
    const chatTickets = chatResource.addResource("tickets");
    chatTickets.addMethod("GET", userAuthIntegration, { apiKeyRequired: false });

    // -----------------------
    // Agent Hub (Multi-Agent Governance)
    // -----------------------
    const agentsTable = new cdk.aws_dynamodb.Table(this, "AgentsTable", {
      tableName: "B3Dashboard-Agents",
      partitionKey: { name: "agentId", type: cdk.aws_dynamodb.AttributeType.STRING },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: cdk.aws_dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const agentHubFn = mkPyLambda("AgentHub", "ml.src.lambdas.agent_hub.handler", {
      AGENTS_TABLE: agentsTable.tableName,
      USERS_TABLE: usersTable.tableName,
      JWT_SECRET: jwtSecret,
      BEDROCK_MODEL_ID: "us.anthropic.claude-3-5-haiku-20241022-v1:0",
    });
    agentsTable.grantReadWriteData(agentHubFn);
    usersTable.grantReadData(agentHubFn);

    // Bedrock permissions for AI agents (cross-region inference profiles)
    agentHubFn.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: ["bedrock:InvokeModel"],
      resources: ["*"],
    }));

    // Marketplace permissions (needed for first-time Anthropic model activation)
    agentHubFn.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: [
        "aws-marketplace:ViewSubscriptions",
        "aws-marketplace:Subscribe",
      ],
      resources: ["*"],
    }));

    const agentHubIntegration = new apigateway.LambdaIntegration(agentHubFn, {
      proxy: true,
      allowTestInvoke: false,
    });

    // /admin/agents routes
    const adminAgents = adminResource.addResource("agents");
    adminAgents.addMethod("GET", agentHubIntegration, { apiKeyRequired: false });
    const adminAgentById = adminAgents.addResource("{agentId}");
    adminAgentById.addMethod("GET", agentHubIntegration, { apiKeyRequired: false });
    const adminAgentChat = adminAgentById.addResource("chat");
    adminAgentChat.addMethod("POST", agentHubIntegration, { apiKeyRequired: false });
    const adminAgentTasks = adminAgentById.addResource("tasks");
    adminAgentTasks.addMethod("PUT", agentHubIntegration, { apiKeyRequired: false });

    // /notifications route (JWT-protected, user-facing)
    const notificationsResource = api.root.addResource("notifications");
    notificationsResource.addMethod("GET", userAuthIntegration, { apiKeyRequired: false });

    // SES permissions for sending verification emails
    userAuthFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["ses:SendEmail", "ses:SendRawEmail"],
      resources: ["*"],
    }));

    // -----------------------
    // AWS WAF — API Gateway Protection
    // -----------------------
    const waf = new cdk.aws_wafv2.CfnWebACL(this, "ApiWaf", {
      name: "B3TR-API-WAF",
      scope: "REGIONAL",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "B3TR-WAF",
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "AWSManagedRulesCommonRuleSet",
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "CommonRuleSet",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "AWSManagedRulesKnownBadInputsRuleSet",
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesKnownBadInputsRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "KnownBadInputs",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "AWSManagedRulesSQLiRuleSet",
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesSQLiRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "SQLiRuleSet",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "RateLimit",
          priority: 4,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "RateLimit",
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // Associate WAF with API Gateway
    new cdk.aws_wafv2.CfnWebACLAssociation(this, "WafApiAssociation", {
      resourceArn: `arn:aws:apigateway:${cdk.Aws.REGION}::/restapis/${api.restApiId}/stages/${api.deploymentStage.stageName}`,
      webAclArn: waf.attrArn,
    });

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
    new cdk.CfnOutput(this, "AdvancedFeaturesDashboardUrl", {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${cdk.Aws.REGION}#dashboards:name=B3TR-AdvancedFeatures`,
      description: "CloudWatch Dashboard for Advanced Features"
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
    new cdk.CfnOutput(this, "StorageOptimizerLambda", {
      value: storageOptimizerFn.functionName,
      description: "Storage Optimizer Lambda Function"
    });

    // -----------------------
    // Feature Store Ingestion Lambda (fundamentals, macro, sentiment)
    // -----------------------
    const ingestFeaturesFn = mkPyLambda(
      "IngestFeatures",
      "ml.src.lambdas.ingest_features.handler",
      { BRAPI_SECRET_ID: brapiSecretId }
    );
    ingestFeaturesFn.addToRolePolicy(secretsPolicy);

    // Feature Store ingestion: roda diariamente após mercado fechar (18:00 BRT = 21:00 UTC)
    const ingestFeaturesRule = new events.Rule(this, "IngestFeaturesDaily", {
      schedule: events.Schedule.expression("cron(0 21 ? * MON-FRI *)"),
    });
    ingestFeaturesRule.addTarget(new targets.LambdaFunction(ingestFeaturesFn));

    // -----------------------
    // Weekly Retrain Lambda
    // -----------------------
    const weeklyRetrainFn = mkPyLambda(
      "WeeklyRetrain",
      "ml.src.lambdas.weekly_retrain.handler",
      { TRAIN_FUNCTION_NAME: trainSageMakerFn.functionName }
    );
    // Permissão para invocar a Lambda de treino
    weeklyRetrainFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["lambda:InvokeFunction"],
      resources: [trainSageMakerFn.functionArn],
    }));

    // Retreino semanal: domingo 22:00 UTC (19:00 BRT)
    const weeklyRetrainRule = new events.Rule(this, "WeeklyRetrainSchedule", {
      schedule: events.Schedule.expression("cron(0 22 ? * SUN *)"),
    });
    weeklyRetrainRule.addTarget(new targets.LambdaFunction(weeklyRetrainFn));

    new cdk.CfnOutput(this, "IngestFeaturesLambda", {
      value: ingestFeaturesFn.functionName,
      description: "Feature Store Ingestion Lambda"
    });
    new cdk.CfnOutput(this, "WeeklyRetrainLambda", {
      value: weeklyRetrainFn.functionName,
      description: "Weekly Retrain Lambda"
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