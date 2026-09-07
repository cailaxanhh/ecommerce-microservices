# ─────────────────────────────────────────────────────────────────────
# ECS Cluster & Fargate services — all 7 services
# ─────────────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = "${local.project}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "${local.project}-cluster" }
}

# ── Task Execution Role (ECR pull + CloudWatch + SSM read) ─────────
resource "aws_iam_role" "ecs_execution" {
  name = "${local.project}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow reading SSM parameters
resource "aws_iam_role_policy" "ecs_execution_ssm" {
  name = "${local.project}-ecs-execution-ssm"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssm:GetParameters",
        "ssm:GetParametersByPath",
        "kms:Decrypt"
      ]
      Resource = [
        "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.project}/*"
      ]
    }]
  })
}

# ── Task Role (SSM + X-Ray for ECS tasks) ───────────────────────────
resource "aws_iam_role" "ecs_task" {
  name = "${local.project}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task" {
  name = "${local.project}-ecs-task-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets"
        ]
        Resource = "*"
      }
    ]
  })
}

# ── ALB ─────────────────────────────────────────────────────────────
resource "aws_lb" "main" {
  name               = "${local.project}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = { Name = "${local.project}-alb" }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.services["api-gateway"].arn
  }
}

# ── Target Groups (one per service) ─────────────────────────────────
resource "aws_lb_target_group" "services" {
  for_each = local.services

  # AWS target group names max 32 chars; use short_name alias when provided.
  name        = substr("${local.project}-${lookup(each.value, "short_name", each.key)}", 0, 32)
  port        = each.value.port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = each.value.health_path
    port                = "traffic-port"
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = { Name = "${local.project}-${each.key}-tg" }
}

# ── ECS Task Definitions & Services ─────────────────────────────────
resource "aws_ecs_task_definition" "services" {
  for_each = local.services

  family                   = "${local.project}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = each.key
      image = "${aws_ecr_repository.services[each.key].repository_url}:${var.ecr_image_tag}"
      essential = true

      portMappings = [{
        containerPort = each.value.port
        hostPort      = each.value.port
        protocol      = "tcp"
      }]

      # Environment variables from SSM Parameter Store
      secrets = concat(
        # Common secrets
        [
          { name = "DB_PASSWORD",         valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.project}/DB_PASSWORD" },
          { name = "JWT_SECRET",          valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.project}/JWT_SECRET" },
          { name = "INTERNAL_JWT_SECRET", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.project}/INTERNAL_JWT_SECRET" },
        ],
        # DB vars (only for services with a database)
        each.value.has_db ? [
          { name = "DB_HOST", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.project}/DB_HOST" },
          { name = "DB_PORT", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.project}/DB_PORT" },
          { name = "DB_USER", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.project}/DB_USER" },
          { name = "DB_NAME", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.project}/${each.key}/DB_NAME" },
        ] : [],
        # Redis vars (only for services with Redis)
        each.value.has_redis ? [
          { name = "REDIS_HOST", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.project}/REDIS_HOST" },
          { name = "REDIS_PORT", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.project}/REDIS_PORT" },
        ] : [],
        # Kafka vars (all services for outbox publishing)
        [
          { name = "KAFKA_BROKERS",   valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.project}/KAFKA_BROKERS" },
          { name = "KAFKA_CLIENT_ID", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.project}/${each.key}/KAFKA_CLIENT_ID" },
        ]
      )

      # Static environment variables
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT",     value = tostring(each.value.port) },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_services[each.key].name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = each.key
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${each.value.port}${each.value.health_path} || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = { Name = "${local.project}-${each.key}-task" }
}

# ── ECS Services ────────────────────────────────────────────────────
resource "aws_ecs_service" "services" {
  for_each = local.services

  name            = "${local.project}-${each.key}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.services[each.key].arn
  desired_count   = each.value.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  # Attach to ALB target group for health checks and routing
  load_balancer {
    target_group_arn = aws_lb_target_group.services[each.key].arn
    container_name   = each.key
    container_port   = each.value.port
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds = 60

  depends_on = [aws_lb_listener.http]

  tags = { Name = "${local.project}-${each.key}-service" }
}
