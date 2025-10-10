#!/bin/bash

set -e

# Kolory dla output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
FORCE_DELETE=${FORCE_DELETE:-false}
DELETE_NAMESPACE=${DELETE_NAMESPACE:-true}
DELETE_PVCS=${DELETE_PVCS:-false}

# Funkcja do usuwania zasobów
delete_resources() {
    local resource_type=$1
    local label_selector=$2
    
    print_status "Usuwanie $resource_type"
    
    if [ -n "$label_selector" ]; then
        kubectl delete $resource_type -l $label_selector -n $NAMESPACE --ignore-not-found=true
    else
        kubectl delete $resource_type --all -n $NAMESPACE --ignore-not-found=true
    fi
}

# Funkcja do wymuszenia usunięcia podów
force_delete_pods() {
    print_status "Wymuszanie usunięcia podów w namespace $NAMESPACE"
    
    local pods=$(kubectl get pods -n $NAMESPACE -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)
    
    for pod in $pods; do
        if [ -n "$pod" ]; then
            print_warning "Wymuszanie usunięcia pod: $pod"
            kubectl delete pod $pod -n $NAMESPACE --force --grace-period=0 2>/dev/null || true
        fi
    done
}

# Funkcja do sprawdzania i usuwania stuck resources
cleanup_stuck_resources() {
    print_status "Sprawdzanie stuck resources"
    
    # Znajdź pody w stanie Terminating
    local terminating_pods=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase=Terminating -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)
    
    if [ -n "$terminating_pods" ]; then
        print_warning "Znaleziono pody w stanie Terminating: $terminating_pods"
        
        for pod in $terminating_pods; do
            print_status "Usuwanie finalizers z pod: $pod"
            kubectl patch pod $pod -n $NAMESPACE -p '{"metadata":{"finalizers":null}}' 2>/dev/null || true
        done
    fi
    
    # Sprawdź namespace w stanie Terminating
    local ns_status=$(kubectl get namespace $NAMESPACE -o jsonpath='{.status.phase}' 2>/dev/null)
    if [ "$ns_status" = "Terminating" ]; then
        print_warning "Namespace $NAMESPACE jest w stanie Terminating"
        print_status "Próba usunięcia finalizers z namespace"
        kubectl get namespace $NAMESPACE -o json | jq '.spec.finalizers = []' | kubectl replace --raw "/api/v1/namespaces/$NAMESPACE/finalize" -f - 2>/dev/null || true
    fi
}

# Główna funkcja cleanup
main() {
    print_status "🧹 CLEANUP ŚRODOWISKA SPRAWDZSLUCH"
    
    # Sprawdź czy namespace istnieje
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        print_warning "Namespace $NAMESPACE nie istnieje"
        exit 0
    fi
    
    print_status "📋 Obecny stan zasobów w namespace $NAMESPACE:"
    kubectl get all -n $NAMESPACE 2>/dev/null || print_warning "Brak zasobów do wyświetlenia"
    
    echo ""
    
    # Potwierdzenie od użytkownika (jeśli nie wymuszony)
    if [ "$FORCE_DELETE" != "true" ]; then
        print_warning "⚠️  Ta operacja usunie WSZYSTKIE zasoby w namespace $NAMESPACE"
        read -p "Czy jesteś pewien? (tak/nie): " confirmation
        
        if [ "$confirmation" != "tak" ] && [ "$confirmation" != "yes" ] && [ "$confirmation" != "y" ]; then
            print_status "Anulowano cleanup"
            exit 0
        fi
    fi
    
    print_status "🗑️  Rozpoczynanie cleanup..."
    
    # 1. Usuń Ingress/IngressRoute (żeby zatrzymać ruch)
    print_status "Usuwanie Ingress i IngressRoute"
    kubectl delete ingressroute --all -n $NAMESPACE --ignore-not-found=true
    kubectl delete ingress --all -n $NAMESPACE --ignore-not-found=true
    
    # 2. Usuń HPA (żeby przestało tworzyć nowe pody)
    delete_resources "hpa" ""
    
    # 3. Usuń Services (żeby przestały routować ruch)
    delete_resources "service" ""
    
    # 4. Usuń Deployments i StatefulSets
    delete_resources "deployment" ""
    delete_resources "statefulset" ""
    
    # 5. Usuń Jobs i CronJobs
    delete_resources "job" ""
    delete_resources "cronjob" ""
    
    # 6. Czekaj na usunięcie podów
    print_status "Czekanie na usunięcie podów..."
    sleep 5
    
    # 7. Wymuszenie usunięcia podów jeśli nadal istnieją
    if [ "$FORCE_DELETE" = "true" ]; then
        force_delete_pods
    fi
    
    # 8. Usuń ConfigMaps i Secrets
    delete_resources "configmap" ""
    delete_resources "secret" ""
    
    # 9. Usuń NetworkPolicies
    delete_resources "networkpolicy" ""
    
    # 10. Usuń ServiceMonitor (Prometheus)
    delete_resources "servicemonitor" "" 2>/dev/null || true
    
    # 11. Usuń PVCs jeśli żądane
    if [ "$DELETE_PVCS" = "true" ]; then
        print_warning "Usuwanie Persistent Volume Claims (DANE ZOSTANĄ UTRACONE!)"
        delete_resources "pvc" ""
    fi
    
    # 12. Cleanup stuck resources
    cleanup_stuck_resources
    
    # 13. Usuń namespace jeśli żądane
    if [ "$DELETE_NAMESPACE" = "true" ]; then
        print_status "Usuwanie namespace $NAMESPACE"
        kubectl delete namespace $NAMESPACE --ignore-not-found=true
        
        # Czekaj na usunięcie namespace
        print_status "Czekanie na usunięcie namespace..."
        local timeout=60
        local counter=0
        
        while kubectl get namespace $NAMESPACE &> /dev/null && [ $counter -lt $timeout ]; do
            sleep 2
            counter=$((counter + 2))
            echo -n "."
        done
        echo ""
        
        if kubectl get namespace $NAMESPACE &> /dev/null; then
            print_warning "Namespace nadal istnieje. Próba wymuszonego usunięcia..."
            cleanup_stuck_resources
        fi
    fi
    
    # 14. Cleanup Docker images (opcjonalnie)
    if command -v docker &> /dev/null && [ "$FORCE_DELETE" = "true" ]; then
        print_status "Czyszczenie nieużywanych obrazów Docker"
        docker image prune -f 2>/dev/null || print_warning "Nie udało się wyczyścić obrazów Docker"
    fi
    
    print_success "🎉 Cleanup zakończony pomyślnie!"
    
    # Pokaż końcowy stan
    if kubectl get namespace $NAMESPACE &> /dev/null; then
        print_status "Pozostałe zasoby w namespace $NAMESPACE:"
        kubectl get all -n $NAMESPACE 2>/dev/null || print_success "Namespace jest pusty"
    else
        print_success "Namespace $NAMESPACE został usunięty"
    fi
}

# Funkcja pomocy
show_help() {
    echo "Użycie: $0 [OPTIONS]"
    echo "Opcje:"
    echo "  --force              Wymuś usunięcie bez potwierdzenia"
    echo "  --keep-namespace     Zachowaj namespace po cleanup"
    echo "  --delete-pvcs        Usuń także Persistent Volume Claims (UWAGA: dane zostaną utracone!)"
    echo "  --namespace NAME     Użyj innego namespace (domyślnie: sprawdzsluch)"
    echo "  --help               Wyświetl tę pomoc"
    echo ""
    echo "Przykłady:"
    echo "  $0                           # Interaktywny cleanup"
    echo "  $0 --force                   # Automatyczny cleanup"
    echo "  $0 --force --delete-pvcs     # Cleanup z usunięciem danych"
    echo "  $0 --keep-namespace          # Cleanup bez usuwania namespace"
    echo "  $0 --namespace test-env      # Cleanup w namespace test-env"
}

# Obsługa argumentów linii poleceń
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_DELETE=true
            shift
            ;;
        --keep-namespace)
            DELETE_NAMESPACE=false
            shift
            ;;
        --delete-pvcs)
            DELETE_PVCS=true
            shift
            ;;
        --namespace)
            NAMESPACE="$2"
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

# Sprawdź czy kubectl jest dostępne
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl nie jest zainstalowane lub nie jest dostępne w PATH"
    exit 1
fi

# Sprawdź czy jq jest dostępne (dla cleanup stuck resources)
if ! command -v jq &> /dev/null; then
    print_warning "jq nie jest zainstalowane. Niektóre funkcje cleanup mogą być ograniczone."
fi

# Uruchom główną funkcję
main