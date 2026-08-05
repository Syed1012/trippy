# System Architecture & Infrastructure Documentation

This document provides a comprehensive overview of the **Trippy** microservice architecture, infrastructure topology, asynchronous message flows, and OpenAPI documentation endpoints.

---

## 1. High-Level Architecture Overview

Trippy is an AI-powered collaborative travel planning platform built using a modern event-driven microservices architecture. The system consists of dynamic frontend applications, API gateways, core business services, AI generation engines, relational storage, and real-time asynchronous event processing.

### Architecture Diagrams

#### Component Diagram
![Trippy Component Diagram](../architecture/component-diagram.png)

#### Bounded Context Map
![Trippy Bounded Context Map](../architecture/bounded-context.png)

#### Domain Model
![Trippy Domain Model](../architecture/domain-model.png)

#### GORE Goal Model
![Trippy GORE Goal Model](../architecture/gore.png)

---

## 2. Microservice Inventory

| Service | Port | Primary Responsibilities | Tech Stack |
| :--- | :--- | :--- | :--- |
| **Frontend App** | `3000` | User Interface, Itinerary Builder, AI Analytics Dashboard, Push SW | Next.js 14 (React), Tailwind CSS |
| **API Gateway** | `8080` | Request routing, JWT validation, rate limiting | Spring Cloud Gateway |
| **User Service** | `8081` | User profiles, authentication handoff, preference settings | Spring Boot 3, PostgreSQL, Keycloak |
| **Trip Service** | `8082` | Trip CRUD, itinerary day management, participant management | Spring Boot 3, PostgreSQL, JPA |
| **Chat Service** | `8083` | Real-time group chat, WebSocket subscriptions | Spring Boot 3, WebSockets |
| **AI Service** | `8084` | AI itinerary generation, retry engine, chat assistant, preference consolidation | Spring Boot 3, Spring AI / Gemini API |
| **Notification Service** | `8085` | In-app notification center, Thymeleaf HTML emails, Web Push (VAPID) | Spring Boot 3, WebPush, Mailpit, RabbitMQ |
| **Payment Service** | `8086` | Subscriptions, billing status, quota tracking | Spring Boot 3, Stripe SDK |

---

## 3. Infrastructure & Docker Compose Topology

The development and production environment is containerized via **Docker Compose** located at [`infra/docker/docker-compose.yaml`](../infra/docker/docker-compose.yaml).

### Infrastructure Containers

```
                       ┌─────────────────────────┐
                       │     Next.js Frontend    │
                       │       (Port 3000)       │
                       └────────────┬────────────┘
                                    │
                                    ▼
                       ┌─────────────────────────┐
                       │    Spring Cloud Gateway │
                       │       (Port 8080)       │
                       └────────────┬────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│     AI Service     │   │Notification Service│   │    Trip Service    │
│    (Port 8084)     │   │    (Port 8085)     │   │    (Port 8082)     │
└──────────┬─────────┘   └──────────┬─────────┘   └──────────┬─────────┘
           │                        │                        │
           ▼                        ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Infrastructure Dependencies                       │
├─────────────────┬───────────────────┬────────────────┬───────────────┤
│ PostgreSQL DB   │ RabbitMQ Broker   │ Mailpit SMTP   │ Keycloak Auth │
│  (Port 5434)    │  (Port 5672/15672)│ (Port 1025/8025│ (Port 8180)   │
└─────────────────┴───────────────────┴────────────────┴───────────────┘
```

1. **PostgreSQL (`5434`)**: Relational storage for users, trips, itineraries, notifications, and AI generation history logs.
2. **RabbitMQ (`5672` / `15672`)**: AMQP message broker processing asynchronous events across 12 distinct event keys (`notification.email.send`, `trip.created`, `participant.invited`, etc.).
3. **Mailpit (`1025` / `8025`)**: Local SMTP server and visual web webmail inbox for verifying transactional Thymeleaf email dispatches.
4. **Keycloak (`8180`)**: OpenID Connect & OAuth2 identity provider handling user authentication and issuing JWT access tokens.
5. **OpenWeather & OSRM Integration**: External REST clients for multi-day weather forecasts and routing/distance metrics between itinerary stops.

---

## 4. Interactive OpenAPI & Swagger UI Documentation

All backend microservices feature auto-generated, interactive **SpringDoc OpenAPI 3.0** documentation and UI interfaces.

| Service | OpenAPI Spec URL | Interactive Swagger UI |
| :--- | :--- | :--- |
| **AI Service** | `http://localhost:8084/v3/api-docs` | `http://localhost:8084/swagger-ui.html` |
| **Notification Service** | `http://localhost:8085/v3/api-docs` | `http://localhost:8085/swagger-ui.html` |
| **Trip Service** | `http://localhost:8082/v3/api-docs` | `http://localhost:8082/swagger-ui.html` |
| **User Service** | `http://localhost:8081/v3/api-docs` | `http://localhost:8081/swagger-ui.html` |


### Static OpenAPI Contracts

For offline integration or API client generation (e.g. Postman, SDK generators), pre-compiled OpenAPI specs are committed in the repository under [`contracts/`](../contracts):
- [`aiServiceContract.yaml`](../contracts/aiServiceContract.yaml)
- [`notificationServiceContract.yaml`](../contracts/notificationServiceContract.yaml)
- [`tripServiceContract.yaml`](../contracts/tripServiceContract.yaml)
- [`userServiceContract.yaml`](../contracts/userServiceContract.yaml)
- [`paymentServiceContract.yaml`](../contracts/paymentServiceContract.yaml)
- [`chatServiceContract.yaml`](../contracts/chatServiceContract.yaml)
- [`apiGatewayContract.yaml`](../contracts/apiGatewayContract.yaml)

