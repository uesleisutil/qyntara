/**
 * Infrastructure Optimization Stack
 * 
 * Implements:
 * - Requirement 81: Data Storage Optimization (S3 lifecycle policies)
 * - Requirement 74: Performance Loading Time (CloudFront CDN)
 * 
 * Features:
 * - S3 lifecycle policies for cost optimization
 * - CloudFront CDN for static asset delivery and API response caching
 * 
 * Note: ElastiCache Redis was removed because:
 * - Lambda functions are not in the VPC, so they can't reach Redis
 * - CloudFront already caches API responses (5 min TTL)
 * - React Query on the frontend caches data (30-60 min)
 * - The VPC + NAT + Redis cost (~$16/mo) exceeded all other infra combined (~$1/mo)
 * - If server-side caching is needed later, DynamoDB with TTL is a better fit
 */

import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";

export interface OptimizationStackProps extends cdk.StackProps {
  /**
   * Existing S3 bucket to apply lifecycle policies
   */
  bucket: s3.IBucket;
  
  /**
   * SNS topic for alerts
   */
  alertTopic?: sns.ITopic;
  
  /**
   * Origin for CloudFront distribution (S3 bucket or API Gateway)
   */
  origin?: cloudfront.IOrigin;
}

export class OptimizationStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  
  constructor(scope: Construct, id: string, props: OptimizationStackProps) {
    super(scope, id, props);
    
    // ========================================
    // Task 28.1: S3 Storage Optimization
    // ========================================
    
    this.configureS3LifecyclePolicies(props.bucket);
    
    // ========================================
    // Task 28.5: CloudFront CDN
    // ========================================
    
    if (props.origin) {
      this.distribution = this.createCloudFrontDistribution(props.origin);
    }
    
    // ========================================
    // Outputs
    // ========================================
    
    this.createOutputs();
  }

  /**
   * Configure S3 lifecycle policies for cost optimization
   */
  private configureS3LifecyclePolicies(bucket: s3.IBucket): void {
    // Lifecycle rules are configured on the bucket itself (infra-stack.ts)
    // This method creates CloudWatch metrics for storage monitoring
    
    const storageMetric = new cloudwatch.Metric({
      namespace: "AWS/S3",
      metricName: "BucketSizeBytes",
      dimensionsMap: {
        BucketName: bucket.bucketName,
        StorageType: "StandardStorage",
      },
      statistic: "Average",
      period: cdk.Duration.days(1),
    });
    
    new cdk.CfnOutput(this, "StorageMetricName", {
      value: storageMetric.metricName,
      description: "CloudWatch metric for S3 storage size",
    });
  }
  
  /**
   * Create CloudFront distribution for CDN
   * 
   * CloudFront handles both static asset caching (24h) and API response
   * caching (5 min), eliminating the need for a separate Redis layer.
   */
  private createCloudFrontDistribution(origin: cloudfront.IOrigin): cloudfront.Distribution {
    const staticCachePolicy = new cloudfront.CachePolicy(this, "StaticCachePolicy", {
      cachePolicyName: "B3Dashboard-StaticAssets",
      comment: "Cache policy for static assets (24 hours)",
      defaultTtl: cdk.Duration.hours(24),
      minTtl: cdk.Duration.hours(1),
      maxTtl: cdk.Duration.days(7),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    });
    
    const apiCachePolicy = new cloudfront.CachePolicy(this, "APICachePolicy", {
      cachePolicyName: "B3Dashboard-API",
      comment: "Cache policy for API responses (5 minutes)",
      defaultTtl: cdk.Duration.minutes(5),
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.hours(1),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList("Authorization", "X-Api-Key"),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    });
    
    const apiOriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, "APIOriginRequestPolicy", {
      originRequestPolicyName: "B3Dashboard-API-OriginRequest",
      comment: "Origin request policy for API",
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
        "Authorization",
        "X-Api-Key",
        "Accept",
        "Content-Type"
      ),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
    });
    
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: "B3 Dashboard CDN",
      defaultBehavior: {
        origin: origin,
        cachePolicy: staticCachePolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        compress: true,
      },
      additionalBehaviors: {
        "/api/*": {
          origin: origin,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: apiOriginRequestPolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          compress: true,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enableLogging: true,
      logIncludesCookies: false,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });
    
    return distribution;
  }
  
  /**
   * Create stack outputs
   */
  private createOutputs(): void {
    if (this.distribution) {
      new cdk.CfnOutput(this, "CloudFrontDomainName", {
        value: this.distribution.distributionDomainName,
        description: "CloudFront distribution domain name",
        exportName: "B3Dashboard-CloudFrontDomain",
      });
      
      new cdk.CfnOutput(this, "CloudFrontDistributionId", {
        value: this.distribution.distributionId,
        description: "CloudFront distribution ID",
        exportName: "B3Dashboard-CloudFrontDistributionId",
      });
    }
  }
}
