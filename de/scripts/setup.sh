#!/bin/bash

echo "Setting up OLAP Hotspot development environment..."

if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "Please update .env with your actual API keys and configuration"
fi

echo "Building Docker containers..."
docker compose build --no-cache

echo "Starting database services..."
docker compose up -d postgres-airflow clickhouse redis

echo "Waiting for services to be ready..."
sleep 10

echo "Initializing Airflow..."
docker compose run --rm airflow-init

echo "Starting Airflow services..."
docker compose up -d airflow-webserver airflow-scheduler
sleep 15

echo "Setup completed!"
echo ""
echo "===================="
echo "AIRFLOW LOGIN INFO:"
echo "URL: http://localhost:8080"
echo "Username: admin"
echo "Password: admin"
echo "===================="
echo ""
echo "Next steps:"
echo "1. Update .env with your NASA FIRMS API key"
echo "2. All services are running! Check status: docker-compose ps"
echo "3. Access Airflow UI: http://localhost:8080"
echo "4. Access ClickHouse: http://localhost:8123"