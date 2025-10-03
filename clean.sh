#!/bin/bash
# reset_k8s.sh
# Skrypt do usunięcia wszystkich zasobów w namespace "sprawdzsluch"

NAMESPACE="sprawdzsluch"

echo "Usuwanie Deploymentów..."
kubectl delete deployment --all -n $NAMESPACE

echo "Usuwanie ReplicaSetów..."
kubectl delete replicaset --all -n $NAMESPACE

echo "Usuwanie Podów..."
kubectl delete pod --all -n $NAMESPACE

echo "Usuwanie Service..."
kubectl delete service --all -n $NAMESPACE

echo "Usuwanie Ingress..."
kubectl delete ingress --all -n $NAMESPACE

echo "Usuwanie ConfigMap..."
kubectl delete configmap --all -n $NAMESPACE

echo "Usuwanie Secretów..."
kubectl delete secret --all -n $NAMESPACE

echo "Reset namespace $NAMESPACE zakończony!"
