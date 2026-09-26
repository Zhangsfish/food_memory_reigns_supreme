# Public Interface Design Notes

This is deliberately not a giant “AI dump”.

## Read path

Use `/api/v1/search` to narrow candidates, then follow stable detail URLs.

The service should never require an AI to enumerate repository files or consume all historical records.

## Write path

Authenticated agents and the website use the same submission state machine.

An adapter must not bypass confirmation/publication rules.

## Contributor identity

Public:
- contributor UUID
- handle
- public profile declarations
- published experience history
- public feedback/revision surface

Private:
- email
- auth subject/provider secrets
- private screenshots/receipts
- private profile declarations

## Future adapters

Future MCP/A2A/email integration should translate protocol-specific calls into the HTTP/application operations defined in `contracts/openapi.yaml`.

Do not duplicate domain logic in adapters.
