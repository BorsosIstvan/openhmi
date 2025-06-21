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
  fetch('/openhmi/api/list_projects.php')
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

  fetch('/openhmi/api/save_project.php', {
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

  fetch(`/openhmi/api/load_project.php?project=${name}`)
    .then(res => res.json())
    .then(data => {
      alert("Project geladen: " + JSON.stringify(data, null, 2));
      // Hier kun je jouw scherm/data vullen met de geladen info
    });
}

window.onload = getProjectList;

function openSettings() {
  // Als project geladen is, vul de velden
  if (typeof currentProject !== 'undefined' && currentProject.settings) {
    document.getElementById('mqttBroker').value = currentProject.settings.mqttBroker || '';
    document.getElementById('mqttPort').value = currentProject.settings.mqttPort || 1883;
    document.getElementById('mqttPrefix').value = currentProject.settings.mqttPrefix || '';
    document.getElementById('resolution').value = currentProject.settings.resolution || '320x240';
    document.getElementById('bgColor').value = currentProject.settings.bgColor || '#ffffff';
  }
  document.getElementById('settingsModal').style.display = 'block';
}

function closeSettings() {
  document.getElementById('settingsModal').style.display = 'none';
}

function saveSettings() {
  const settings = {
    mqttBroker: document.getElementById('mqttBroker').value,
    mqttPort: parseInt(document.getElementById('mqttPort').value),
    mqttPrefix: document.getElementById('mqttPrefix').value,
    resolution: document.getElementById('resolution').value,
    bgColor: document.getElementById('bgColor').value
  };

  if (typeof currentProject === 'undefined') {
    currentProject = { name: "NieuwProject", settings: {}, objects: [] };
  }

  currentProject.settings = settings;

  // Verander achtergrondkleur live
  document.getElementById('screen').style.backgroundColor = settings.bgColor;

  saveCurrentProject(); // bestaande functie die het project opslaat
  closeSettings();
}

function renderObjects() {
  const screen = document.getElementById('screen');
  screen.innerHTML = ""; // eerst leegmaken

  currentProject.objects.forEach(obj => {
    let el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left = obj.x + "px";
    el.style.top = obj.y + "px";
    el.style.width = obj.width + "px";
    el.style.height = obj.height + "px";
    el.style.borderRadius = "10px";

    if (obj.type === "button") {
      el.innerText = obj.label;
      el.className = "hmi-button";
      el.style.background = "#48c";
      el.style.color = "white";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.cursor = "pointer";

      el.onclick = () => {
        const topic = currentProject.settings.mqttPrefix + "/" + obj.name;
        const payload = "clicked"; // dit kan later aangepast worden
        publishMQTT(topic, payload);
      };

    } else if (obj.type === "led") {
      el.className = "hmi-led";
      el.style.background = obj.state ? "lime" : "gray";
      el.style.border = "2px solid #333";
    }

    screen.appendChild(el);
  });
}

function publishMQTT(topic, message) {
  console.log("MQTT PUBLISH:", topic, message);
  // TODO: MQTT client implementeren of naar Bluetooth sturen
}

