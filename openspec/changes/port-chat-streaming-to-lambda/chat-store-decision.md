# ChatStore Decision — port-chat-streaming-to-lambda PR3

## Status

Accepted for PR3: **direct DynamoDB adapter using AWS SDK v3**, with table and index names supplied by environment variables.

## Context

The design preferred an AppSync/Amplify Data IAM adapter if it was feasible and maintainable. The user explicitly asked for the official-docs-first, simplest, modern, standard AWS best-practice approach.

Official/local evidence checked during the PR3 decision gate:

- Amplify Data is backed by AppSync GraphQL. Amplify client errors and docs refer to `generateClient({ authMode: "iam" })` for IAM-backed AppSync calls.
- The generated `amplify_outputs.json` for this app includes the GraphQL endpoint and lists `AWS_IAM` as an additional authorization type.
- The actual model auth rules in `amplify_outputs.json` for `Session` and `Message` remain owner rules with provider `userPools` only:
  - `allow: "owner"`
  - `provider: "userPools"`
  - `identityClaim: "cognito:username"`
- Local Amplify data-schema source shows owner authorization providers are `userPools`/`oidc`; resource/Lambda authorization exists in the schema DSL (`allow.resource(fn)`), but this chat streaming function is currently a raw CDK `NodejsFunction`, not an Amplify `defineFunction` resource wired into the data schema.
- A raw CDK Function URL Lambda can call AppSync with SigV4, but IAM signing alone does not satisfy the current owner-only user-pool model rules for `Session`/`Message` without changing the data authorization model.
- AWS official SDK v3 DynamoDB access from Lambda role credentials is straightforward, documented, and does not require static credentials.
- Generated DynamoDB table and GSI shape was inspected in the sandbox:
  - `Session-*` table primary key: `id`; user GSI: `gsi-User.sessions` on `userId`.
  - `Message-*` table primary key: `id`; session GSIs include `messagesBySessionId` and `gsi-Session.messages` on `sessionId`.

## Decision

Use a narrow direct DynamoDB `ChatStore` adapter for Lambda PR3.

The adapter is explicit about the operational coupling by requiring environment variables:

- `LAMBDA_CHAT_SESSION_TABLE_NAME`
- `LAMBDA_CHAT_MESSAGE_TABLE_NAME`
- `LAMBDA_CHAT_SESSION_USER_ID_INDEX_NAME`
- `LAMBDA_CHAT_MESSAGE_SESSION_ID_INDEX_NAME`

It uses AWS SDK v3 with the Lambda execution role/default credential chain. It does **not** require static AWS keys.

## Why not AppSync/IAM in PR3?

AppSync/IAM is attractive because it preserves the generated GraphQL API seam, but for this app it is not the simplest safe PR3 path:

1. Current data model authorization is owner/user-pool oriented, not Lambda-resource oriented.
2. Making AppSync IAM work cleanly would require changing Amplify Data authorization rules or reworking the function as an Amplify `defineFunction` data resource. That expands scope beyond a portable ChatStore adapter.
3. Direct DynamoDB keeps the PR3 implementation small and testable, and the coupling is contained behind the existing `ChatStore` interface.

## Consequences

Positive:

- Preserves the `ChatStore` interface and `createChatPostHandler` seam.
- Uses official AWS SDK v3 + Lambda role credentials.
- Avoids static credentials.
- Keeps unit tests local with mocked `send(...)` calls.
- Keeps AppSync authorization rules unchanged for existing Next/Amplify paths.

Tradeoffs:

- Coupled to generated Amplify table/index names via environment variables.
- Future schema/index changes must update Lambda env config.
- Bypasses AppSync model authorization; owner isolation must be preserved at the chat module and query/filter level. The adapter only lists by `userId`, and `createChatPostHandler` still enforces thread ownership.

## Revisit criteria

Revisit AppSync/IAM if:

- The chat streaming Lambda is converted to an Amplify `defineFunction` resource and data schema can use `allow.resource(chatFunction).to([...])` cleanly.
- Amplify documents a simple first-class Lambda server client path for Gen 2 Data that satisfies model auth without Next cookies.
- Operational preference shifts toward AppSync API governance over direct table access.

## Validation

PR3 adds contract-style unit tests for:

- create/read thread;
- append/read message ordering;
- user-isolated listing;
- delete thread + messages;
- regenerate-safe `replaceAssistantMessageAfter`;
- clone thread up to message id;
- configured DynamoDB index usage.
