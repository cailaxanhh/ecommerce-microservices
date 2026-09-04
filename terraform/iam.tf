# ─────────────────────────────────────────────────────────────────────
# IAM Roles & Policies — centralized for clarity
# ─────────────────────────────────────────────────────────────────────

# Note: Most IAM roles are defined in the files that use them
# (ecs.tf for ECS roles, lambda.tf for Lambda roles).
# This file consolidates any additional cross-cutting policies.

# ── ALB access log bucket (optional, for access logging) ────────────
resource "aws_s3_bucket" "alb_logs" {
  bucket = "${local.project}-alb-access-logs-${data.aws_caller_identity.current.account_id}"

  tags = { Name = "${local.project}-alb-logs" }
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        AWS = "arn:aws:iam::${data.aws_elb_service_account.main.arn}"
      }
      Action   = "s3:PutObject"
      Resource = "${aws_s3_bucket.alb_logs.arn}/*"
    }]
  })
}

data "aws_caller_identity" "current" {}
data "aws_elb_service_account" "main" {}
