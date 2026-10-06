# Shared leaderboard

The leaderboard is a public API backed by one on-demand DynamoDB table. It keeps
one highest score per browser ID and returns the global top ten. Scores are
sorted through the `ScoresByBoard` index; index reads are eventually consistent.
The table is retained when the CloudFormation stack is deleted.

## Deploy

Install the AWS SAM CLI and AWS CLI, sign in with credentials allowed to deploy
the stack, and confirm the project's selected Region in AWS Settings > View all
projects > Overview > Additional Info > Region. Then run:

```sh
./deploy.sh
```

The script uses `AWS_REGION`, `AWS_DEFAULT_REGION`, or the AWS CLI profile Region
in that order. It deploys the API and database, builds the game, uploads the
static assets, and invalidates CloudFront. The stack output `LeaderboardApiUrl`
is the API base URL.

Create a source deployment archive with `npm run bundle:aws`. It includes the
template, deployment script, built game, and Lambda source/manifests; `sam build`
resolves the Lambda dependencies when the archive is deployed.

## Codespaces preview or local development

The deployed CloudFront site routes `/api/leaderboard` to API Gateway. To use a
Codespaces preview or another development server, set the API base URL from the
stack output when starting Vite:

```sh
VITE_LEADERBOARD_API_URL=https://<api-id>.execute-api.<selected-region>.amazonaws.com npm run dev
```

That API is public and permits browser requests from any origin. It accepts
anonymous submissions with a generated browser ID, validates scores to the
range 1–100,000, limits each browser ID to increasing scores, throttles API
traffic, and caps Lambda concurrency. Because the game runs in the browser,
scores are not cheat-proof; do not use them for prizes or other trusted
decisions.

Run the backend request tests with:

```sh
cd leaderboard
npm test
```
