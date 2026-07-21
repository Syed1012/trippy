# Trip Service

## Overview
This service is the core domain service managing trips, itineraries, and participant collaboration for the Trippy platform.

## Responsibilities
- **Trip CRUD**: Create, read, update, delete trip entities
- **Itinerary Management**: AI-generated and manual itinerary handling
- **Participant Management**: Invitations, roles (OWNER, EDITOR, VIEWER), join requests
- **Group Trip Coordination**: Multi-user trip collaboration
- **Discovery Feed**: Public trip listings from verified hosts

## Domain Entities
- Trip
- Itinerary
- DayPlan
- Activity
- Participant
- Invitation

## Technology Stack
- Spring Boot
- Spring Data JPA
- PostgreSQL (schema: `trip_schema`)
- RabbitMQ (event publishing)

## Architecture Pattern
- Hexagonal Architecture (Ports & Adapters)

## Port
- Default: `8082`

## Events Published (RabbitMQ)
- `trip/invitation/created`
- `trip/participant/joined`

## Events Consumed (RabbitMQ)
- `payment/succeeded` (Confirm Booking)

## Related Contracts
- `TripServiceContract.yaml`
- `service_External_comms/AI-service.yaml` (consumer)
