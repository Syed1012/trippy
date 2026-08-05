# Trippy - AI-Powered Trip Planning Platform

[![CI Build](https://github.com/Trippy-AI-Project/trippy/actions/workflows/ci.yaml/badge.svg)](https://github.com/Trippy-AI-Project/trippy/actions/workflows/ci.yaml)

## Overview

Trippy is a modern trip planning platform powered by AI, enabling users to create personalized itineraries, collaborate on group trips, and discover travel destinations.

## Architecture

This project follows a **Multi-Module Microservices Architecture** built with Spring Boot 3.4+ and Java 21.

### Services

| Service | Port | Description |
|---------|------|-------------|
| `api-gateway` | 8080 | API Gateway - Routes, JWT validation, Rate limiting |
| `user-service` | 8081 | User profiles, subscriptions, identity management |
| `trip-service` | 8082 | Trip CRUD, itineraries, participants, invitations |
| `chat-service` | 8083 | Real-time messaging, WebSocket, message persistence |
| `ai-service` | 8084 | Destination suggestions, itinerary generation |
| `notification-service` | 8085 | Email, push, in-app notifications |
| `payment-service` | 8086 | Payment processing, subscription billing |
| `frontend` | 3000 | Next.js web client (React, Tailwind CSS) |

### Communication

- **Synchronous**: REST APIs (HTTP/JSON)
- **Asynchronous**: RabbitMQ (Topic Exchange)
- **Real-time**: WebSocket (STOMP)

## Project Structure

```
trippy/
├── pom.xml                    # Parent POM (multi-module)
├── services/                  # Microservices
│   ├── api-gateway/
│   ├── user-service/
│   ├── trip-service/
│   ├── chat-service/
│   ├── ai-service/
│   ├── notification-service/
│   └── payment-service/
├── frontend/                  # Next.js web client
├── infra/
│   └── docker/                # Docker Compose (Postgres, Redis, RabbitMQ)
├── scripts/                   # Local dev launcher scripts
├── architecture/              # Draw.io diagrams (component, bounded context, domain model, GORE)
├── contracts/                 # API contracts (OpenAPI)
└── .github/workflows/         # CI/CD pipelines
```

## Tech Stack

- **Language**: Java 21
- **Framework**: Spring Boot 3.4.x, Spring Cloud 2024.x
- **Frontend**: Next.js 16 (React 19), Tailwind CSS
- **Database**: PostgreSQL (schema-per-service)
- **Message Broker**: RabbitMQ
- **Cache**: Redis
- **API Docs**: OpenAPI 3.0 (Springdoc)
- **Build Tool**: Maven
- **Containerization**: Docker (infra only: Postgres, Redis, RabbitMQ; services run natively)

## Getting Started

### Prerequisites

- Java 21+
- Maven 3.9+
- Docker & Docker Compose

### Build

```bash
# Build all modules
mvn clean install

# Build specific service
mvn clean install -pl services/user-service
```

### Run Locally

```bash
# One-shot local launcher: starts infra (Postgres, Redis, RabbitMQ),
# all backend services, and the frontend
./scripts/local-start-all.sh
```

Or start components individually:

```bash
# Start infrastructure (PostgreSQL, RabbitMQ, Redis)
docker-compose -f infra/docker/docker-compose.yaml up -d

# Run a specific service
cd services/user-service
mvn spring-boot:run

# Run the frontend
cd frontend
npm install
npm run dev
```

## Documentation

- [System Architecture & Topology Guide](./docs/Architecture.md) - Deep-dive architecture overview, component diagrams, and Docker topology
- [Architecture Diagrams](./architecture/) - Component diagram, bounded context map, domain model, and GORE goal model (Draw.io)
- [API Contracts](./contracts/) - Pre-compiled OpenAPI specifications (`.yaml`)
- **Interactive Swagger UI**:
  - AI Service: [http://localhost:8084/swagger-ui.html](http://localhost:8084/swagger-ui.html)
  - Notification Service: [http://localhost:8085/swagger-ui.html](http://localhost:8085/swagger-ui.html)
  - Trip Service: [http://localhost:8082/swagger-ui.html](http://localhost:8082/swagger-ui.html)
  - User Service: [http://localhost:8081/swagger-ui.html](http://localhost:8081/swagger-ui.html)

## License

Proprietary - All rights reserved


