#!/bin/bash

echo "🚀 Deploying Kafka KRaft mode (without ZooKeeper) to K3s cluster..."

echo "🎯 Deploying Kafka StatefulSet..."
kubectl apply -f kafka-service.yaml  # Service first
kubectl apply -f kafka-statefulset.yaml  # StatefulSet creates its own PVCs

echo "⏳ Waiting for Kafka StatefulSet to be ready..."
kubectl wait --for=condition=ready --timeout=300s pod/kafka-0 -n sprawdzsluch

echo "🖥️ Deploying Kafka UI..."
kubectl apply -f kafka-ui-service.yaml
kubectl apply -f kafka-ui-deployment.yaml


echo "✅ Kafka StatefulSets deployment complete!"
echo ""
echo "📊 Access Kafka UI at: http://your-server-ip:30080"
echo "🔗 Kafka broker (internal): kafka:9092 or kafka-0.kafka-headless:9092"
echo ""
echo "📋 Check status:"
echo "kubectl get statefulsets -n sprawdzsluch | grep -E '(zookeeper|kafka)'"
echo "kubectl get pods -n sprawdzsluch | grep -E '(zookeeper|kafka)'"
echo ""
echo "🎉 Happy messaging with Kafka StatefulSets!"