const assert = require("node:assert/strict");
const { after, beforeEach, test } = require("node:test");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

process.env.LEADERBOARD_TABLE = "NeonCorsairScores";

const originalSend = DynamoDBDocumentClient.prototype.send;
let sentCommands;
let sendResult;
let sendError;

DynamoDBDocumentClient.prototype.send = async function (command) {
  sentCommands.push(command);
  if (sendError) throw sendError;
  return sendResult;
};

const { handler } = require("./index");

beforeEach(() => {
  sentCommands = [];
  sendResult = {};
  sendError = null;
});

after(() => {
  DynamoDBDocumentClient.prototype.send = originalSend;
});

function apiEvent(method, body) {
  return {
    requestContext: { http: { method } },
    body,
  };
}

test("GET returns the top ten from the leaderboard index", async () => {
  sendResult = {
    Items: [
      { PlayerId: "a1234567-1234-4234-8234-123456789012", Score: 900, UpdatedAt: "2026-01-01T00:00:00.000Z" },
    ],
  };

  const response = await handler(apiEvent("GET"));

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body).entries, [
    {
      player: "Captain A123",
      score: 900,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  assert.equal(sentCommands.length, 1);
  assert.equal(sentCommands[0].input.Limit, 10);
  assert.equal(sentCommands[0].input.ScanIndexForward, false);
});

test("POST stores a score with a conditional best-score update", async () => {
  const playerId = "a1234567-1234-4234-8234-123456789012";
  const response = await handler(apiEvent("POST", JSON.stringify({ playerId, score: 1200 })));

  assert.equal(response.statusCode, 201);
  assert.deepEqual(JSON.parse(response.body), { accepted: true });
  assert.equal(sentCommands.length, 1);
  assert.equal(sentCommands[0].input.Item.PlayerId, playerId);
  assert.equal(sentCommands[0].input.Item.Score, 1200);
  assert.match(sentCommands[0].input.ConditionExpression, /attribute_not_exists/);
});

test("POST rejects invalid scores without writing", async () => {
  const response = await handler(
    apiEvent("POST", JSON.stringify({ playerId: "a1234567-1234-4234-8234-123456789012", score: 100001 })),
  );

  assert.equal(response.statusCode, 400);
  assert.equal(sentCommands.length, 0);
});

test("POST reports an existing equal or higher personal score", async () => {
  sendError = Object.assign(new Error("Condition failed"), {
    name: "ConditionalCheckFailedException",
  });
  const response = await handler(
    apiEvent("POST", JSON.stringify({
      playerId: "a1234567-1234-4234-8234-123456789012",
      score: 1200,
    })),
  );

  assert.equal(response.statusCode, 409);
});

test("malformed JSON returns a client error", async () => {
  const response = await handler(apiEvent("POST", "{"));

  assert.equal(response.statusCode, 400);
  assert.equal(sentCommands.length, 0);
});
