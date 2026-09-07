# ─────────────────────────────────────────────────────────────────────
# Self-hosted Kafka on a single EC2 t2.micro (free-tier eligible)
# Replaces the removed Amazon MSK cluster to keep the platform free.
# ─────────────────────────────────────────────────────────────────────

# Kafka instance (private subnet — ECS tasks & Lambda reach it internally)
resource "aws_instance" "kafka" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "t2.micro"
  subnet_id              = aws_subnet.private[0].id
  vpc_security_group_ids = [aws_security_group.kafka.id]
  key_name               = var.key_name
  iam_instance_profile   = aws_iam_instance_profile.kafka.name

  user_data = <<-EOT
    #!/bin/bash
    set -eux
    yum update -y
    yum install -y java-11-amazon-corretto wget
    cd /opt
    wget https://downloads.apache.org/kafka/3.6.2/kafka_2.13-3.6.2.tgz
    tar -xzf kafka_2.13-3.6.2.tgz
    mv kafka_2.13-3.6.2 kafka

    PRIVATE_IP=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)

    # Write a clean, explicit KRaft single-node config
    cat > /opt/kafka/config/server.properties <<CONF
    process.roles=broker,controller
    node.id=1
    controller.quorum.voters=1@localhost:9093
    listeners=PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
    advertised.listeners=PLAINTEXT://$${PRIVATE_IP}:9092
    inter.broker.listener.name=PLAINTEXT
    controller.listener.names=CONTROLLER
    listener.security.protocol.map=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,SSL:SSL,SASL_PLAINTEXT:SASL_PLAINTEXT,SASL_SSL:SASL_SSL
    log.dirs=/opt/kafka/tmp/kraft-combined-logs
    num.partitions=3
    default.replication.factor=1
    offsets.topic.replication.factor=1
    transaction.state.log.replication.factor=1
    transaction.state.log.min.isr=1
    min.insync.replicas=1
    auto.create.topics.enable=true
    delete.topic.enable=true
    CONF

    CLUSTER_ID=$(/opt/kafka/bin/kafka-storage.sh random-uuid)
    /opt/kafka/bin/kafka-storage.sh format -t $CLUSTER_ID -c /opt/kafka/config/server.properties

    cat > /etc/systemd/system/kafka.service <<'EOF'
    [Unit]
    Description=Apache Kafka (KRaft)
    After=network.target

    [Service]
    Type=simple
    User=root
    WorkingDirectory=/opt/kafka
    ExecStart=/opt/kafka/bin/kafka-server-start.sh /opt/kafka/config/server.properties
    ExecStop=/opt/kafka/bin/kafka-server-stop.sh
    Restart=on-failure

    [Install]
    WantedBy=multi-user.target
    EOF

    systemctl daemon-reload
    systemctl enable kafka
    systemctl start kafka
  EOT

  tags = { Name = "${local.project}-kafka" }
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

# ── Kafka security group ────────────────────────────────────────────
resource "aws_security_group" "kafka" {
  name        = "${local.project}-kafka-sg"
  description = "Self-hosted Kafka security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Kafka from ECS tasks"
    from_port   = 9092
    to_port     = 9092
    protocol    = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  ingress {
    description = "Kafka from Lambda"
    from_port   = 9092
    to_port     = 9092
    protocol    = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.project}-kafka-sg" }
}

# ── IAM profile so the instance can read SSM (used by services) ────
resource "aws_iam_instance_profile" "kafka" {
  name = "${local.project}-kafka-profile"
  role = aws_iam_role.kafka.name
}

resource "aws_iam_role" "kafka" {
  name = "${local.project}-kafka-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "kafka_ssm" {
  role       = aws_iam_role.kafka.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
