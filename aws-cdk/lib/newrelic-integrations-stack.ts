import { Construct } from 'constructs';
import {
  Stack,
  StackProps,
  aws_iam as iam,
  aws_s3 as s3,
  RemovalPolicy,
  aws_kinesisfirehose as kinesisfirehose,
  aws_cloudwatch as cloudwatch,
  aws_ssm as ssm,
} from 'aws-cdk-lib';

export interface NewrelicIntegrationsStackProps extends StackProps {
  newRelicAccountId: string;
  envName: string;
}

export class NewrelicIntegrationsStack extends Stack {
  constructor(scope: Construct, id: string, props: NewrelicIntegrationsStackProps) {
    super(scope, id, props);

    const newrelicAwsRole = new iam.Role(this, 'NewRelicInfrastructureIntegrations', {
      // 754728514883 is the unique identifier for New Relic account on AWS, there is no need to change this
      assumedBy: new iam.AccountPrincipal('754728514883').withConditions({
        StringEquals: { 'sts:ExternalId': props.newRelicAccountId },
      }),
      description: 'used for new relic integration',
    });

    // CDKTFで使用するRole ARNをSystems Manager Parameter Storeに格納する
    new ssm.StringParameter(this, 'NewrelicAwsRoleArnParameter', {
      parameterName: `/${props.envName}/newrelic_integrations/newrelic_aws_role/arn`,
      stringValue: newrelicAwsRole.roleArn,
    });

    const newrelicAwsPermissions = new iam.Policy(this, 'NewRelicCloudStreamReadPermissions', {
      document: iam.PolicyDocument.fromJson({
        Version: '2012-10-17',
        Statement: [
          {
            Action: [
              'budgets:ViewBudget',
              'cloudtrail:LookupEvents',
              'config:BatchGetResourceConfig',
              'config:ListDiscoveredResources',
              'ec2:DescribeInternetGateways',
              'ec2:DescribeVpcs',
              'ec2:DescribeNatGateways',
              'ec2:DescribeVpcEndpoints',
              'ec2:DescribeSubnets',
              'ec2:DescribeNetworkAcls',
              'ec2:DescribeVpcAttribute',
              'ec2:DescribeRouteTables',
              'ec2:DescribeSecurityGroups',
              'ec2:DescribeVpcPeeringConnections',
              'ec2:DescribeNetworkInterfaces',
              'ec2:DescribeVpnConnections',
              'health:DescribeAffectedEntities',
              'health:DescribeEventDetails',
              'health:DescribeEvents',
              'tag:GetResources',
              'xray:BatchGet*',
              'xray:Get*',
            ],
            Effect: 'Allow',
            Resource: '*',
          },
        ],
      }),
    });

    newrelicAwsRole.attachInlinePolicy(newrelicAwsPermissions);

    const firehoseNewrelicRole = new iam.Role(this, 'FirehoseNewrelicRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
      description: 'For firehose used in new relic integration',
    });

    const newrelicAwsBucket = new s3.Bucket(this, 'NewrelicAwsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // CDKTFで作成したAPI KeyをSystems Manager Parameter Store経由で取得する
    const apiKeyForFirehose = ssm.StringParameter.valueForStringParameter(
      this,
      `/${props.envName}/cdktf/newrelic/api_key_for_firehose`,
    );

    const newrelicFirehoseStream = new kinesisfirehose.CfnDeliveryStream(this, 'NewrelicFirehoseStream', {
      deliveryStreamName: 'NewrelicFirehoseStream',
      httpEndpointDestinationConfiguration: {
        endpointConfiguration: {
          name: 'New Relic',
          url: 'https://aws-api.newrelic.com/cloudwatch-metrics/v1',
          accessKey: apiKeyForFirehose,
        },
        s3Configuration: {
          bucketArn: newrelicAwsBucket.bucketArn,
          roleArn: firehoseNewrelicRole.roleArn,
          bufferingHints: {
            intervalInSeconds: 400,
            sizeInMBs: 10,
          },
          compressionFormat: 'GZIP',
        },
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 1,
        },
        requestConfiguration: {
          contentEncoding: 'GZIP',
        },
        roleArn: firehoseNewrelicRole.roleArn,
        s3BackupMode: 'FailedDataOnly',
      },
    });

    const metricStreamToFirehoseRole = new iam.Role(this, 'MetricStreamToFirehoseRole', {
      assumedBy: new iam.ServicePrincipal('streams.metrics.cloudwatch.amazonaws.com'),
      description: 'For streaming to firehose used in new relic integration',
    });

    const metricStreamToFirehosePermissions = new iam.Policy(this, 'MetricStreamToFirehosePermissions', {
      document: iam.PolicyDocument.fromJson({
        Version: '2012-10-17',
        Statement: [
          {
            Action: ['firehose:PutRecord', 'firehose:PutRecordBatch'],
            Effect: 'Allow',
            Resource: newrelicFirehoseStream.attrArn,
          },
        ],
      }),
    });

    metricStreamToFirehoseRole.attachInlinePolicy(metricStreamToFirehosePermissions);

    new cloudwatch.CfnMetricStream(this, 'NewrelicMetricStream', {
      firehoseArn: newrelicFirehoseStream.attrArn,
      outputFormat: 'opentelemetry0.7',
      roleArn: metricStreamToFirehoseRole.roleArn,
    });
  }
}
