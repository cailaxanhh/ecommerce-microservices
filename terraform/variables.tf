# ─────────────────────────────────────────────────────────────────────
# General
# ─────────────────────────────────────────────────────────────────────
variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used as prefix for all resources"
  type        = string
  default     = "order-platform"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "ecr_image_tag" {
  description = "Docker image tag for all ECR images"
  type        = string
  default     = "latest"
}

variable "key_name" {
  description = "SSH key pair name for the Kafka EC2 instance (create one in EC2 first)"
  type        = string
}

# ─────────────────────────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────────────────────────
variable "db_name" {
  description = "PostgreSQL master database name"
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t2.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

# ─────────────────────────────────────────────────────────────────────
# Secrets
# ─────────────────────────────────────────────────────────────────────
variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "jwt_public_key" {
  description = "JWT public key for verification"
  type        = string
  sensitive   = true
  default     = ""
}

variable "internal_jwt_secret" {
  description = "Internal service-to-service JWT secret"
  type        = string
  sensitive   = true
}
