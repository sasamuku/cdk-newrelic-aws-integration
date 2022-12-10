#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NewrelicIntegrationsStack } from '../lib/newrelic-integrations-stack';

const app = new cdk.App();
new NewrelicIntegrationsStack(app, 'NewrelicIntegrationsStack', {
  newRelicAccountId: '1234567',
  envName: 'sample',
});
