# ─────────────────────────────────────────────────────────────────────
# ElastiCache Redis — shared cache, idempotency, rate limiting
# ─────────────────────────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.project}-redis-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "${local.project}-redis-subnet-group" }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${local.project}-redis"
  description          = "Redis cluster for order-platform"
  node_type            = "cache.t3.micro"
  num_cache_clusters   = 1 # single node for non-prod; bump to 2+ for HA
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = false # enable for production
  automatic_failover_enabled = false

  tags = { Name = "${local.project}-redis" }
}
