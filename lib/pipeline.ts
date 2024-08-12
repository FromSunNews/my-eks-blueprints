// lib/pipeline.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import { TeamApplication, TeamPlatform } from '../teams';

export default class PipelineConstruct extends Construct {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id)

    const account = props?.env?.account!;
    const region = props?.env?.region!;

    const blueprint = blueprints.EksBlueprint.builder()
      .account(account)
      .region(region)
      .version("auto")
      .addOns(
        new blueprints.ClusterAutoScalerAddOn,
        new blueprints.KubeviousAddOn(), // New addon goes here
      ) // Cluster Autoscaler addon goes here
      .teams(new TeamPlatform(account), new TeamApplication('burnham', account));

    // HERE WE ADD THE ARGOCD APP OF APPS REPO INFORMATION
    const repoUrl = 'https://github.com/aws-samples/eks-blueprints-workloads.git';

    const bootstrapRepo: blueprints.ApplicationRepository = {
      repoUrl,
      targetRevision: 'workshop',
    }

    // HERE WE GENERATE THE ADDON CONFIGURATIONS
    const devBootstrapArgo = new blueprints.ArgoCDAddOn({
      bootstrapRepo: {
        ...bootstrapRepo,
        path: 'envs/dev'
      },
    });

    blueprints.CodePipelineStack.builder()
      .name("eks-blueprints-workshop-pipeline")
      .owner("FromSunNews")
      .repository({
        repoUrl: 'my-eks-blueprints',
        credentialsSecretName: 'eks-workshop-token',
        targetRevision: 'main'
      })
      // WE ADD THE STAGES IN WAVE FROM THE PREVIOUS CODE
      .wave({
        id: "envs",
        stages: [
          // HERE WE ADD OUR NEW ADDON WITH THE CONFIGURED ARGO CONFIGURATIONS
          { id: "dev", stackBuilder: blueprint.clone('ap-southeast-1').addOns(devBootstrapArgo) }
        ]
      })
      .build(scope, id + '-stack', props);
  }
}
