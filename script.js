const client = mqtt.connect('ws://raspberrypi.local:9001'); // ← pas aan als nodig

client.on('connect', () => {
  console.log("✅ Verbonden met MQTT broker");

  // Abonneren op status
  client.subscribe('pomp/status');
});

// Knop stuurt start-commando
document.getElementById("btnStart").addEventListener("click", () => {
  client.publish('pomp/cmd', 'start');
});

// Status ontvangen
client.on('message', (topic, message) => {
  if (topic === 'pomp/status') {
    const led = document.getElementById("ledStatus");
    const msg = message.toString();
    led.className = 'led ' + (msg === 'aan' ? 'on' : 'off');
  }
});
