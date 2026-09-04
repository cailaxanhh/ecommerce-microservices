# ─────────────────────────────────────────────────────────────────────
# VPC & networking — 3 AZs, public + private subnets, NAT gateway
# ─────────────────────────────────────────────────────────────────────

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 3)
}

# ── VPC ─────────────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "${local.project}-vpc" }
}

# ── Internet Gateway ────────────────────────────────────────────────
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.project}-igw" }
}

# ── Public subnets (ALB lives here) ────────────────────────────────
resource "aws_subnet" "public" {
  count                   = 3
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${local.project}-public-${local.azs[count.index]}" }
}

# ── Private subnets (ECS tasks + Lambda + RDS + ElastiCache) ──────
resource "aws_subnet" "private" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = local.azs[count.index]

  tags = { Name = "${local.project}-private-${local.azs[count.index]}" }
}

# ── NAT Gateway (single, cost-effective for non-prod) ──────────────
resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "${local.project}-nat-eip" }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = { Name = "${local.project}-nat" }

  depends_on = [aws_internet_gateway.main]
}

# ── Route tables ────────────────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.project}-public-rt" }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  count          = 3
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.project}-private-rt" }
}

resource "aws_route" "private_nat" {
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main.id
}

resource "aws_route_table_association" "private" {
  count          = 3
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ── VPC Endpoints — keep traffic inside AWS where possible ──────────
# S3 gateway endpoint (free)
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = { Name = "${local.project}-s3-endpoint" }
}

# ECR Docker endpoint (interface) — needed by ECS tasks to pull images
resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = { Name = "${local.project}-ecr-dkr-endpoint" }
}

# ECR API endpoint (interface)
resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = { Name = "${local.project}-ecr-api-endpoint" }
}

# CloudWatch Logs endpoint (interface) — so ECS tasks can push logs
resource "aws_vpc_endpoint" "logs" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = { Name = "${local.project}-logs-endpoint" }
}

# ── Security Groups ─────────────────────────────────────────────────

# ALB security group — public inbound
resource "aws_security_group" "alb" {
  name        = "${local.project}-alb-sg"
  description = "ALB security group — HTTP/HTTPS inbound"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.project}-alb-sg" }
}

# ECS tasks security group — internal traffic + outbound
resource "aws_security_group" "ecs_tasks" {
  name        = "${local.project}-ecs-tasks-sg"
  description = "ECS Fargate tasks security group"
  vpc_id      = aws_vpc.main.id

  # Inbound from ALB
  ingress {
    description     = "From ALB"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Inbound from other ECS tasks (service-to-service)
  ingress {
    description = "Inter-service communication"
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    self        = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.project}-ecs-tasks-sg" }
}

# Lambda security group — same rules as ECS tasks
resource "aws_security_group" "lambda" {
  name        = "${local.project}-lambda-sg"
  description = "Lambda functions security group"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.project}-lambda-sg" }
}

# Allow Lambda → RDS
resource "aws_security_group_rule" "lambda_to_rds" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.lambda.id
  security_group_id        = aws_security_group.rds.id
  description              = "Lambda to RDS"
}

# Allow ECS tasks → RDS
resource "aws_security_group_rule" "ecs_to_rds" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
  security_group_id        = aws_security_group.rds.id
  description              = "ECS tasks to RDS"
}

# RDS security group
resource "aws_security_group" "rds" {
  name        = "${local.project}-rds-sg"
  description = "RDS security group"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.project}-rds-sg" }
}

# Redis security group
resource "aws_security_group" "redis" {
  name        = "${local.project}-redis-sg"
  description = "ElastiCache Redis security group"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.project}-redis-sg" }
}

# Allow ECS tasks → Redis
resource "aws_security_group_rule" "ecs_to_redis" {
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
  security_group_id        = aws_security_group.redis.id
  description              = "ECS tasks to Redis"
}

# Allow Lambda → Redis
resource "aws_security_group_rule" "lambda_to_redis" {
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.lambda.id
  security_group_id        = aws_security_group.redis.id
  description              = "Lambda to Redis"
}

# MSK security group
resource "aws_security_group" "msk" {
  name        = "${local.project}-msk-sg"
  description = "MSK cluster security group"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.project}-msk-sg" }
}

# Allow ECS tasks → MSK
resource "aws_security_group_rule" "ecs_to_msk" {
  type                     = "ingress"
  from_port                = 9092
  to_port                  = 9098
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
  security_group_id        = aws_security_group.msk.id
  description              = "ECS tasks to MSK"
}

# Allow Lambda → MSK
resource "aws_security_group_rule" "lambda_to_msk" {
  type                     = "ingress"
  from_port                = 9092
  to_port                  = 9098
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.lambda.id
  security_group_id        = aws_security_group.msk.id
  description              = "Lambda to MSK"
}

# VPC Endpoints security group
resource "aws_security_group" "vpc_endpoints" {
  name        = "${local.project}-vpc-endpoints-sg"
  description = "VPC endpoints security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = { Name = "${local.project}-vpc-endpoints-sg" }
}
