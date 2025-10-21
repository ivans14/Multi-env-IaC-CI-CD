#!/usr/bin/env node
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra-stack';

// Load .env from infra directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log('Loaded credentials:', {
	region: process.env.AWS_REGION,
	account: process.env.AWS_ACCOUNT,
	hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
	hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
});

const app = new cdk.App();
const envName = app.node.tryGetContext('env') || 'dev';

new InfraStack(app, 'InfraStack', {
	env: {
		region: process.env.AWS_REGION,
		account: process.env.AWS_ACCOUNT,
	},
	enviromnent: envName,
});
