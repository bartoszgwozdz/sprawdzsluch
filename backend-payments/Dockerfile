# Dockerfile dla backend-payments mikroserwisu
FROM openjdk:17-jdk-slim

# Metadane
LABEL maintainer="sprawdzsluch"
LABEL description="Mikroserwis do obsługi płatności dla aplikacji sprawdzsluch"

# Tworzenie katalogu roboczego
WORKDIR /app

# Kopiowanie plików Maven
COPY pom.xml ./
COPY mvnw ./
COPY .mvn .mvn

# Nadanie uprawnień do wykonania
RUN chmod +x mvnw

# Pobieranie zależności (cache layer)
RUN ./mvnw dependency:resolve

# Kopiowanie kodu źródłowego
COPY src ./src

# Budowanie aplikacji
RUN ./mvnw clean package -DskipTests

# Port na którym działa aplikacja
EXPOSE 8082

# Uruchomienie aplikacji
CMD ["java", "-jar", "target/payments-service-0.0.1-SNAPSHOT.jar"]