FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY services/trip-service/target/*.jar app.jar
EXPOSE 8082
ENTRYPOINT ["java", "-jar", "app.jar"]
