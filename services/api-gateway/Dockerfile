FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY services/api-gateway/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
