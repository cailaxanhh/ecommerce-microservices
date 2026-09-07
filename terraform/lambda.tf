# ─────────────────────────────────────────────────────────────────────
# Lambda functions — Kafka consumer sidecars
# Uses container-based Lambda for consistency with NestJS monorepo
# ─────────────────────────────────────────────────────────────────────

# ── ECR repo for Lambda container image ─────────────────────────────
resource "aws_ecr_repository" "lambda" {
  name                 = "${local.project}-lambda"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = { Name = "${local.project}-lambda" }
}

# ── Lambda execution role ──────────────────────────────────────────
resource "aws_iam_role" "lambda_execution" {
  name = "${local.project}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "lambda_execution" {
  name = "${local.project}-lambda-vpc"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:DescribeVpcs",
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.project}/*"
      },
      {
        Effect = "Allow"
        Action = ["kms:Decrypt"]
        Resource = "arn:aws:kms:${var.aws_region}:${data.aws_caller_identity.current.account_id}:alias/aws/ssm"
      }
    ]
  })
}

# ── Lambda functions ────────────────────────────────────────────────
# Container-based Lambda for NestJS monorepo consistency.
# Pre-build and push the Lambda image to ECR before terraform apply.
resource "aws_lambda_function" "consumers" {
  for_each = local.lambda_consumers

  function_name = "${local.project}-${each.key}"
  role          = aws_iam_role.lambda_execution.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.lambda.repository_url}:${var.ecr_image_tag}"
  timeout       = 300 # 5 minutes
  memory_size   = 512

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      NODE_ENV            = "production"
      SERVICE_NAME        = each.key
      DB_HOST             = aws_db_instance.main.address
      DB_PORT             = "5432"
      DB_USER             = "postgres"
      DB_PASSWORD         = var.db_password
      DB_NAME             = each.value.ecs_service == "order-service" ? "order_service" : each.value.ecs_service == "payment-service" ? "payment_service" : each.value.ecs_service == "inventory-service" ? "inventory_service" : "notification_service"
      REDIS_HOST          = aws_elasticache_replication_group.main.primary_endpoint_address
      REDIS_PORT          = "6379"
      KAFKA_BROKERS       = "${aws_instance.kafka.private_ip}:9092"
      KAFKA_CLIENT_ID     = each.key
      JWT_SECRET          = var.jwt_secret
      INTERNAL_JWT_SECRET = var.internal_jwt_secret
    }
  }

  tags = { Name = "${local.project}-${each.key}" }
}

# ── Kafka Consumer Trigger ──────────────────────────────────────────
# Self-hosted Kafka has no managed event source, so Lambdas are invoked
# on a schedule to poll for new events. Adjust the rate as needed.
resource "aws_cloudwatch_event_rule" "kafka_consumer" {
  for_each = local.lambda_consumers

  name                = "${local.project}-${each.key}-trigger"
  description         = "Schedule for ${each.key} Kafka consumer"
  schedule_expression = "rate(1 minute)"
}

resource "aws_cloudwatch_event_target" "kafka_consumer" {
  for_each = local.lambda_consumers

  rule      = aws_cloudwatch_event_rule.kafka_consumer[each.key].name
  target_id = each.key
  arn       = aws_lambda_function.consumers[each.key].arn
}

resource "aws_lambda_permission" "kafka_consumer" {
  for_each = local.lambda_consumers

  statement_id  = "AllowExecutionFromCloudWatch-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.consumers[each.key].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.kafka_consumer[each.key].arn
}

# ── CloudWatch Log Groups for Lambdas ───────────────────────────────
resource "aws_cloudwatch_log_group" "lambda" {
  for_each = local.lambda_consumers

  name              = "/aws/lambda/${local.project}-${each.key}"
  retention_in_days = 30
}
