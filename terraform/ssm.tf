# ─────────────────────────────────────────────────────────────────────
# SSM Parameter Store — all secrets and config values
# ─────────────────────────────────────────────────────────────────────

# ── Database credentials ────────────────────────────────────────────
resource "aws_ssm_parameter" "db_password" {
  name        = "/${local.project}/DB_PASSWORD"
  description = "RDS master password"
  type        = "SecureString"
  value       = var.db_password

  tags = { Name = "${local.project}-db-password" }
}

resource "aws_ssm_parameter" "db_user" {
  name        = "/${local.project}/DB_USER"
  description = "RDS master username"
  type        = "String"
  value       = "postgres"

  tags = { Name = "${local.project}-db-user" }
}

resource "aws_ssm_parameter" "db_port" {
  name        = "/${local.project}/DB_PORT"
  description = "PostgreSQL port"
  type        = "String"
  value       = "5432"

  tags = { Name = "${local.project}-db-port" }
}

resource "aws_ssm_parameter" "rds_endpoint" {
  name        = "/${local.project}/DB_HOST"
  description = "RDS endpoint"
  type        = "String"
  value       = aws_db_instance.main.address

  tags = { Name = "${local.project}-rds-endpoint" }
}

# ── JWT secrets ─────────────────────────────────────────────────────
resource "aws_ssm_parameter" "jwt_secret" {
  name        = "/${local.project}/JWT_SECRET"
  description = "JWT signing secret"
  type        = "SecureString"
  value       = var.jwt_secret

  tags = { Name = "${local.project}-jwt-secret" }
}

resource "aws_ssm_parameter" "internal_jwt_secret" {
  name        = "/${local.project}/INTERNAL_JWT_SECRET"
  description = "Internal service-to-service JWT secret"
  type        = "SecureString"
  value       = var.internal_jwt_secret

  tags = { Name = "${local.project}-internal-jwt-secret" }
}

# ── Redis ───────────────────────────────────────────────────────────
resource "aws_ssm_parameter" "redis_endpoint" {
  name        = "/${local.project}/REDIS_HOST"
  description = "ElastiCache Redis primary endpoint"
  type        = "String"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address

  tags = { Name = "${local.project}-redis-endpoint" }
}

resource "aws_ssm_parameter" "redis_port" {
  name        = "/${local.project}/REDIS_PORT"
  description = "Redis port"
  type        = "String"
  value       = "6379"

  tags = { Name = "${local.project}-redis-port" }
}

# ── Kafka (self-hosted EC2) ────────────────────────────────────────
resource "aws_ssm_parameter" "kafka_brokers" {
  name        = "/${local.project}/KAFKA_BROKERS"
  description = "Self-hosted Kafka broker (plaintext, public IP)"
  type        = "String"
  value       = "${aws_instance.kafka.private_ip}:9092"

  tags = { Name = "${local.project}-kafka-brokers" }
}

# ── Per-service database names ──────────────────────────────────────
resource "aws_ssm_parameter" "service_db_names" {
  for_each = toset(local.db_names)

  name        = "/${local.project}/${each.value}/DB_NAME"
  description = "Database name for ${each.value}"
  type        = "String"
  value       = each.value

  tags = { Name = "${local.project}-${each.value}-db-name" }
}

# ── Per-service Kafka client IDs ────────────────────────────────────
# One parameter per ECS service for outbox publishing. Lambda consumers
# get their KAFKA_CLIENT_ID from Lambda env vars, not SSM.
resource "aws_ssm_parameter" "kafka_client_ids" {
  for_each = local.services

  name        = "/${local.project}/${each.key}/KAFKA_CLIENT_ID"
  description = "Kafka client ID for ${each.key}"
  type        = "String"
  value       = each.key

  tags = { Name = "${local.project}-${each.key}-kafka-client-id" }
}

# ── ECS service-specific env vars ───────────────────────────────────
resource "aws_ssm_parameter" "user_service_url" {
  name  = "/${local.project}/api-gateway/USER_SERVICE_URL"
  type  = "String"
  value = "http://${aws_lb_target_group.services["user-service"].name}:3001"
}

resource "aws_ssm_parameter" "product_service_url" {
  name  = "/${local.project}/api-gateway/PRODUCT_SERVICE_URL"
  type  = "String"
  value = "http://${aws_lb_target_group.services["product-service"].name}:3002"
}

resource "aws_ssm_parameter" "order_service_url" {
  name  = "/${local.project}/api-gateway/ORDER_SERVICE_URL"
  type  = "String"
  value = "http://${aws_lb_target_group.services["order-service"].name}:3003"
}

resource "aws_ssm_parameter" "order_user_service_url" {
  name  = "/${local.project}/order-service/USER_SERVICE_URL"
  type  = "String"
  value = "http://${aws_lb_target_group.services["user-service"].name}:3001"
}

resource "aws_ssm_parameter" "order_product_service_url" {
  name  = "/${local.project}/order-service/PRODUCT_SERVICE_URL"
  type  = "String"
  value = "http://${aws_lb_target_group.services["product-service"].name}:3002"
}

resource "aws_ssm_parameter" "inventory_product_service_url" {
  name  = "/${local.project}/inventory-service/PRODUCT_SERVICE_URL"
  type  = "String"
  value = "http://${aws_lb_target_group.services["product-service"].name}:3002"
}

resource "aws_ssm_parameter" "notification_dispatch_mode" {
  name  = "/${local.project}/notification-service/DISPATCH_MODE"
  type  = "String"
  value = "stub"
}
