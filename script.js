const client = mqtt.connect('ws://poci.n-soft.net:9001'); // ← pas aan als nodig

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

function saveProject() {
  const project = {
    projectName: "testproject",
    created: new Date().toISOString(),
    objects: [],
    variables: {},
    mqtt: {
      broker: "mqtt://localhost",
      port: 1883
    }
  };

  fetch('/openhmi/php/save_project.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project)
  })
  .then(res => res.json())
  .then(data => {
    console.log("Server:", data);
    alert(data.message);
  });
}
