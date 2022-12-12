import { Construct } from 'constructs';
import { Stack, StackProps, aws_s3 as s3, RemovalPolicy } from 'aws-cdk-lib';

export interface CdktfRemoteBackendStackProps extends StackProps {
  envName: string;
}

export class CdktfRemoteBackendStack extends Stack {
  constructor(scope: Construct, id: string, props: CdktfRemoteBackendStackProps) {
    super(scope, id, props);

    new s3.Bucket(this, 'CdktfRemoteBackend', {
      bucketName: `cdktf-remote-backend-${props.envName}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
