import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { IamStack } from './iam-stack';

interface InfraStackProps extends cdk.StackProps {
	enviromnent: string;
}

interface EnvVars {
	ecsCpu: number;
	ecsMemory: number;
	taskCount: number;
}

export class InfraStack extends cdk.Stack {
	tagsData: { creator: string; project: string };
	taskDefinition: cdk.aws_ecs.FargateTaskDefinition;
	loadBalancer: cdk.aws_elasticloadbalancingv2.ApplicationLoadBalancer;
	vpc: cdk.aws_ec2.IVpc;
	appPort: number;
	fargateService: cdk.aws_ecs.FargateService;
	logGroup: any;
	EcrRepo: cdk.aws_ecr.Repository;
	roleStack: IamStack;
	env: string | undefined;
	envVars: EnvVars;
	constructor(scope: Construct, id: string, props: InfraStackProps) {
		super(scope, id, props);

		// app config
		this.env = props.enviromnent;
		this.envVars = this.node.tryGetContext(this.env);
		this.appPort = 80;

		// tags data
		this.tagsData = { creator: 'ivan', project: 'iac-task' };

		// network config
		this.vpc = new ec2.Vpc(this, 'VPC', {
			maxAzs: 2,
			natGateways: 0,
		});

		// create services
		this.createLogGroup();
		this.createECR();
		this.createIamRoles();
		this.createTaskDefinition();
		this.createECS();
		this.createLoadBalancer();

		// apply tags to entire stack
		this.applyTags();
	}

	private createECR() {
		this.EcrRepo = new ecr.Repository(
			this,
			`${this.tagsData.project}-${this.env}-EcrRepo`,
			{
				repositoryName: `${this.tagsData.creator}-${this.env}-ecr-repo`,
			}
		);
	}

	private createECS() {
		const cluster = new ecs.Cluster(
			this,
			`${this.tagsData.project}-${this.env}-EcsCluster`,
			{
				clusterName: `${this.tagsData.creator}-${this.env}-EcsCluster`,
			}
		);

		this.fargateService = new ecs.FargateService(
			this,
			`${this.tagsData.creator}-${this.env}-EcsService`,
			{
				cluster: cluster,
				taskDefinition: this.taskDefinition,
				desiredCount: this.envVars.taskCount,
				minHealthyPercent: 100,
				maxHealthyPercent: 200,
				healthCheckGracePeriod: cdk.Duration.seconds(60),
				circuitBreaker: {
					rollback: true,
				},
				deploymentController: {
					type: ecs.DeploymentControllerType.ECS,
				},
			}
		);
	}

	private createTaskDefinition() {
		this.taskDefinition = new ecs.FargateTaskDefinition(
			this,
			`${this.tagsData.project}-${this.env}-TaskDef`,
			{
				memoryLimitMiB: this.envVars.ecsMemory,
				cpu: this.envVars.ecsCpu,
				executionRole: this.roleStack.executionRole,
			}
		);
		this.taskDefinition.addContainer('container', {
			image: ecs.ContainerImage.fromAsset('../src'),
			portMappings: [{ containerPort: this.appPort }],
			// add our environment variables here (logging level or others)
			environment: {
				LOG_LEVEL: '10',
			},
			logging: ecs.LogDrivers.awsLogs({
				streamPrefix: `ivan-${this.env}-app`,
				logGroup: this.logGroup,
			}),
		});
	}

	private createLoadBalancer() {
		this.loadBalancer = new elbv2.ApplicationLoadBalancer(
			this,
			`${this.tagsData.project}-${this.env}-alb`,
			{
				vpc: this.vpc,
				internetFacing: true,
				// securityGroup: this.loadBalancerSg,
			}
		);

		const listener = this.loadBalancer.addListener('listener80', {
			port: 80,
			protocol: elbv2.ApplicationProtocol.HTTP,
		});

		listener.addTargets('Ecs-target', {
			port: this.appPort,
			targets: [this.fargateService],
			healthCheck: {
				path: '/health',
				interval: cdk.Duration.seconds(30),
			},
		});
	}

	private createLogGroup() {
		this.logGroup = new logs.LogGroup(this, 'MyAppLogGroup', {
			logGroupName: `/ecs/${this.tagsData.project}`,
			retention: logs.RetentionDays.ONE_WEEK,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		});
	}

	private createIamRoles() {
		this.roleStack = new IamStack(this, 'iam-stack', {
			ecrRepositoryArn: this.EcrRepo.repositoryArn,
			logGroupArn: this.logGroup.logGroupArn,
		});
	}

	private applyTags() {
		for (const [key, value] of Object.entries(this.tagsData)) {
			cdk.Tags.of(this).add(key, value);
		}
	}
}
