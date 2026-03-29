import * as cdk from 'aws-cdk-lib';
import { PrediktStack } from './stack';

const app = new cdk.App();

new PrediktStack(app, 'PrediktStack', {
  env: {
    account: '200093399689',
    region: 'us-east-1',
  },
});
