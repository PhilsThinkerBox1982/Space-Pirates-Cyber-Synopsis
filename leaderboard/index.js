const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.LEADERBOARD_TABLE;
const maxScore = 100_000;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

async function getLeaderboard() {
  const result = await client.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "ScoresByBoard",
      KeyConditionExpression: "BoardId = :boardId",
      ExpressionAttributeValues: {
        ":boardId": "GLOBAL",
      },
      ProjectionExpression: "PlayerId, #score, UpdatedAt",
      ExpressionAttributeNames: {
        "#score": "Score",
      },
      ScanIndexForward: false,
      Limit: 10,
    }),
  );

  const entries = (result.Items || []).map((item) => ({
    player: `Captain ${item.PlayerId.slice(0, 4).toUpperCase()}`,
    score: item.Score,
    updatedAt: item.UpdatedAt,
  }));

  return jsonResponse(200, { entries });
}

async function submitScore(event) {
  if (typeof event.body !== "string" || event.body.length > 1024) {
    return jsonResponse(400, { error: "Invalid score submission." });
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return jsonResponse(400, { error: "Request body must be valid JSON." });
  }

  const { playerId, score } = body;
  if (
    typeof playerId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(playerId) ||
    !Number.isSafeInteger(score) ||
    score <= 0 ||
    score > maxScore
  ) {
    return jsonResponse(400, { error: "Player ID or score is invalid." });
  }

  const updatedAt = new Date().toISOString();
  try {
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PlayerId: playerId,
          BoardId: "GLOBAL",
          ScoreKey: `${String(score).padStart(8, "0")}#${playerId}`,
          Score: score,
          UpdatedAt: updatedAt,
        },
        ConditionExpression: "attribute_not_exists(PlayerId) OR #score < :score",
        ExpressionAttributeNames: {
          "#score": "Score",
        },
        ExpressionAttributeValues: {
          ":score": score,
        },
      }),
    );
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      return jsonResponse(409, { error: "This browser already has an equal or higher score." });
    }
    throw error;
  }

  return jsonResponse(201, { accepted: true });
}

exports.handler = async (event) => {
  try {
    const method = event.requestContext?.http?.method;
    if (method === "GET") return await getLeaderboard();
    if (method === "POST") return await submitScore(event);
    return jsonResponse(404, { error: "Route not found." });
  } catch (error) {
    console.error("Leaderboard request failed.", error);
    return jsonResponse(500, { error: "Leaderboard is temporarily unavailable." });
  }
};
