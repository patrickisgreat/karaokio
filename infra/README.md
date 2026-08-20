# Karaokio on AWS — the party box

One Fargate task in public subnets (no NAT, no ALB), an EFS volume for
everything stateful, and desired-count as the on/off switch. All templates come
from [cloudformation-toolkit](https://github.com/patrickisgreat/cloudformation-toolkit);
the one resource karaokio owns is the [ingress rule](templates/party-ingress.yaml).

## Cost model

| State          | What runs                                | Roughly                                                          |
| -------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| Idle (default) | nothing — 0 tasks                        | **$3–5/mo** (EFS + ECR storage, log retention)                   |
| Party          | 1 × Fargate **Spot** task, 4 vCPU / 8 GB | **~$0.07–0.10/hr** (~$0.23/hr if Spot capacity forces on-demand) |

No NAT gateways ($0 vs ~$32/mo each), no load balancer ($0 vs ~$16/mo): tasks
sit in public subnets with public IPs, and `party-up` tells you the URL.
Fargate Spot can reclaim the task with a 2-minute warning — an acceptable party
risk for a ~70% discount; the queue and processed songs survive on EFS.

## One-time bootstrap (needs your AWS credentials, once)

Everything after this step authenticates via GitHub OIDC — no long-lived keys.

```bash
brew install awscli && aws configure   # or use CloudShell in the AWS console

git clone https://github.com/patrickisgreat/cloudformation-toolkit
aws cloudformation deploy \
  --region us-east-1 \
  --stack-name karaokio-github-oidc \
  --template-file cloudformation-toolkit/templates/foundation/github-oidc-role/template.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    NamePrefix=karaokio \
    GitHubOrg=patrickisgreat \
    GitHubRepo=karaokio \
    ManagedPolicyArn=arn:aws:iam::aws:policy/PowerUserAccess

# Tell the workflows which role to assume:
ROLE_ARN=$(aws cloudformation describe-stacks --region us-east-1 \
  --stack-name karaokio-github-oidc \
  --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue" --output text)
gh variable set AWS_DEPLOY_ROLE_ARN --body "$ROLE_ARN" -R patrickisgreat/karaokio
```

`PowerUserAccess` + the role's built-in CloudFormation permissions is the
pragmatic single-owner-account choice; note the role also needs IAM
create/pass permissions for the service roles the stacks define — if a stack
deploy fails on IAM, attach `IAMFullAccess` too or scope a least-privilege
policy later. The trust policy restricts the role to `main`-branch workflows
of this one repo.

## Runbook

| Do                    | How                                                        |
| --------------------- | ---------------------------------------------------------- |
| Deploy / update infra | Actions → **Infra** → Run workflow                         |
| Ship the app image    | push to `main` (or Actions → **Deploy App**)               |
| Start a party         | Actions → **Party Up 🎤** — URL appears in the run summary |
| End a party           | Actions → **Party Down 🌙**                                |

First-time order: bootstrap above → **Infra** → **Deploy App** → **Party Up**.
The service is created with `DesiredCount=0`, so infra can deploy before any
image exists.

Two idle-state notes:

- The scalable target's floor is 0; `party-up` pins min=max=1 while the party
  runs so CPU target-tracking can never scale the box away mid-song, and
  `party-down` restores the floor.
- Infra re-deploys reset the task definition to the `:bootstrap` image tag —
  run **Deploy App** after any **Infra** run that touched the service stack.

## Security posture

- The app enforces **party-code auth** (see CLAUDE.md); the security group
  defaults to `0.0.0.0/0` on port 3000 on that basis. Pass `allowed-cidr` to
  the Infra workflow to pin it to your home IP for defense in depth.
- The EFS mount is TLS-only and IAM-authorized through an access point pinned
  to uid 1000 (the container's `node` user).
- The deploy role trusts only `main`-branch workflows of this repository.
