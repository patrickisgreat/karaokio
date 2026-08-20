#!/usr/bin/env bash
#
# One-time bootstrap: the only deploy that runs with HUMAN credentials.
#
# CI cannot deploy the credential CI uses to deploy — this script creates that
# trust anchor (the GitHub OIDC deploy role), then everything else flows
# through the Infra / Deploy App / Party workflows with no stored AWS keys.
# After bootstrap, the same stack is re-deployed by infra/deploy.sh on every
# Infra run, so CI owns its lifecycle and drift self-heals.
#
# Usage:
#   AWS_PROFILE=<your-sso-profile> ./infra/bootstrap.sh
#
# Requires: aws CLI (logged in via `aws sso login` or keys), gh CLI (authed),
# and a checkout of cloudformation-toolkit (default: sibling directory).

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
TOOLKIT_DIR="${TOOLKIT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)/cloudformation-toolkit}"
REPO="patrickisgreat/karaokio"
BUDGET_LIMIT_USD="${BUDGET_LIMIT_USD:-15}"

[ -d "$TOOLKIT_DIR/templates" ] || {
  echo "error: cloudformation-toolkit not found at $TOOLKIT_DIR (set TOOLKIT_DIR)" >&2
  exit 1
}

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "──▶ bootstrapping into account $ACCOUNT_ID ($AWS_REGION)"

# 1. The trust anchor. PowerUserAccess + IAMFullAccess: PowerUser deliberately
#    excludes IAM, and the deploy role creates service/task roles. Both are
#    declared in the stack — never attached out-of-band.
aws cloudformation deploy \
  --region "$AWS_REGION" \
  --stack-name karaokio-github-oidc \
  --template-file "$TOOLKIT_DIR/templates/foundation/github-oidc-role/template.yaml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    NamePrefix=karaokio \
    GitHubOrg=patrickisgreat \
    GitHubRepo=karaokio \
    ManagedPolicyArn=arn:aws:iam::aws:policy/PowerUserAccess \
    ManagedPolicyArn2=arn:aws:iam::aws:policy/IAMFullAccess

ROLE_ARN=$(aws cloudformation describe-stacks --region "$AWS_REGION" \
  --stack-name karaokio-github-oidc \
  --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue" --output text)

# 2. Tell the workflows which role to assume
gh variable set AWS_DEPLOY_ROLE_ARN --body "$ROLE_ARN" -R "$REPO"
echo "──▶ AWS_DEPLOY_ROLE_ARN = $ROLE_ARN"

# 3. Billing guardrail — the design idles at ~\$3-5/mo, so an alert firing
#    means something is wrong. Tolerates already-existing budget on re-runs.
EMAIL=$(gh api user/emails --jq '.[] | select(.primary).email' 2>/dev/null || echo "")
if [ -n "$EMAIL" ]; then
  aws budgets create-budget --account-id "$ACCOUNT_ID" \
    --budget "{\"BudgetName\":\"karaokio-guardrail\",\"BudgetLimit\":{\"Amount\":\"$BUDGET_LIMIT_USD\",\"Unit\":\"USD\"},\"TimeUnit\":\"MONTHLY\",\"BudgetType\":\"COST\"}" \
    --notifications-with-subscribers "[
      {\"Notification\":{\"NotificationType\":\"ACTUAL\",\"ComparisonOperator\":\"GREATER_THAN\",\"Threshold\":50,\"ThresholdType\":\"PERCENTAGE\"},\"Subscribers\":[{\"SubscriptionType\":\"EMAIL\",\"Address\":\"$EMAIL\"}]},
      {\"Notification\":{\"NotificationType\":\"ACTUAL\",\"ComparisonOperator\":\"GREATER_THAN\",\"Threshold\":100,\"ThresholdType\":\"PERCENTAGE\"},\"Subscribers\":[{\"SubscriptionType\":\"EMAIL\",\"Address\":\"$EMAIL\"}]}
    ]" 2>/dev/null && echo "──▶ budget: alerts at 50% and 100% of \$$BUDGET_LIMIT_USD to $EMAIL" \
    || echo "──▶ budget already exists (or couldn't be created) — check Billing → Budgets"
else
  echo "──▶ skipped budget (no primary email via gh); create one in Billing → Budgets"
fi

echo ""
echo "✅ Bootstrap complete. From here everything runs through GitHub Actions:"
echo "   Actions → Infra → Deploy App → Party Up 🎤"
