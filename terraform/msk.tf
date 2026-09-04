# ─────────────────────────────────────────────────────────────────────
# Amazon MSK — Kafka event backbone
# 3 brokers across 3 AZs, encrypted at rest + in transit
# ─────────────────────────────────────────────────────────────────────

resource "aws_msk_cluster" "main" {
  cluster_name           = "${local.project}-msk"
  kafka_version          = "3.6.0"
  number_of_broker_nodes = 3
  broker_node_group_info {
    instance_type   = "kafka.m5.large"
    client_subnets  = aws_subnet.private[*].id
    security_groups = [aws_security_group.msk.id]

    storage_info {
      ebs_storage_info {
        volume_size = 100 # GB per broker
      }
    }
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS" # enforce TLS for all client connections
      in_cluster    = true
    }
    encryption_at_rest_kms_key_arn = aws_kms_key.msk.arn
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.msk.name
      }
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.main.arn
    revision = aws_msk_configuration.main.latest_revision
  }

  tags = { Name = "${local.project}-msk" }
}

# MSK configuration — enforce topic-level settings
resource "aws_msk_configuration" "main" {
  name              = "${local.project}-msk-config"
  kafka_versions    = ["3.6.0"]

  server_properties = <<-PROPS
    auto.create.topics.enable=true
    default.replication.factor=3
    min.insync.replicas=2
    num.partitions=3
    delete.topic.enable=true
  PROPS
}

# KMS key for MSK encryption at rest
resource "aws_kms_key" "msk" {
  description             = "MSK encryption key for ${local.project}"
  deletion_window_in_days = 7

  tags = { Name = "${local.project}-msk-key" }
}

resource "aws_kms_alias" "msk" {
  name          = "alias/${local.project}-msk"
  target_key_id = aws_kms_key.msk.key_id
}

# CloudWatch log group for MSK broker logs
resource "aws_cloudwatch_log_group" "msk" {
  name              = "/aws/msk/${local.project}"
  retention_in_days = 30
}
