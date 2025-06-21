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
        if (obj.type === 'led') {
          const topic = (currentProject.settings.mqttPrefix || '') + "/" + obj.name;
          client.subscribe(topic);
        }
      });
    }
  });

  client.on('message', (topic, message) => {
    const msg = message.toString();
    const screen = document.getElementById("screen");
    const leds = screen.getElementsByClassName("hmi-led");

    Array.from(leds).forEach(el => {
      const ledTopic = (currentProject.settings.mqttPrefix || '') + "/" + el.dataset.name;
      if (topic === ledTopic) {
        el.style.background = (msg === 'aan' || msg === 'on' || msg === '1') ? 'lime' : 'gray';
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
  const name = prompt("Voer projectnaam in:");
  if (!name) return;

  const project = {
    projectName: name,
    created: new Date().toISOString(),
    objects: [],
    variables: {},
    settings: {
      mqttBroker: "ws://poci.n-soft.net:9001",
      mqttPort: 9001,
      mqttPrefix: "",
      resolution: "320x240",
      bgColor: "#ffffff"
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
        const topic = (currentProject.settings.mqttPrefix || '') + "/" + obj.name;
        publishMQTT(topic, obj.payload || "clicked");
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

