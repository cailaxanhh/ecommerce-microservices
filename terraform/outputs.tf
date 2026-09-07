# ─────────────────────────────────────────────────────────────────────
# Outputs
# ─────────────────────────────────────────────────────────────────────

output "alb_dns_name" {
  description = "DNS name of the public ALB"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the public ALB (for Route53 alias records)"
  value       = aws_lb.main.zone_id
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (host:port)"
  value       = aws_db_instance.main.endpoint
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "kafka_brokers" {
  description = "Self-hosted Kafka broker (plaintext, private VPC IP)"
  value       = "${aws_instance.kafka.private_ip}:9092"
  sensitive   = true
}

output "ecr_repository_urls" {
  description = "ECR repository URLs for each service"
  value       = { for k, v in aws_ecr_repository.services : k => v.repository_url }
}

output "ecr_lambda_repository_url" {
  description = "ECR repository URL for Lambda container images"
  value       = aws_ecr_repository.lambda.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "ecs_security_group_id" {
  description = "ECS tasks security group ID"
  value       = aws_security_group.ecs_tasks.id
}
