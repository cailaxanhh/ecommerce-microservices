# How to Run the Services

Microservices monorepo (NestJS 12, ESM). Six services + shared infra (Postgres, Redis, Kafka).

## 1. Start infrastructure (Postgres + Redis + Kafka)

```bash
docker compose -f docker-compose.yml up -d
```

This starts Postgres (creates 6 databases via `db/init-multiple-dbs.sh`), Redis, Kafka/Zookeeper, creates the Kafka topics, plus optional pgAdmin at http://localhost:5050.

## 2. Prepare each service

From each service folder:

```bash
cd <service-folder>
cp .env.example .env     # then edit values if needed
npm install              # add --legacy-peer-deps if peer-dep errors occur
```

Shared defaults: `DB_USER=postgres DB_PASSWORD=postgres DB_HOST=localhost`, `INTERNAL_JWT_SECRET` must match `api-gateway/.env` for service-to-service auth.

> `order-service` has **no `.env.example`**. Create `.env` with:
>
> ```
> PORT=3003
> DB_HOST=localhost
> DB_PORT=5432
> DB_USER=order-platform-local
> DB_PASSWORD=postgres
> DB_NAME=order_service
> INTERNAL_JWT_SECRET=HYUIhU6iufn6o4dSZx0YOyJLWjV9QUnPQfacfnp4K5Y
> USER_SERVICE_URL=http://localhost:3001
> PRODUCT_SERVICE_URL=http://localhost:3002
> KAFKA_BROKERS=localhost:9092
> INVENTORY_TOPIC=inventory-events
> ORDER_TOPIC=order-events
> ```

## 3. Run the services

| Service                | Port | Depends on                     | Command (from that folder) |
| ---------------------- | ---- | ------------------------------ | -------------------------- |
| `user-service`         | 3001 | Postgres                       | `npm run start:dev`        |
| `product-service`      | 3002 | Postgres, Redis                | `npm run start:dev`        |
| `order-service`        | 3003 | Postgres, Kafka, user/product  | `npm run start:dev`        |
| `payment-service`      | 3004 | Postgres, Redis, Kafka         | `npm run start:dev`        |
| `notification-service` | 3006 | Postgres, Kafka                | `npm run start:dev`        |
| `api-gateway`          | 3000 | Redis, all downstream services | `npm run start:dev`        |

```bash
# example — start the API gateway
cd api-gateway
npm run start:dev
```

Suggested order: infra → user → product → order → payment → notification → gateway.

## 4. Useful commands

```bash
docker compose ps                    # infra status
npm run test                         # vitest unit tests
npm run test:e2e                     # e2e tests (vitest, needs infra running)
npm run build && npm run start:prod  # production
```

Health checks: each service exposes `GET /health`; gateway routes to downstream services via `USER_SERVICE_URL`, `PRODUCT_SERVICE_URL`, `ORDER_SERVICE_URL` in its `.env`.
