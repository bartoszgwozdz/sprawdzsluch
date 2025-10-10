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

# Sprawdź czy kubectl jest dostępne
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl nie jest zainstalowane lub nie jest dostępne w PATH"
    exit 1
fi

# Sprawdź czy docker jest dostępne
if ! command -v docker &> /dev/null; then
    print_error "docker nie jest zainstalowane lub nie jest dostępne w PATH"
    exit 1
fi

# Sprawdź czy jq jest dostępne (dla parsing JSON)
if ! command -v jq &> /dev/null; then
    print_warning "jq nie jest zainstalowane. Niektóre funkcje mogą być ograniczone."
fi

print_status "🚀 Rozpoczynanie deployment mikroserwisów SprawdźSłuch"

# Parametry
NAMESPACE="sprawdzsluch"
REGISTRY="localhost:5000"
BUILD_IMAGES=${BUILD_IMAGES:-true}
APPLY_K8S=${APPLY_K8S:-true}

# Sprawdź czy namespace istnieje
if ! kubectl get namespace $NAMESPACE &> /dev/null; then
    print_status "Tworzenie namespace: $NAMESPACE"
    kubectl create namespace $NAMESPACE
else
    print_success "Namespace $NAMESPACE już istnieje"
fi

# Funkcja do budowania obrazu Docker
build_docker_image() {
    local service_name=$1
    local service_path=$2
    local image_tag="$REGISTRY/$service_name:latest"
    
    print_status "🔨 Budowanie obrazu Docker dla $service_name"
    
    cd $service_path
    
    # Sprawdź czy Dockerfile istnieje
    if [ ! -f "Dockerfile" ]; then
        print_error "Dockerfile nie znaleziony w $service_path"
        return 1
    fi
    
    # Buduj obraz
    docker build -t $image_tag . || {
        print_error "Błąd podczas budowania obrazu $service_name"
        return 1
    }
    
    # Push do lokalnego registry (jeśli działa)
    if docker ps | grep -q "registry"; then
        print_status "Pushing $image_tag do lokalnego registry"
        docker push $image_tag || print_warning "Nie udało się push'ować do registry"
    else
        print_warning "Lokalny registry nie działa. Obraz zostanie wykorzystany lokalnie."
    fi
    
    print_success "Obraz $service_name zbudowany pomyślnie"
    cd - > /dev/null
}

# Funkcja do deployowania serwisu
deploy_service() {
    local service_name=$1
    local k8s_path=$2
    
    print_status "🚢 Deployowanie $service_name do Kubernetes"
    
    if [ ! -d "$k8s_path" ]; then
        print_error "Katalog k8s nie znaleziony: $k8s_path"
        return 1
    fi
    
    # Apply wszystkie pliki YAML w katalogu
    for yaml_file in $k8s_path/*.yaml; do
        if [ -f "$yaml_file" ]; then
            print_status "Applying $(basename $yaml_file)"
            kubectl apply -f "$yaml_file" || {
                print_error "Błąd podczas applying $yaml_file"
                return 1
            }
        fi
    done
    
    print_success "Serwis $service_name zdeployowany pomyślnie"
}

# Funkcja do sprawdzania statusu deploymentu
check_deployment_status() {
    local deployment_name=$1
    
    print_status "Sprawdzanie statusu deployment: $deployment_name"
    
    # Czekaj na gotowość
    kubectl rollout status deployment/$deployment_name -n $NAMESPACE --timeout=300s || {
        print_error "Deployment $deployment_name nie został ukończony w czasie"
        return 1
    }
    
    print_success "Deployment $deployment_name jest gotowy"
}

# Lista mikroserwisów do deployment
declare -a SERVICES=(
    "backend-core:../backend-core:./k8s/backend-core"
    "backend-payments:../backend-payments:./k8s/backend-payments" 
    "backend-pdf:../backend-pdf:./k8s/backend-pdf"
)

# Główna logika deployment
main() {
    print_status "=== DEPLOYMENT MIKROSERWISÓW SPRAWDZSLUCH ==="
    
    # Budowanie obrazów Docker
    if [ "$BUILD_IMAGES" = "true" ]; then
        print_status "📦 Faza 1: Budowanie obrazów Docker"
        
        for service_config in "${SERVICES[@]}"; do
            IFS=':' read -r service_name service_path k8s_path <<< "$service_config"
            build_docker_image "$service_name" "$service_path"
        done
        
        print_success "Wszystkie obrazy Docker zbudowane"
    else
        print_warning "Pomijanie budowania obrazów Docker (BUILD_IMAGES=false)"
    fi
    
    # Deployment do Kubernetes
    if [ "$APPLY_K8S" = "true" ]; then
        print_status "☸️  Faza 2: Deployment do Kubernetes"
        
        # Deploy infrastruktury (jeśli potrzebne)
        if [ -f "./k8s/namespace.yaml" ]; then
            kubectl apply -f ./k8s/namespace.yaml
        fi
        
        # Deploy serwisów
        for service_config in "${SERVICES[@]}"; do
            IFS=':' read -r service_name service_path k8s_path <<< "$service_config"
            deploy_service "$service_name" "$k8s_path"
        done
        
        print_success "Wszystkie serwisy zdeployowane"
        
        # Deploy dodatkowych zasobów
        print_status "🔧 Applying dodatkowe zasoby"
        
        if [ -f "./k8s/autoscaling.yaml" ]; then
            kubectl apply -f ./k8s/autoscaling.yaml
        fi
        
        if [ -f "./k8s/monitoring.yaml" ]; then
            kubectl apply -f ./k8s/monitoring.yaml
        fi
        
    else
        print_warning "Pomijanie deployment do Kubernetes (APPLY_K8S=false)"
    fi
    
    # Sprawdzenie statusu
    print_status "🔍 Faza 3: Sprawdzanie statusu deploymentów"
    
    for service_config in "${SERVICES[@]}"; do
        IFS=':' read -r service_name service_path k8s_path <<< "$service_config"
        check_deployment_status "$service_name"
    done
    
    # Wyświetlenie podsumowania
    print_status "📊 Podsumowanie deployment"
    kubectl get pods -n $NAMESPACE
    kubectl get services -n $NAMESPACE
    kubectl get hpa -n $NAMESPACE 2>/dev/null || print_warning "HPA nie skonfigurowane"
    
    print_success "🎉 Deployment zakończony pomyślnie!"
    print_status "Sprawdź logi: kubectl logs -f deployment/backend-core -n $NAMESPACE"
    print_status "Sprawdź status: kubectl get all -n $NAMESPACE"
}

# Obsługa argumentów linii poleceń
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-build)
            BUILD_IMAGES=false
            shift
            ;;
        --no-deploy)
            APPLY_K8S=false
            shift
            ;;
        --help)
            echo "Użycie: $0 [OPTIONS]"
            echo "Opcje:"
            echo "  --no-build    Pomiń budowanie obrazów Docker"
            echo "  --no-deploy   Pomiń deployment do Kubernetes"
            echo "  --help        Wyświetl tę pomoc"
            exit 0
            ;;
        *)
            print_error "Nieznana opcja: $1"
            exit 1
            ;;
    esac
done

# Uruchom główną funkcję
main