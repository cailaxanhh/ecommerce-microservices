terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }

  # Uncomment to use remote state
  # backend "s3" {
  #   bucket         = "order-platform-terraform-state"
  #   key            = "terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "terraform-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# ─────────────────────────────────────────────────────────────────────
# Local constants — single source of truth for service definitions.
# Each entry drives ECR, ECS, Lambda, SSM, and CloudWatch resources.
# ─────────────────────────────────────────────────────────────────────
locals {
  project = var.project_name

  common_tags = {
    Project     = local.project
    Environment = "production"
    ManagedBy   = "terraform"
  }

  # ── Service definitions ──────────────────────────────────────────
  # cpu / memory are Fargate task sizes (cpu in units, memory in MiB)
  services = {
    api-gateway = {
      port          = 3000
      cpu           = 256
      memory        = 512
      desired_count = 1
      health_path   = "/health"
      has_db        = false
      has_redis     = false
      has_lambda    = false
      is_public     = true # only service behind the internet-facing ALB
    }
    user-service = {
      port          = 3001
      cpu           = 256
      memory        = 512
      desired_count = 1
      health_path   = "/health"
      has_db        = true
      has_redis     = false
      has_lambda    = false
      is_public     = false
    }
    product-service = {
      port          = 3002
      cpu           = 256
      memory        = 512
      desired_count = 1
      health_path   = "/health"
      has_db        = true
      has_redis     = true
      has_lambda    = false
      is_public     = false
    }
    order-service = {
      port          = 3003
      cpu           = 256
      memory        = 512
      desired_count = 1
      health_path   = "/health"
      has_db        = true
      has_redis     = false
      has_lambda    = true
      is_public     = false
    }
    payment-service = {
      port          = 3004
      cpu           = 256
      memory        = 512
      desired_count = 1
      health_path   = "/health"
      has_db        = true
      has_redis     = true
      has_lambda    = true
      is_public     = false
    }
    inventory-service = {
      port          = 3005
      cpu           = 256
      memory        = 512
      desired_count = 1
      health_path   = "/health"
      has_db        = true
      has_redis     = false
      has_lambda    = true
      is_public     = false
    }
    notification-service = {
      port          = 3006
      cpu           = 256
      memory        = 512
      desired_count = 1
      health_path   = "/health"
      has_db        = true
      has_redis     = false
      has_lambda    = true
      is_public     = false
      short_name    = "noti-service" # target group name must stay <=32 chars
    }
  }

  # Database names — must match the init script order
  db_names = [
    "user_service",
    "product_service",
    "order_service",
    "payment_service",
    "inventory_service",
    "notification_service",
  ]

  # Lambda consumer definitions (subset of services that have Lambda sidecars)
  lambda_consumers = {
    order-consumer = {
      handler         = "dist/lambda/handler.handler"
      topics          = ["inventory-events"]
      consumer_group  = "order-service-inventory-consumer"
      ecs_service     = "order-service"
    }
    payment-consumer = {
      handler         = "dist/lambda/handler.handler"
      topics          = ["order-events", "payment-events"]
      consumer_group  = "payment-service-group"
      ecs_service     = "payment-service"
    }
    inventory-consumer = {
      handler         = "dist/lambda/handler.handler"
      topics          = ["order-events", "payment-events"]
      consumer_group  = "inventory-service-group"
      ecs_service     = "inventory-service"
    }
    notification-consumer = {
      handler         = "dist/lambda/handler.handler"
      topics          = ["order-events", "inventory-events"]
      consumer_group  = "notification-service"
      ecs_service     = "notification-service"
    }
  }
}
