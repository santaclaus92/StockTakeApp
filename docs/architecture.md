# Refactored STA Architecture

## Overview

The refactored app follows a two-tier architecture:

1. React frontend (`apps/web`) handles UI rendering, validation, and user interactions.
2. Express backend (`apps/api`) handles business logic, data writes, and integration with Supabase.

Frontend never writes to Supabase directly. All write operations flow through backend API routes.

## Frontend Layer (`apps/web`)

- React + TypeScript + Vite
- React Router for view routing
- TanStack Query for server-state query/mutation
- Service layer (`src/services/*`) wraps API calls
- Hooks layer (`src/hooks/*`) exposes feature-level data operations to UI components

## Backend Layer (`apps/api`)

### Request flow

1. Request context middleware adds request ID.
2. Request logger writes structured JSON logs.
3. Auth middleware resolves role from JWT (or dev fallback).
4. Route-level validation (Zod) enforces payload contracts.
5. Controller delegates to service.
6. Service applies feature/business rules.
7. Repository performs data access (Supabase or memory mode).
8. Error middleware maps technical failures to API-safe responses.

### Modules

- `routes/*`: endpoint contracts by domain
- `controllers/*`: HTTP translation layer
- `services/*`: business orchestration
- `repositories/*`: data source implementation
- `middleware/*`: auth, validation, request tracing/logging, webhook hardening

## Data Access Strategy

- `SupabaseStaRepository`: production/local cloud-backed data source via service-role key
- `InMemoryStaRepository`: deterministic fallback for tests or isolated local dev

Service-role usage is backend-only. Supabase credentials are never exposed to web client runtime.

## Security and Hardening

- Backend-only writes
- Role guard middleware (`User`, `Admin`, `Super Admin`)
- Webhook shared secret guard
- Webhook rate limiting
- Webhook idempotency replay protection
- Request correlation IDs and structured request/error logging
- SQL migration for read-only client policies and index hardening

## Deployment Notes

- API must run with `DATA_SOURCE=supabase` for persistent behavior.
- If using memory mode, data is non-persistent and for test/sandbox use only.
