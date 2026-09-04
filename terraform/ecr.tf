# ─────────────────────────────────────────────────────────────────────
# ECR repositories — one per service
# ─────────────────────────────────────────────────────────────────────

resource "aws_ecr_repository" "services" {
  for_each = local.services

  name                 = "${local.project}-${each.key}"
  image_tag_mutability = "MUTABLE" # allows overwriting "latest"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = { Name = "${local.project}-${each.key}" }
}

# Lifecycle policy — keep last 30 images, expire untagged after 7 days
resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = local.services
  repository = aws_ecr_repository.services[each.key].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep last 30 tagged images"
        selection = {
          tagStatus   = "tagged"
          tagPrefixList = ["v"]
          countType   = "imageCountMoreThan"
          countNumber = 30
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
