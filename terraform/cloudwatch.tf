# ─────────────────────────────────────────────────────────────────────
# CloudWatch Log Groups — one per ECS service + Lambdas
# ─────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "ecs_services" {
  for_each = local.services

  name              = "/ecs/${local.project}/${each.key}"
  retention_in_days = 30

  tags = { Name = "${local.project}-${each.key}-logs" }
}

# MSK log group is defined in msk.tf
# Lambda log groups are defined in lambda.tf

# ── CloudWatch Alarms (basic) ───────────────────────────────────────

# High CPU alarm for ECS services
resource "aws_cloudwatch_metric_alarm" "ecs_cpu" {
  for_each = local.services

  alarm_name          = "${local.project}-${each.key}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "CPU utilization > 80% for ${each.key}"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = "${local.project}-${each.key}"
  }

  tags = { Name = "${local.project}-${each.key}-cpu-alarm" }
}

# High memory alarm for ECS services
resource "aws_cloudwatch_metric_alarm" "ecs_memory" {
  for_each = local.services

  alarm_name          = "${local.project}-${each.key}-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Memory utilization > 80% for ${each.key}"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = "${local.project}-${each.key}"
  }

  tags = { Name = "${local.project}-${each.key}-memory-alarm" }
}

# RDS high CPU alarm
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${local.project}-rds-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU > 80%"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = { Name = "${local.project}-rds-cpu-alarm" }
}
