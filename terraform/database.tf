# ─────────────────────────────────────────────────────────────────────
# RDS PostgreSQL — single instance, multiple databases per service
# ─────────────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name       = "${local.project}-db-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "${local.project}-db-subnet-group" }
}

resource "aws_db_instance" "main" {
  identifier = "${local.project}-postgres"

  engine         = "postgres"
  engine_version = "15"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 2
  storage_encrypted     = true

  db_name  = var.db_name
  username = "postgres"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  skip_final_snapshot    = true
  multi_az               = false # set to true for production HA

  performance_insights_enabled = true

  tags = { Name = "${local.project}-postgres" }
}

# ── Create per-service databases ────────────────────────────────────
# The RDS instance only creates the master DB; we use null_resource
# to run CREATE DATABASE for each service's schema.
resource "null_resource" "create_databases" {
  for_each = toset(local.db_names)

  depends_on = [aws_db_instance.main]

  triggers = {
    always_run = timestamp()
  }

  provisioner "local-exec" {
    command = <<-EOT
      $ErrorActionPreference = "Stop"
      if (Get-Command psql -ErrorAction SilentlyContinue) {
        $env:PGPASSWORD = "${var.db_password}"
        psql -h ${aws_db_instance.main.address} -U postgres -d postgres -c "CREATE DATABASE ${each.value};"
      } else {
        Write-Host "psql not found. Please create database '${each.value}' manually on the RDS instance."
        Write-Host "Connection: ${aws_db_instance.main.address}:5432"
      }
    EOT
  }
}
