# SprawdźSłuch - Mikroarchitektura Kubernetes

Kompletny system audiometryczny oparty na mikroserwisach z deployment w Kubernetes.

## 🏗️ Architektura

### Mikroserwisy

1. **backend-core** (Java/Spring Boot)
   - Zarządzanie wynikami testów audiometrycznych
   - Autentykacja i autoryzacja
   - Integracja z MongoDB
   - Publikowanie eventów do Kafka

2. **backend-payments** (Java/Spring Boot)
   - Obsługa płatności i voucherów
   - Integracja z PayNow
   - Konsumowanie eventów z Kafka
   - Logika biznesowa płatności

3. **backend-pdf** (Node.js/Express)
   - Generowanie raportów PDF (Puppeteer)
   - Wysyłka emaili (Nodemailer)
   - Konsumowanie eventów Kafka
   - Template engine (Handlebars)

### Infrastruktura

- **MongoDB** - Baza danych dokumentowa
- **Kafka** - Message broker do komunikacji między serwisami
- **Traefik** - Ingress controller i load balancer
- **Prometheus** - Monitoring i metryki
- **Grafana** - Wizualizacja metryk

## 🚀 Quick Start

### Wymagania

- Kubernetes cluster (minikube, kind, GKE, EKS, AKS)
- kubectl
- Docker
- Helm (opcjonalnie)

### 1. Clone repository

```bash
git clone <repository-url>
cd sprawdzsluch
```

### 2. Deploy całego systemu

```bash
# Nadaj uprawnienia wykonywania
chmod +x scripts/deploy-microservices.sh

# Deploy wszystkich mikroserwisów
./scripts/deploy-microservices.sh
```

### 3. Sprawdź status deployment

```bash
# Nadaj uprawnienia wykonywania
chmod +x scripts/health-check.sh

# Sprawdź zdrowie systemu
./scripts/health-check.sh --logs
```

## 📋 Deployment Manual

### Krok po kroku

#### 1. Utwórz namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

#### 2. Deploy infrastruktury

```bash
# MongoDB
kubectl apply -f k8s/mongodb/

# Kafka
kubectl apply -f k8s/kafka/

# Traefik (jeśli nie jest zainstalowany)
kubectl apply -f k8s/traefik/
```

#### 3. Deploy mikroserwisów

```bash
# Backend Core
kubectl apply -f k8s/backend-core/

# Backend Payments
kubectl apply -f k8s/backend-payments/

# Backend PDF
kubectl apply -f k8s/backend-pdf/

# Frontend
kubectl apply -f k8s/frontend/
```

#### 4. Deploy Ingress i monitoring

```bash
# Ingress rules
kubectl apply -f k8s/ingress.yaml

# Monitoring
kubectl apply -f k8s/monitoring.yaml

# Autoscaling
kubectl apply -f k8s/autoscaling.yaml
```

## 🔧 Konfiguracja

### Environment Variables

Wszystkie zmienne środowiskowe są zarządzane przez ConfigMaps i Secrets:

- `backend-core-config` - Konfiguracja MongoDB, Kafka dla backend-core
- `backend-payments-config` - Konfiguracja PayNow, Kafka dla backend-payments
- `backend-pdf-config` - Konfiguracja SMTP, Puppeteer dla backend-pdf

### Secrets

- `mongodb-secret` - Kredencjały MongoDB
- `kafka-secret` - Kredencjały Kafka
- `smtp-secret` - Kredencjały SMTP
- `paynow-secret` - Klucze API PayNow

## 📊 Monitoring

### Prometheus Metrics

System eksportuje metryki dla:

- JVM (backend-core, backend-payments)
- Node.js (backend-pdf)
- MongoDB
- Kafka
- Kubernetes resources

### Grafana Dashboards

Dostępne dashboardy:

- **Overview** - Ogólny stan systemu
- **Java Microservices** - Metryki Spring Boot
- **MongoDB** - Stan bazy danych
- **Kafka** - Message broker metrics

### Alerty

Skonfigurowane alerty dla:

- High error rate (>5%)
- High response time (>2s)
- Pod restart loops
- Resource exhaustion

## 🔍 Health Checks

### Automatyczne sprawdzenie

```bash
./scripts/health-check.sh
```

### Ręczne sprawdzenie

```bash
# Status wszystkich podów
kubectl get pods -n sprawdzsluch

# Logi mikroserwisu
kubectl logs -f deployment/backend-core -n sprawdzsluch

# Health endpoints
kubectl port-forward service/backend-core 8080:8080 -n sprawdzsluch
curl http://localhost:8080/actuator/health
```

## 🌐 Dostęp do serwisów

### Lokalne środowisko

```bash
# Frontend
kubectl port-forward service/frontend 3000:80 -n sprawdzsluch
# http://localhost:3000

# Backend Core API
kubectl port-forward service/backend-core 8080:8080 -n sprawdzsluch
# http://localhost:8080/api/v1

# Backend Payments API
kubectl port-forward service/backend-payments 8081:8081 -n sprawdzsluch
# http://localhost:8081/api/v1

# Backend PDF API
kubectl port-forward service/backend-pdf 3001:3000 -n sprawdzsluch
# http://localhost:3001/api/v1
```

### Przez Ingress

Po skonfigurowaniu Ingress (localhost lub custom domain):

- Frontend: `http://localhost/`
- API: `http://localhost/api/v1/`

## 📈 Scaling

### Horizontal Pod Autoscaler

HPA jest skonfigurowany dla wszystkich mikroserwisów:

```bash
# Sprawdź status HPA
kubectl get hpa -n sprawdzsluch

# Szczegóły scaling
kubectl describe hpa backend-core -n sprawdzsluch
```

### Manual scaling

```bash
# Scale up backend-core
kubectl scale deployment backend-core --replicas=3 -n sprawdzsluch

# Scale down backend-pdf
kubectl scale deployment backend-pdf --replicas=1 -n sprawdzsluch
```

## 🐛 Troubleshooting

### Częste problemy

#### 1. Pod w stanie CrashLoopBackOff

```bash
# Sprawdź logi
kubectl logs pod-name -n sprawdzsluch --previous

# Sprawdź events
kubectl describe pod pod-name -n sprawdzsluch
```

#### 2. Problemy z połączeniem do MongoDB

```bash
# Sprawdź czy MongoDB pod działa
kubectl get pods -l app=mongodb -n sprawdzsluch

# Test połączenia
kubectl exec -it mongodb-pod -n sprawdzsluch -- mongosh
```

#### 3. Problemy z Kafka

```bash
# Sprawdź czy Kafka działa
kubectl get pods -l app=kafka -n sprawdzsluch

# Lista topików
kubectl exec kafka-pod -n sprawdzsluch -- kafka-topics.sh --list --bootstrap-server localhost:9092
```

#### 4. Ingress nie działa

```bash
# Sprawdź status Ingress
kubectl get ingress -n sprawdzsluch

# Sprawdź czy Traefik działa
kubectl get pods -n kube-system -l app=traefik
```

### Debug commands

```bash
# Complete system status
./scripts/health-check.sh --logs

# Resource usage
kubectl top pods -n sprawdzsluch

# Events
kubectl get events -n sprawdzsluch --sort-by=.metadata.creationTimestamp

# Network connectivity test
kubectl run test-pod --image=busybox -n sprawdzsluch --rm -it -- sh
```

## 🔐 Security

### Network Policies

System używa NetworkPolicies do ograniczenia komunikacji między podami:

- Mikroserwisy mogą komunikować się tylko z MongoDB i Kafka
- Frontend może komunikować się tylko z backend APIs
- Ingress Controller ma dostęp tylko do wymaganych serwisów

### Secrets Management

- Wszystkie sensitive data w Kubernetes Secrets
- Secrets są base64 encoded
- Automatyczne rotation secrets (gdy dostępne)

## 📚 API Documentation

### Backend Core API

- `GET /api/v1/test-results` - Lista wyników testów
- `POST /api/v1/test-results` - Dodaj nowy wynik
- `GET /api/v1/audiograms/{id}` - Pobierz audiogram
- `POST /api/v1/auth/login` - Logowanie

### Backend Payments API

- `POST /api/v1/payments` - Utwórz płatność
- `GET /api/v1/payments/{id}` - Status płatności
- `POST /api/v1/vouchers/validate` - Waliduj voucher

### Backend PDF API

- `POST /api/v1/pdf/generate` - Generuj PDF
- `POST /api/v1/email/send` - Wyślij email
- `GET /health` - Health check

## 🔄 CI/CD Integration

### GitLab CI

```yaml
deploy:
  stage: deploy
  script:
    - ./scripts/deploy-microservices.sh
  only:
    - main
```

### GitHub Actions

```yaml
- name: Deploy to Kubernetes
  run: ./scripts/deploy-microservices.sh
```

## 📝 Development

### Local development

```bash
# Start tylko infrastrukturę w k8s
kubectl apply -f k8s/mongodb/
kubectl apply -f k8s/kafka/

# Run mikroserwisy lokalnie
cd backend-core && mvn spring-boot:run
cd backend-payments && mvn spring-boot:run
cd backend-pdf && npm start
```

### Testing

```bash
# Unit tests
cd backend-core && mvn test
cd backend-payments && mvn test
cd backend-pdf && npm test

# Integration tests
./scripts/health-check.sh
```

## 📞 Support

W przypadku problemów:

1. Sprawdź logi: `./scripts/health-check.sh --logs`
2. Sprawdź dokumentację troubleshooting powyżej
3. Sprawdź GitHub issues
4. Utwórz nowy issue z logami i opisem problemu