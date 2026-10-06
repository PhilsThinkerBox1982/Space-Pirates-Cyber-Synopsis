#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

AWS_DEFAULT_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-$(aws configure get region 2>/dev/null || true)}}"
if [[ -z "$AWS_DEFAULT_REGION" ]]; then
  echo "Set AWS_REGION or AWS_DEFAULT_REGION to the project's selected Region before deploying." >&2
  exit 1
fi

export AWS_DEFAULT_REGION
STACK_NAME="${STACK_NAME:-neon-corsair-site}"

aws sts get-caller-identity >/dev/null
sam build --template-file template.yaml
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name "$STACK_NAME" \
  --region "$AWS_DEFAULT_REGION" \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset

LEADERBOARD_API_URL="$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_DEFAULT_REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='LeaderboardApiUrl'].OutputValue | [0]" \
  --output text)"
BUCKET_NAME="$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_DEFAULT_REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='SiteBucketName'].OutputValue | [0]" \
  --output text)"
DISTRIBUTION_ID="$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_DEFAULT_REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue | [0]" \
  --output text)"
GAME_URL="$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_DEFAULT_REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='GameUrl'].OutputValue | [0]" \
  --output text)"

if [[ -z "$LEADERBOARD_API_URL" || "$LEADERBOARD_API_URL" == "None" ]]; then
  echo "CloudFormation did not return a leaderboard API URL." >&2
  exit 1
fi

npm run build
aws s3 sync dist/ "s3://${BUCKET_NAME}/" \
  --region "$AWS_DEFAULT_REGION" \
  --delete \
  --exclude index.html \
  --cache-control "public,max-age=31536000,immutable"
aws s3 cp dist/index.html "s3://${BUCKET_NAME}/index.html" \
  --region "$AWS_DEFAULT_REGION" \
  --cache-control "public,max-age=0,s-maxage=60,must-revalidate" \
  --content-type "text/html"
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" >/dev/null

printf '\nDeployment complete.\nGame URL: %s\nLeaderboard API: %s\n' "$GAME_URL" "$LEADERBOARD_API_URL"
