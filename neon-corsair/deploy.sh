#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f dist/index.html ]]; then
  echo "Missing dist/index.html. Run npm run build before bundling this deployment." >&2
  exit 1
fi

export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-neon-corsair-site}"

aws sts get-caller-identity >/dev/null
aws cloudformation deploy \
  --template-file template.yaml \
  --stack-name "$STACK_NAME" \
  --region "$AWS_DEFAULT_REGION" \
  --no-fail-on-empty-changeset

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

printf '\nDeployment complete.\nGame URL: %s\n' "$GAME_URL"
