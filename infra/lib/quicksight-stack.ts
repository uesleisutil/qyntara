import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as quicksight from "aws-cdk-lib/aws-quicksight";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface QuickSightConstructProps {
  bucket: s3.Bucket;
  alertEmail: string;
}

export class QuickSightConstruct extends Construct {
  public readonly dataSourceArn: string;
  public readonly dashboardUrl: string;

  constructor(scope: Construct, id: string, props: QuickSightConstructProps) {
    super(scope, id);

    const { bucket, alertEmail } = props;
    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // Extrair username do email para QuickSight
    // Para usuários IAM, o username é o account ID
    const username = accountId;

    // 1. Data Source - S3
    const dataSource = new quicksight.CfnDataSource(this, "B3TRDataSource", {
      awsAccountId: accountId,
      dataSourceId: "b3tr-s3-datasource",
      name: "B3TR S3 Data Source",
      type: "S3",
      dataSourceParameters: {
        s3Parameters: {
          manifestFileLocation: {
            bucket: bucket.bucketName,
            key: "quicksight/manifest.json",
          },
        },
      },
      permissions: [
        {
          principal: `arn:aws:quicksight:${region}:${accountId}:user/default/${username}`,
          actions: [
            "quicksight:DescribeDataSource",
            "quicksight:DescribeDataSourcePermissions",
            "quicksight:PassDataSource",
            "quicksight:UpdateDataSource",
            "quicksight:DeleteDataSource",
          ],
        },
      ],
    });

    // 2. DataSet - Recommendations (Simplified)
    const recommendationsDataSet = new quicksight.CfnDataSet(this, "RecommendationsDataSet", {
      awsAccountId: accountId,
      dataSetId: "b3tr-recommendations",
      name: "B3TR Daily Recommendations",
      physicalTableMap: {
        "recommendations-table": {
          s3Source: {
            dataSourceArn: dataSource.attrArn,
            inputColumns: [
              { name: "ticker", type: "STRING" },
              { name: "score", type: "DECIMAL" },
              { name: "rank", type: "INTEGER" },
              { name: "predicted_return", type: "DECIMAL" },
              { name: "confidence", type: "DECIMAL" },
              { name: "sector", type: "STRING" },
              { name: "dt", type: "DATETIME" },
            ],
          },
        },
      },
      permissions: [
        {
          principal: `arn:aws:quicksight:${region}:${accountId}:user/default/${username}`,
          actions: [
            "quicksight:DescribeDataSet",
            "quicksight:DescribeDataSetPermissions",
            "quicksight:PassDataSet",
            "quicksight:DescribeIngestion",
            "quicksight:ListIngestions",
            "quicksight:UpdateDataSet",
            "quicksight:DeleteDataSet",
            "quicksight:CreateIngestion",
            "quicksight:CancelIngestion",
          ],
        },
      ],
    });

    // 3. DataSet - Data Quality (Simplified)
    const dataQualityDataSet = new quicksight.CfnDataSet(this, "DataQualityDataSet", {
      awsAccountId: accountId,
      dataSetId: "b3tr-data-quality",
      name: "B3TR Data Quality Metrics",
      physicalTableMap: {
        "quality-table": {
          s3Source: {
            dataSourceArn: dataSource.attrArn,
            inputColumns: [
              { name: "dt", type: "DATETIME" },
              { name: "mape", type: "DECIMAL" },
              { name: "mae", type: "DECIMAL" },
              { name: "rmse", type: "DECIMAL" },
              { name: "coverage", type: "DECIMAL" },
              { name: "status", type: "STRING" },
              { name: "total_predictions", type: "INTEGER" },
              { name: "successful_predictions", type: "INTEGER" },
            ],
          },
        },
      },
      permissions: [
        {
          principal: `arn:aws:quicksight:${region}:${accountId}:user/default/${username}`,
          actions: [
            "quicksight:DescribeDataSet",
            "quicksight:DescribeDataSetPermissions",
            "quicksight:PassDataSet",
            "quicksight:DescribeIngestion",
            "quicksight:ListIngestions",
            "quicksight:UpdateDataSet",
            "quicksight:DeleteDataSet",
            "quicksight:CreateIngestion",
            "quicksight:CancelIngestion",
          ],
        },
      ],
    });

    // 4. DataSet - Ingestion Monitoring (Simplified)
    const ingestionDataSet = new quicksight.CfnDataSet(this, "IngestionDataSet", {
      awsAccountId: accountId,
      dataSetId: "b3tr-ingestion",
      name: "B3TR Data Ingestion Status",
      physicalTableMap: {
        "ingestion-table": {
          s3Source: {
            dataSourceArn: dataSource.attrArn,
            inputColumns: [
              { name: "timestamp", type: "DATETIME" },
              { name: "status", type: "STRING" },
              { name: "records_ingested", type: "INTEGER" },
              { name: "execution_time_ms", type: "INTEGER" },
              { name: "error_message", type: "STRING" },
              { name: "source", type: "STRING" },
            ],
          },
        },
      },
      permissions: [
        {
          principal: `arn:aws:quicksight:${region}:${accountId}:user/default/${username}`,
          actions: [
            "quicksight:DescribeDataSet",
            "quicksight:DescribeDataSetPermissions",
            "quicksight:PassDataSet",
            "quicksight:DescribeIngestion",
            "quicksight:ListIngestions",
            "quicksight:UpdateDataSet",
            "quicksight:DeleteDataSet",
            "quicksight:CreateIngestion",
            "quicksight:CancelIngestion",
          ],
        },
      ],
    });

    // Outputs
    this.dataSourceArn = dataSource.attrArn;
    this.dashboardUrl = `https://${region}.quicksight.aws.amazon.com/sn/start`;

    new cdk.CfnOutput(this, "QuickSightDataSourceArn", {
      value: this.dataSourceArn,
      description: "ARN of the QuickSight data source",
    });

    new cdk.CfnOutput(this, "QuickSightConsoleUrl", {
      value: this.dashboardUrl,
      description: "URL to access QuickSight console to create dashboards",
    });

    new cdk.CfnOutput(this, "QuickSightDataSets", {
      value: `Recommendations: ${recommendationsDataSet.dataSetId}, Quality: ${dataQualityDataSet.dataSetId}, Ingestion: ${ingestionDataSet.dataSetId}`,
      description: "QuickSight DataSet IDs for manual dashboard creation",
    });

    new cdk.CfnOutput(this, "QuickSightSetupInstructions", {
      value: "After deployment, go to QuickSight console, create analysis using the DataSets, then publish as dashboard",
      description: "Instructions for completing QuickSight setup",
    });
  }
}