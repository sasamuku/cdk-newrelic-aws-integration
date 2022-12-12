#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdktfRemoteBackendStack } from '../lib/cdktf-remote-backend';
import { NewrelicIntegrationsStack } from '../lib/newrelic-integrations-stack';

const app = new cdk.App();

new CdktfRemoteBackendStack(app, 'CdktfRemoteBackend', {
  envName: 'sample',
});

new NewrelicIntegrationsStack(app, 'NewrelicIntegrationsStack', {
  newRelicAccountId: '1234567',
  envName: 'sample',
});
