#!/bin/bash

set -e

# Kolory dla output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funkcja do wyświetlania kolorowych wiadomości
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parametry
NAMESPACE="sprawdzsluch"
TIMEOUT=30

# Funkcja do sprawdzania endpointu HTTP z oczekiwanym kodem
check_health_endpoint() {
    local service_name=$1
    local port=$2
    local path=$3
    local expected_code=${4:-200}
    
    print_status "Sprawdzanie health endpoint dla $service_name"
    
    # Port forward do serwisu
    kubectl port-forward service/$service_name $port:$port -n $NAMESPACE &
    local port_forward_pid=$!
    
    # Czekaj chwilę na port forward
    sleep 2
    
    # Sprawdź endpoint
    local health_url="http://localhost:$port$path"
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" $health_url --max-time $TIMEOUT || echo "000")
    
    # Zabij port forward
    kill $port_forward_pid 2>/dev/null || true
    
    if [ "$response_code" = "$expected_code" ]; then
        print_success "$service_name endpoint odpowiada poprawnie ($expected_code)"
        return 0
    else
        print_error "$service_name endpoint nie odpowiada poprawnie (code: $response_code, expected: $expected_code)"
        return 1
    fi
}

# Funkcja do sprawdzania logów pod
check_pod_logs() {
    local deployment_name=$1
    local lines=${2:-50}
    
    print_status "Sprawdzanie logów dla $deployment_name (ostatnie $lines linii)"
    
    # Pobierz pod name
    local pod_name=$(kubectl get pods -n $NAMESPACE -l app=$deployment_name -o jsonpath="{.items[0].metadata.name}" 2>/dev/null)
    
    if [ -z "$pod_name" ]; then
        print_error "Nie znaleziono podów dla $deployment_name"
        return 1
    fi
    
    echo "=== Logi z $pod_name ==="
    kubectl logs $pod_name -n $NAMESPACE --tail=$lines || {
        print_error "Nie udało się pobrać logów z $pod_name"
        return 1
    }
    echo "=== Koniec logów ==="
}

# Funkcja do sprawdzania statusu zasobów
check_resource_status() {
    print_status "📊 Status zasobów w namespace $NAMESPACE"
    
    echo "=== PODS ==="
    kubectl get pods -n $NAMESPACE -o wide
    
    echo -e "\n=== SERVICES ==="
    kubectl get services -n $NAMESPACE
    
    echo -e "\n=== DEPLOYMENTS ==="
    kubectl get deployments -n $NAMESPACE
    
    echo -e "\n=== HPA ==="
    kubectl get hpa -n $NAMESPACE 2>/dev/null || print_warning "HPA nie skonfigurowane"
    
    echo -e "\n=== CONFIGMAPS ==="
    kubectl get configmaps -n $NAMESPACE
    
    echo -e "\n=== SECRETS ==="
    kubectl get secrets -n $NAMESPACE
}

# Funkcja do sprawdzania Kafka connectivity
check_kafka_connectivity() {
    print_status "🔌 Sprawdzanie połączenia z Kafka"
    
    # Sprawdź czy Kafka pod istnieje
    local kafka_pod=$(kubectl get pods -n $NAMESPACE -l app=kafka -o jsonpath="{.items[0].metadata.name}" 2>/dev/null)
    
    if [ -z "$kafka_pod" ]; then
        print_warning "Pod Kafka nie znaleziony w namespace $NAMESPACE"
        return 0
    fi

    # Sprawdź czy Kafka jest gotowa
    if kubectl exec $kafka_pod -n $NAMESPACE -- kafka-topics.sh --list --bootstrap-server localhost:9092 &>/dev/null; then
        print_success "Kafka jest dostępna i odpowiada"

        # Lista topików
        print_status "Lista topików Kafka:"
        kubectl exec $kafka_pod -n $NAMESPACE -- kafka-topics.sh --list --bootstrap-server localhost:9092
    else
        print_warning "Kafka nie odpowiada poprawnie"
        return 0
    fi
}

# Funkcja do sprawdzania MongoDB connectivity
check_mongodb_connectivity() {
    print_status "🍃 Sprawdzanie połączenia z MongoDB"
    
    # Sprawdź czy MongoDB pod istnieje
    local mongo_pod=$(kubectl get pods -n $NAMESPACE -l app=mongodb -o jsonpath="{.items[0].metadata.name}" 2>/dev/null)
    
    if [ -z "$mongo_pod" ]; then
        print_warning "Pod MongoDB nie znaleziony w namespace $NAMESPACE"
        return 1
    fi
    
    # Sprawdź połączenie z MongoDB
    kubectl exec $mongo_pod -n $NAMESPACE -- mongosh --eval "db.adminCommand('ping')" &>/dev/null
    
    if [ $? -eq 0 ]; then
        print_success "MongoDB jest dostępna i odpowiada"
    else
        print_error "MongoDB nie odpowiada poprawnie"
        return 1
    fi
}

# Funkcja do sprawdzania event'ów Kubernetes
check_kubernetes_events() {
    print_status "📋 Ostatnie eventy Kubernetes"
    
    kubectl get events -n $NAMESPACE --sort-by=.metadata.creationTimestamp | tail -20
}

# Funkcja do sprawdzania resource usage
check_resource_usage() {
    print_status "💾 Zużycie zasobów"
    
    # Sprawdź czy metrics-server jest dostępny
    if kubectl top nodes &>/dev/null; then
        echo "=== NODE RESOURCES ==="
        kubectl top nodes
        
        echo -e "\n=== POD RESOURCES ==="
        kubectl top pods -n $NAMESPACE --sort-by=cpu
    else
        print_warning "Metrics server nie jest dostępny. Nie można sprawdzić zużycia zasobów."
    fi
}

# Główna funkcja health check
main() {
    print_status "🏥 HEALTH CHECK MIKROSERWISÓW SPRAWDZSLUCH"
    
    # Sprawdź czy namespace istnieje
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        print_error "Namespace $NAMESPACE nie istnieje"
        exit 1
    fi
    
    # Basic resource status
    check_resource_status
    
    echo -e "\n"
    
    # Sprawdź infrastrukturę
    check_mongodb_connectivity
    check_kafka_connectivity
    
    echo -e "\n"
    
    # Sprawdź endpointy mikroserwisów
    declare -a HEALTH_CHECKS=(
        "backend-core:8090:/api/results/status/non-existent:404"
        "backend-payments-service:8082:/actuator/health:200"
        "backend-pdf-service:3001:/health:200"
    )
    
    print_status "🔍 Sprawdzanie endpointów usług"
    
    for health_config in "${HEALTH_CHECKS[@]}"; do
        IFS=':' read -r service_name port path expected_code <<< "$health_config"
        check_health_endpoint "$service_name" "$port" "$path" "$expected_code" || true
    done
    
    echo -e "\n"
    
    # Sprawdź eventy
    check_kubernetes_events
    
    echo -e "\n"
    
    # Sprawdź zużycie zasobów
    check_resource_usage
    
    echo -e "\n"
    
    # Opcjonalnie sprawdź logi (jeśli parametr --logs)
    if [[ "$*" == *"--logs"* ]]; then
        print_status "📝 Sprawdzanie logów mikroserwisów"
        
        for service in backend-core backend-payments backend-pdf; do
            echo -e "\n"
            check_pod_logs "$service" 20
        done
    fi
    
    print_success "🎯 Health check zakończony"
}

# Funkcja pomocy
show_help() {
    echo "Użycie: $0 [OPTIONS]"
    echo "Opcje:"
    echo "  --logs        Dołącz logi mikroserwisów do raportu"
    echo "  --namespace   Użyj innego namespace (domyślnie: sprawdzsluch)"
    echo "  --timeout     Timeout dla health checks (domyślnie: 30s)"
    echo "  --help        Wyświetl tę pomoc"
    echo ""
    echo "Przykłady:"
    echo "  $0                    # Basic health check"
    echo "  $0 --logs             # Health check z logami"
    echo "  $0 --namespace test   # Health check w namespace test"
}

# Obsługa argumentów linii poleceń
while [[ $# -gt 0 ]]; do
    case $1 in
        --logs)
            # Będzie obsłużone w main()
            shift
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Nieznana opcja: $1"
            show_help
            exit 1
            ;;
    esac
done

# Uruchom główną funkcję z wszystkimi argumentami
main "$@"