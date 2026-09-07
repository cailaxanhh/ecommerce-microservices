const { Kafka } = require('kafkajs');

async function main() {
  const kafka = new Kafka({
    clientId: 'probe',
    brokers: ['localhost:9092'],
    retry: { initialRetryTime: 100, retries: 3, maxRetryTime: 5000 },
  });

  // plain producer
  const plain = kafka.producer();
  console.log('plain connect...');
  try {
    await plain.connect();
    console.log('plain connect OK');
    await plain.send({ topic: 'order-events', messages: [{ key: 'probe', value: '{"probe":1}' }] });
    console.log('plain send OK');
    await plain.disconnect();
  } catch (e) {
    console.log('plain CONNECT/SEND FAIL:', e.message);
  }

  // transactional producer
  const tx = kafka.producer({ transactionalId: 'probe-tx', idempotent: true, maxInFlightRequests: 5 });
  console.log('tx connect...');
  try {
    await tx.connect();
    console.log('tx connect OK');
    await tx.send({ topic: 'order-events', messages: [{ key: 'probe-tx', value: '{"probe":2}' }] });
    console.log('tx send OK');
    await tx.disconnect();
  } catch (e) {
    console.log('tx CONNECT/SEND FAIL:', e.message);
  }
}

main().catch((e) => console.log('TOP LEVEL FAIL:', e.message));