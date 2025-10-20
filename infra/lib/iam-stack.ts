import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface IamStackProps {
	ecrRepositoryArn: string;
	logGroupArn: string;
}

export class IamStack extends Construct {
	public readonly executionRole: iam.Role;

	constructor(scope: Construct, id: string, props: IamStackProps) {
		super(scope, id);
		this.executionRole = this.createExecutionRole(props);
	}

	private createExecutionRole(props: IamStackProps): iam.Role {
		const role = new iam.Role(this, 'EcsExecutionRole', {
			assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
			description: 'ECS Execution Role',
			roleName: `ecs-execution-role-${cdk.Stack.of(this).stackName}`,
		});

		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['ecr:GetAuthorizationToken'],
				resources: ['*'],
			})
		);

		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'ecr:BatchCheckLayerAvailability',
					'ecr:GetDownloadUrlForLayer',
					'ecr:BatchGetImage',
				],
				resources: [props.ecrRepositoryArn],
			})
		);

		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
				resources: [props.logGroupArn],
			})
		);

		return role;
	}
}
