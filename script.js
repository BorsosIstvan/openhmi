let client = null;
let currentProject = null;

function connectMQTT(brokerURL) {
  if (client) {
    client.end(); // eventuele vorige client afsluiten
  }

  client = mqtt.connect(brokerURL);

  client.on('connect', () => {
    console.log("✅ Verbonden met MQTT broker:", brokerURL);

    if (currentProject?.objects) {
  currentProject.objects.forEach(obj => {
    if (obj.subscribeTopic) {
      client.subscribe(obj.subscribeTopic);
    }
  });
}
  });

  client.on('message', (topic, message) => {
  const msg = message.toString();
  const screen = document.getElementById("screen");

  Array.from(screen.getElementsByClassName("hmi-led")).forEach(el => {
    const obj = currentProject.objects.find(o => o.name === el.dataset.name);
    if (obj && obj.subscribeTopic === topic) {
      const isOn = msg === obj.stateOn || msg === "1" || msg.toLowerCase() === "on";
      el.style.background = isOn ? 'lime' : 'gray';
    }
  });
});
}

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
  if (!currentProject) {
    alert("Geen project geladen.");
    return;
  }

  const name = currentProject.projectName || prompt("Voer projectnaam in:");
  if (!name) return;

  // Bijwerken van timestamp, of andere dynamische velden
  currentProject.projectName = name;
  currentProject.saved = new Date().toISOString();

  fetch('/openhmi/api/save_project.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(currentProject)
  })
  .then(res => res.json())
  .then(data => {
    alert(data.message || "Project opgeslagen.");
    getProjectList();
  })
  .catch(err => {
    console.error("❌ Fout bij opslaan:", err);
    alert("Project opslaan mislukt.");
  });
}

function saveProjectAs() {
  const name = prompt("Voer een nieuwe projectnaam in:");
  if (!name) return;

  // Nieuw projectobject maken met de huidige inhoud
  const project = {
    projectName: name,
    created: new Date().toISOString(),
    saved: new Date().toISOString(),
    settings: currentProject?.settings || {},
    objects: currentProject?.objects || [],
    variables: currentProject?.variables || {},
    mqtt: currentProject?.mqtt || {
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
    alert(data.message || "Project succesvol opgeslagen.");
    getProjectList();

    // Werk currentProject bij naar het nieuwe
    currentProject = project;
  })
  .catch(err => {
    console.error("❌ Fout bij opslaan:", err);
    alert("Opslaan mislukt.");
  });
}


function loadProject() {
  const name = document.getElementById('projectList').value;
  if (!name) return;

  fetch(`/openhmi/api/load_project.php?project=${name}`)
    .then(res => res.json())
    .then(data => {
      currentProject = data;
      console.log("📂 Project geladen:", currentProject);
      document.getElementById('screen').style.backgroundColor = currentProject.settings.bgColor || '#ffffff';
      renderObjects();
      const brokerURL = currentProject.settings.mqttBroker || 'ws://localhost:9001';
      connectMQTT(brokerURL);
    });
}

window.onload = getProjectList;

function openSettings() {
  if (currentProject?.settings) {
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

  if (!currentProject) {
    currentProject = { name: "NieuwProject", settings: {}, objects: [] };
  }

  currentProject.settings = settings;

  document.getElementById('screen').style.backgroundColor = settings.bgColor;

  saveCurrentProject(); // deze functie moet elders in jouw systeem bestaan
  closeSettings();
}

function renderObjects() {
  const screen = document.getElementById('screen');
  screen.innerHTML = "";

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
      el.dataset.name = obj.name;

      el.onclick = () => {
  const topic = obj.publishTopic || ((currentProject.settings.mqttPrefix || '') + "/" + obj.name);
  const payload = obj.publishPayload || "clicked";
  publishMQTT(topic, payload);
};

    } else if (obj.type === "led") {
      el.className = "hmi-led";
      el.style.background = obj.state ? "lime" : "gray";
      el.style.border = "2px solid #333";
      el.dataset.name = obj.name;
    }

    screen.appendChild(el);
  });
}

function publishMQTT(topic, message) {
  if (client?.connected) {
    console.log("MQTT →", topic, message);
    client.publish(topic, message);
  } else {
    console.warn("MQTT client niet verbonden.");
  }
}

function openObjectList() {
  const ul = document.getElementById("objectList");
  ul.innerHTML = "";
  currentProject.objects.forEach((obj, idx) => {
    const li = document.createElement("li");
    li.textContent = `${obj.type.toUpperCase()} — ${obj.name}`;
    li.onclick = () => openObjectSettings(idx);
    ul.appendChild(li);
  });
  document.getElementById("objectListPanel").style.display = "block";
}

function closeObjectList() {
  document.getElementById("objectListPanel").style.display = "none";
}

function openObjectSettings(index) {
  const obj = currentProject.objects[index];
  selectedObject = { ...obj, index }; // bewaar index

  // Vul hiervoor hetzelfde als eerder, bijv:
  document.getElementById("objName").value = obj.name;
  document.getElementById("objType").value = obj.type;
  document.getElementById("objLabel").value = obj.label || "";
  // etc.

  document.getElementById('objectSettingsPanel').style.display = 'block';
}

function closeObjectSettings() {
document.getElementById("objectSettingsPanel").style.display = "none"
}
