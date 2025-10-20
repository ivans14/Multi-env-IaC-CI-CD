import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { IamStack } from './iam-stack';

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
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		// app config
		this.appPort = 80;

		// tags data
		this.tagsData = { creator: 'ivan', project: 'iac-task' };

		// network config
		this.vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', {
			isDefault: true,
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
			`${this.tagsData.project}-EcrRepo`,
			{
				repositoryName: `${this.tagsData.creator}-EcrRepo`,
			}
		);
	}

	private createECS() {
		const cluster = new ecs.Cluster(
			this,
			`${this.tagsData.project}-EcsCluster`,
			{
				clusterName: `${this.tagsData.creator}-EcsCluster`,
			}
		);

		this.fargateService = new ecs.FargateService(this, 'service', {
			cluster: cluster,
			taskDefinition: this.taskDefinition,
		});
	}

	private createTaskDefinition() {
		this.taskDefinition = new ecs.FargateTaskDefinition(
			this,
			`${this.tagsData.project}-TaskDef`,
			{
				memoryLimitMiB: 512,
				cpu: 256,
				executionRole: this.roleStack.executionRole,
			}
		);
		this.taskDefinition.addContainer('container', {
			image: ecs.ContainerImage.fromEcrRepository(this.EcrRepo),
			portMappings: [{ containerPort: this.appPort }],
			logging: ecs.LogDrivers.awsLogs({
				streamPrefix: 'ivan-app',
				logGroup: this.logGroup,
			}),
		});
	}

	private createLoadBalancer() {
		this.loadBalancer = new elbv2.ApplicationLoadBalancer(
			this,
			`${this.tagsData.project}-alb`,
			{
				vpc: this.vpc,
				internetFacing: true,
				// securityGroup: this.loadBalancerSg,
			}
		);

		this.loadBalancer.addRedirect({
			sourceProtocol: elbv2.ApplicationProtocol.HTTP,
			sourcePort: 80,
			targetProtocol: elbv2.ApplicationProtocol.HTTPS,
			targetPort: 443,
		});

		const listener = this.loadBalancer.addListener('listener443', {
			port: 443,
			protocol: elbv2.ApplicationProtocol.HTTPS,
			defaultAction: elbv2.ListenerAction.fixedResponse(200, {}),
			sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
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
