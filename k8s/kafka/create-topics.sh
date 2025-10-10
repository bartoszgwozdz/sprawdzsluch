#!/bin/bash

# Skrypt do tworzenia topiku Kafka w K3s

echo "🔗 Tworzenie topiku hearing-test-results w Kafka..."

# Sprawdź czy pod kafka-0 jest dostępny
kubectl wait --for=condition=ready --timeout=60s pod/kafka-0 -n sprawdzsluch

if [ $? -eq 0 ]; then
    echo "✅ Kafka pod jest gotowy, tworzenie topiku..."
    
    # Utwórz topic
    kubectl exec -it kafka-0 -n sprawdzsluch -- bash -c "
    cd /opt/kafka/bin && 
    ./kafka-topics.sh --bootstrap-server localhost:9092 --create --topic sprawdzsluch-result-payment-processing --partitions 3 --replication-factor 1 --if-not-exists
    ./kafka-topics.sh --bootstrap-server localhost:9092 --create --topic sprawdzsluch-result-payment-completed --partitions 3 --replication-factor 1 --if-not-exists
    ./kafka-topics.sh --bootstrap-server localhost:9092 --create --topic sprawdzsluch-result-payment-failed --partitions 3 --replication-factor 1 --if-not-exists
    ./kafka-topics.sh --bootstrap-server localhost:9092 --create --topic sprawdzsluch-result-stored --partitions 3 --replication-factor 1 --if-not-exists
    ./kafka-topics.sh --bootstrap-server localhost:9092 --create --topic sprawdzsluch-report-sent --partitions 3 --replication-factor 1 --if-not-exists
    "
    
    if [ $? -eq 0 ]; then
        echo "✅ Topic hearing-test-results został utworzony!"
        
        # Sprawdź listę topików
        echo "📋 Lista topików:"
        kubectl exec -it kafka-0 -n sprawdzsluch -- bash -c "
        cd /opt/kafka/bin && 
        ./kafka-topics.sh --bootstrap-server localhost:9092 --list
        "
    else
        echo "❌ Błąd podczas tworzenia topiku"
        exit 1
    fi
else
    echo "❌ Kafka pod nie jest gotowy"
    exit 1
fi