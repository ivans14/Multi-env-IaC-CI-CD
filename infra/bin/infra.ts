#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra-stack';
import { IamStack } from '../lib/iam-stack';

const app = new cdk.App();
const envName = app.node.tryGetContext('env') || 'dev';
new InfraStack(app, 'InfraStack', {
	env: { region: process.env.AWS_REGION },
	enviromnent: envName,
});
