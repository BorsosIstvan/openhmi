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

function getProjectList() {
  fetch('/openhmi/php/list_projects.php')
    .then(res => res.json())
    .then(projects => {
      const select = document.getElementById('projectList');
      select.innerHTML = '';
      projects.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
      });
    });
}

function saveProject() {
  const name = prompt("Voer projectnaam in:");
  if (!name) return;

  const project = {
    projectName: name,
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
    alert(data.message);
    getProjectList();
  });
}

function loadProject() {
  const name = document.getElementById('projectList').value;
  if (!name) return;

  fetch(`/openhmi/php/load_project.php?project=${name}`)
    .then(res => res.json())
    .then(data => {
      alert("Project geladen: " + JSON.stringify(data, null, 2));
      // Hier kun je jouw scherm/data vullen met de geladen info
    });
}

window.onload = getProjectList;

