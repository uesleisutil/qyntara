#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { InfraStack } from "../lib/infra-stack";
import { MonitoringStack } from "../lib/monitoring-stack";
import { SecurityStack } from "../lib/security-stack";
import { OptimizationStack } from "../lib/optimization-stack";
import { DisasterRecoveryStack } from "../lib/disaster-recovery-stack";

const app = new cdk.App();

const stage = app.node.tryGetContext("stage") || process.env.B3TR_STAGE || "prod";
const stackName = stage === "staging" ? "B3TacticalRankingStaging" : "B3TacticalRankingStackV2";
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };
const lambdaExcludes = ["infra", ".git", ".venv", "node_modules", "**/__pycache__", "**/*.pyc", ".DS_Store", "lambda-layer*.zip", "lambda-layer*"];

const infraStack = new InfraStack(app, stackName, { env });

new MonitoringStack(app, "MonitoringStack", {
  env,
  alertEmail: process.env.ALERT_EMAIL || "alerts@example.com",
  namespace: "B3Dashboard",
  logGroupName: "/aws/lambda/b3-dashboard",
});

const securityStack = new SecurityStack(app, "SecurityStack", {
  env,
  bucket: infraStack.bucket.bucketName,
  userPoolId: "api-key-auth",
  lambdaCode: lambda.Code.fromAsset(path.join(__dirname, "..", ".."), { exclude: lambdaExcludes }),
});

new OptimizationStack(app, "OptimizationStack", {
  env,
  bucket: infraStack.bucket,
});

new DisasterRecoveryStack(app, "DisasterRecoveryStack", {
  env,
  primaryBucket: infraStack.bucket,
  dynamoTables: {
    apiKeys: securityStack.apiKeysTable,
    authLogs: securityStack.authLogsTable,
    rateLimits: securityStack.rateLimitsTable,
  },
  lambdaCode: lambda.Code.fromAsset(path.join(__dirname, "..", ".."), { exclude: lambdaExcludes }),
  alertTopic: infraStack.alertsTopic,
  backupRegion: "us-west-2",
});
