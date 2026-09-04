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
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/${local.project}/*"
      },
      {
        Effect = "Allow"
        Action = ["kms:Decrypt"]
        Resource = aws_kms_key.msk.arn
      }
    ]
  })
}

# MSK event source permissions — allow Lambda to read from MSK topics
resource "aws_iam_role_policy" "lambda_msk" {
  name = "${local.project}-lambda-msk"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "kafka-cluster:Connect",
        "kafka-cluster:DescribeGroup",
        "kafka-cluster:DescribeTopic",
        "kafka-cluster:ReadData",
        "kafka-cluster:DescribeTopicDynamicConfiguration",
        "kafka-cluster:ReadTopicDynamicConfiguration"
      ]
      Resource = [
        aws_msk_cluster.main.arn,
        "${aws_msk_cluster.main.arn}/*"
      ]
    }]
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
      KAFKA_BROKERS       = aws_msk_cluster.main.bootstrap_brokers_tls
      KAFKA_CLIENT_ID     = each.key
      JWT_SECRET          = var.jwt_secret
      INTERNAL_JWT_SECRET = var.internal_jwt_secret
    }
  }

  tags = { Name = "${local.project}-${each.key}" }
}

# ── MSK Event Source Mappings ───────────────────────────────────────
# AWS-managed MSK event source — Lambda polls the MSK cluster directly.
# Requires the Lambda execution role to have MSK read permissions.
resource "aws_lambda_event_source_mapping" "msk" {
  for_each = local.lambda_consumers

  function_name     = aws_lambda_function.consumers[each.key].arn
  event_source_arn  = aws_msk_cluster.main.arn
  topics            = each.value.topics
  starting_position = "LATEST"
  batch_size        = 100

  function_response_types = ["ReportBatchItemFailures"]

  depends_on = [
    aws_lambda_function.consumers,
    aws_iam_role_policy.lambda_msk
  ]

  tags = { Name = "${local.project}-${each.key}-msk-mapping" }
}

# ── CloudWatch Log Groups for Lambdas ───────────────────────────────
resource "aws_cloudwatch_log_group" "lambda" {
  for_each = local.lambda_consumers

  name              = "/aws/lambda/${local.project}-${each.key}"
  retention_in_days = 30
}
