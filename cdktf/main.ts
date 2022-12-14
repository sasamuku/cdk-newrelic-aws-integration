// Copyright (c) HashiCorp, Inc
// SPDX-License-Identifier: MPL-2.0
import { Construct } from "constructs";
import { App, TerraformStack, S3Backend } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { DataAwsSsmParameter } from "@cdktf/provider-aws/lib/data-aws-ssm-parameter";
import { SsmParameter } from "@cdktf/provider-aws/lib/ssm-parameter";
import { NewrelicProvider } from "@cdktf/provider-newrelic/lib/provider";
import { ApiAccessKey } from "@cdktf/provider-newrelic/lib/api-access-key";
import { CloudAwsLinkAccount } from "@cdktf/provider-newrelic/lib/cloud-aws-link-account";

interface NewrelicStackConfig {
  envName: string;
  newrelicAccountId: number;
}

class NewrelicStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: NewrelicStackConfig) {
    super(scope, id);

    // remote backendにS3を利用する場合
    new S3Backend(this, {
      bucket: `cdktf-remote-backend-${config.envName}`,
      key: `${config.envName}/newrelic`,
      region: "ap-northeast-1"
    })

    new AwsProvider(this, "AWS", {
      region: "ap-northeast-1",
    });

    // 手動作成したUser API KeyをSystems Manager Parameter Store経由で取得する
    const apiKeyForProvider = new DataAwsSsmParameter(this, 'ApiKeyForProviderParameterData', {
      name: `/${config.envName}/cdktf/newrelic/api_key_for_provider`,
    });

    new NewrelicProvider(this, "New Relic", {
      accountId: config.newrelicAccountId,
      apiKey: apiKeyForProvider.value,
      region: "US",
    });

    // AWS(Amazon Kinesis Data Firehose)に渡すLICENSE Keyを生成
    const apiKeyForFirehose = new ApiAccessKey(this, "ApiKeyForFirehose", {
      name: "Ingest License key",
      notes: "For AWS Cloud Integrations (Used in Firehose)",
      accountId: config.newrelicAccountId,
      keyType: "INGEST",
      ingestType: "LICENSE",
    });

    // 作成したLICENSE KeyをSystems Manager Parameter Storeに格納する
    new SsmParameter(this, "ApiKeyForFirehoseParameter", {
      name: `/${config.envName}/cdktf/newrelic/api_key_for_firehose`,
      type: 'String',
      value: apiKeyForFirehose.key
    });

    // AWS CDKで作成したRoleのArnをSystems Manager Parameter Store経由で取得する
    const newrelicAwsRoleArnParameter = new DataAwsSsmParameter(this, 'NewrelicAwsRoleArnParameterData', {
      name: `/${config.envName}/newrelic_integrations/newrelic_aws_role/arn`,
    });

    new CloudAwsLinkAccount(this, "NewrelicCloudIntegrationPush", {
      name: "Sample Integration",
      metricCollectionMode: "PUSH",
      arn: newrelicAwsRoleArnParameter.value,
    })
  }
}

const app = new App();
new NewrelicStack(app, "newrelic-sample", {
  envName: 'sample',
  newrelicAccountId: 1234567,
});
app.synth();
