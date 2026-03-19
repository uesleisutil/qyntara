/**
 * Monitoring Stack
 * 
 * CloudWatch alarms, dashboards, and SNS topics for monitoring and alerting.
 * 
 * Requirements: 83.3, 83.8, 83.9
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  /**
   * Email address for alert notifications
   */
  alertEmail: string;
  
  /**
   * CloudWatch namespace for custom metrics
   */
  namespace?: string;
  
  /**
   * Log group name for application logs
   */
  logGroupName?: string;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;
  
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);
    
    const namespace = props.namespace || 'B3Dashboard';
    const logGroupName = props.logGroupName || '/aws/lambda/b3-dashboard';
    
    // Create SNS topic for alerts (Req 83.9)
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: 'B3 Dashboard Alarms',
      topicName: 'b3-dashboard-alarms',
    });
    
    // Subscribe email to alarm topic
    this.alarmTopic.addSubscription(
      new sns_subscriptions.EmailSubscription(props.alertEmail)
    );
    
    // Create CloudWatch dashboard (Req 83.8)
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: 'B3-Dashboard-System-Health',
    });
    
    // Create alarms and add widgets to dashboard
    this.createPerformanceAlarms(namespace);
    this.createErrorAlarms(namespace, logGroupName);
    this.createBusinessMetricAlarms(namespace);
    this.createModelPerformanceAlarms(namespace);
    this.createDashboardWidgets(namespace);
    
    // Output SNS topic ARN
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarms',
      exportName: 'B3DashboardAlarmTopicArn',
    });
  }
  
  /**
   * Create performance-related alarms
   * 
   * Implements Req 83.3: Create CloudWatch alarms for critical metrics
   */
  private createPerformanceAlarms(namespace: string): void {
    // API Response Time alarm
    const apiResponseTimeAlarm = new cloudwatch.Alarm(this, 'APIResponseTimeAlarm', {
      alarmName: 'B3Dashboard-HighAPIResponseTime',
      alarmDescription: 'API response time exceeds 1 second',
      metric: new cloudwatch.Metric({
        namespace,
        metricName: 'APIResponseTime',
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1000, // 1 second in milliseconds
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiResponseTimeAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    
    // Page Load Time alarm
    const pageLoadTimeAlarm = new cloudwatch.Alarm(this, 'PageLoadTimeAlarm', {
      alarmName: 'B3Dashboard-HighPageLoadTime',
      alarmDescription: 'Page load time exceeds 3 seconds',
      metric: new cloudwatch.Metric({
        namespace,
        metricName: 'PageLoadTime',
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 3000, // 3 seconds in milliseconds
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    pageLoadTimeAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    
    // Time to Interactive alarm
    const ttiAlarm = new cloudwatch.Alarm(this, 'TimeToInteractiveAlarm', {
      alarmName: 'B3Dashboard-HighTimeToInteractive',
      alarmDescription: 'Time to interactive exceeds 5 seconds',
      metric: new cloudwatch.Metric({
        namespace,
        metricName: 'TimeToInteractive',
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5000, // 5 seconds in milliseconds
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    ttiAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
  }
  
  /**
   * Create error-related alarms
   */
  private createErrorAlarms(namespace: string, logGroupName: string): void {
    // Error rate alarm
    const errorRateAlarm = new cloudwatch.Alarm(this, 'ErrorRateAlarm', {
      alarmName: 'B3Dashboard-HighErrorRate',
      alarmDescription: 'Error rate exceeds 5%',
      metric: new cloudwatch.MathExpression({
        expression: '(errors / requests) * 100',
        usingMetrics: {
          errors: new cloudwatch.Metric({
            namespace,
            metricName: 'APIErrors',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
          requests: new cloudwatch.Metric({
            namespace,
            metricName: 'APIRequests',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        },
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5, // 5%
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    errorRateAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    
    // Critical errors alarm
    const criticalErrorsAlarm = new cloudwatch.Alarm(this, 'CriticalErrorsAlarm', {
      alarmName: 'B3Dashboard-CriticalErrors',
      alarmDescription: 'Critical errors detected in logs',
      metric: new cloudwatch.Metric({
        namespace,
        metricName: 'ErrorsLogged',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
        dimensionsMap: {
          ErrorType: 'CRITICAL',
        },
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    criticalErrorsAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
  }
  
  /**
   * Create business metric alarms
   */
  private createBusinessMetricAlarms(namespace: string): void {
    // No active users alarm
    const noActiveUsersAlarm = new cloudwatch.Alarm(this, 'NoActiveUsersAlarm', {
      alarmName: 'B3Dashboard-NoActiveUsers',
      alarmDescription: 'No active users in the last hour',
      metric: new cloudwatch.Metric({
        namespace,
        metricName: 'ActiveUsers',
        statistic: 'Sum',
        period: cdk.Duration.hours(1),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });
    noActiveUsersAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    
    // High API call volume alarm
    const highAPICallsAlarm = new cloudwatch.Alarm(this, 'HighAPICallsAlarm', {
      alarmName: 'B3Dashboard-HighAPICallVolume',
      alarmDescription: 'API call volume exceeds normal threshold',
      metric: new cloudwatch.Metric({
        namespace,
        metricName: 'APICallsTotal',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1000, // Adjust based on normal traffic
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    highAPICallsAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
  }
  
  /**
   * Create model performance alarms
   */
  private createModelPerformanceAlarms(namespace: string): void {
    // High MAPE alarm
    const highMAPEAlarm = new cloudwatch.Alarm(this, 'HighMAPEAlarm', {
      alarmName: 'B3Dashboard-HighModelMAPE',
      alarmDescription: 'Model MAPE exceeds 15%',
      metric: new cloudwatch.Metric({
        namespace,
        metricName: 'ModelMAPE',
        statistic: 'Average',
        period: cdk.Duration.days(1),
      }),
      threshold: 15,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    highMAPEAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    
    // Low directional accuracy alarm
    const lowAccuracyAlarm = new cloudwatch.Alarm(this, 'LowDirectionalAccuracyAlarm', {
      alarmName: 'B3Dashboard-LowDirectionalAccuracy',
      alarmDescription: 'Directional accuracy below 50%',
      metric: new cloudwatch.Metric({
        namespace,
        metricName: 'DirectionalAccuracy',
        statistic: 'Average',
        period: cdk.Duration.days(1),
      }),
      threshold: 50,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    lowAccuracyAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    
    // Low Sharpe Ratio alarm
    const lowSharpeAlarm = new cloudwatch.Alarm(this, 'LowSharpeRatioAlarm', {
      alarmName: 'B3Dashboard-LowSharpeRatio',
      alarmDescription: 'Sharpe Ratio below 0.5',
      metric: new cloudwatch.Metric({
        namespace,
        metricName: 'SharpeRatio',
        statistic: 'Average',
        period: cdk.Duration.days(1),
      }),
      threshold: 0.5,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    lowSharpeAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
  }
  
  /**
   * Create dashboard widgets
   * 
   * Implements Req 83.8: Create CloudWatch dashboards showing system health
   */
  private createDashboardWidgets(namespace: string): void {
    // Performance metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Performance',
        left: [
          new cloudwatch.Metric({
            namespace,
            metricName: 'APIResponseTime',
            statistic: 'Average',
            label: 'Avg Response Time',
          }),
          new cloudwatch.Metric({
            namespace,
            metricName: 'APIResponseTime',
            statistic: 'Maximum',
            label: 'Max Response Time',
          }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Frontend Performance',
        left: [
          new cloudwatch.Metric({
            namespace,
            metricName: 'PageLoadTime',
            statistic: 'Average',
            label: 'Page Load Time',
          }),
          new cloudwatch.Metric({
            namespace,
            metricName: 'TimeToInteractive',
            statistic: 'Average',
            label: 'Time to Interactive',
          }),
        ],
        width: 12,
      })
    );
    
    // Error metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Error Rate',
        left: [
          new cloudwatch.MathExpression({
            expression: '(errors / requests) * 100',
            usingMetrics: {
              errors: new cloudwatch.Metric({
                namespace,
                metricName: 'APIErrors',
                statistic: 'Sum',
              }),
              requests: new cloudwatch.Metric({
                namespace,
                metricName: 'APIRequests',
                statistic: 'Sum',
              }),
            },
            label: 'Error Rate (%)',
          }),
        ],
        width: 12,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Total Errors (24h)',
        metrics: [
          new cloudwatch.Metric({
            namespace,
            metricName: 'ErrorsTotal',
            statistic: 'Sum',
            period: cdk.Duration.days(1),
          }),
        ],
        width: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Active Users (1h)',
        metrics: [
          new cloudwatch.Metric({
            namespace,
            metricName: 'ActiveUsers',
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
          }),
        ],
        width: 6,
      })
    );
    
    // Business metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Business Metrics',
        left: [
          new cloudwatch.Metric({
            namespace,
            metricName: 'RecommendationsGenerated',
            statistic: 'Sum',
            label: 'Recommendations',
          }),
          new cloudwatch.Metric({
            namespace,
            metricName: 'PredictionsMade',
            statistic: 'Sum',
            label: 'Predictions',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace,
            metricName: 'APICallsTotal',
            statistic: 'Sum',
            label: 'API Calls',
          }),
        ],
        width: 24,
      })
    );
    
    // Model performance metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Model Performance',
        left: [
          new cloudwatch.Metric({
            namespace,
            metricName: 'ModelMAPE',
            statistic: 'Average',
            label: 'MAPE (%)',
          }),
          new cloudwatch.Metric({
            namespace,
            metricName: 'DirectionalAccuracy',
            statistic: 'Average',
            label: 'Directional Accuracy (%)',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace,
            metricName: 'SharpeRatio',
            statistic: 'Average',
            label: 'Sharpe Ratio',
          }),
        ],
        width: 24,
      })
    );
  }
}
