#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLUSTER_NAME="sprawdzsluch-local"
NAMESPACE="sprawdzsluch"
BUILD_IMAGES="true"
RUN_SMOKE="true"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[ERROR] Missing command: $1"
    exit 1
  fi
}

for cmd in docker kubectl kind helm; do
  require_cmd "$cmd"
done

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build)
      BUILD_IMAGES="false"
      shift
      ;;
    --skip-smoke)
      RUN_SMOKE="false"
      shift
      ;;
    --help)
      echo "Usage: $0 [--skip-build] [--skip-smoke]"
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown argument: $1"
      exit 1
      ;;
  esac
done

echo "[INFO] Preparing kind cluster ${CLUSTER_NAME}"
if ! kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  cat >/tmp/sprawdzsluch-kind.yaml <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 80
        hostPort: 8080
        protocol: TCP
EOF
  kind create cluster --name "$CLUSTER_NAME" --config /tmp/sprawdzsluch-kind.yaml
fi

kubectl config use-context "kind-${CLUSTER_NAME}" >/dev/null

if ! kubectl get ns traefik >/dev/null 2>&1; then
  echo "[INFO] Installing Traefik"
  helm repo add traefik https://traefik.github.io/charts >/dev/null 2>&1 || true
  helm repo update >/dev/null
  helm upgrade --install traefik traefik/traefik \
    -n traefik \
    --create-namespace \
    --set providers.kubernetesCRD.enabled=true \
    --set providers.kubernetesIngress.enabled=true \
    --set service.type=NodePort \
    --set ports.web.port=80 \
    --set ports.web.nodePort=30080 >/dev/null
fi

kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=traefik -n traefik --timeout=180s >/dev/null

if [[ "$BUILD_IMAGES" == "true" ]]; then
  echo "[INFO] Building Docker images"
  docker build -t localhost:5000/frontend:latest "$ROOT_DIR/frontend"
  docker build -t localhost:5000/backend-pdf:latest "$ROOT_DIR/backend-pdf"
  docker build -t localhost:5000/backend-core:latest "$ROOT_DIR/backend-core"
  docker build -t localhost:5000/backend-payments:latest "$ROOT_DIR/backend-payments"
fi

echo "[INFO] Loading images into kind"
kind load docker-image \
  localhost:5000/frontend:latest \
  localhost:5000/backend-pdf:latest \
  localhost:5000/backend-core:latest \
  localhost:5000/backend-payments:latest \
  --name "$CLUSTER_NAME"

echo "[INFO] Applying manifests"
kubectl apply -f "$ROOT_DIR/k8s/namespace.yaml"
kubectl apply -f "$ROOT_DIR/k8s/mongodb/"
kubectl apply -f "$ROOT_DIR/k8s/kafka/kafka-service.yaml" \
              -f "$ROOT_DIR/k8s/kafka/kafka-statefulset.yaml" \
              -f "$ROOT_DIR/k8s/kafka/kafka-ui-service.yaml" \
              -f "$ROOT_DIR/k8s/kafka/kafka-ui-deployment.yaml"
kubectl apply -f "$ROOT_DIR/k8s/mongo-express/"
kubectl apply -f "$ROOT_DIR/k8s/frontend/"
kubectl apply -f "$ROOT_DIR/k8s/backend-core/"
kubectl apply -f "$ROOT_DIR/k8s/backend-payments/"
kubectl apply -f "$ROOT_DIR/k8s/backend-pdf/"
kubectl apply -f "$ROOT_DIR/k8s/ingress.yaml"

# StatefulSet volumeClaimTemplates are immutable. Recreate Kafka StatefulSet if spec changed.
if ! kubectl apply -f "$ROOT_DIR/k8s/kafka/kafka-statefulset.yaml" >/dev/null 2>&1; then
  echo "[INFO] Recreating kafka statefulset due to immutable spec change"
  kubectl delete statefulset kafka -n "$NAMESPACE" --ignore-not-found=true
  kubectl apply -f "$ROOT_DIR/k8s/kafka/kafka-statefulset.yaml"
fi

# Ensure Kafka PVC gets proper storage class in existing local clusters.
kubectl delete pvc kafka-data-kafka-0 -n "$NAMESPACE" --ignore-not-found=true

echo "[INFO] Waiting for rollouts"
kubectl rollout status deployment/frontend -n "$NAMESPACE" --timeout=300s
kubectl rollout status deployment/backend-core -n "$NAMESPACE" --timeout=300s
kubectl rollout status deployment/backend-payments -n "$NAMESPACE" --timeout=300s
kubectl rollout status deployment/backend-pdf -n "$NAMESPACE" --timeout=300s
kubectl rollout status statefulset/mongodb -n "$NAMESPACE" --timeout=300s
kubectl rollout status statefulset/kafka -n "$NAMESPACE" --timeout=300s

echo "[INFO] Pods summary"
kubectl get pods -n "$NAMESPACE"

if [[ "$RUN_SMOKE" == "true" ]]; then
  echo "[INFO] Running local smoke test"
  "$ROOT_DIR/scripts/local-smoke.sh"
fi

echo "[SUCCESS] Local environment is up"
