#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra-stack';
import { IamStack } from '../lib/iam-stack';

const app = new cdk.App();
new InfraStack(app, 'InfraStack', {
	env: { region: process.env.AWS_REGION },
});
