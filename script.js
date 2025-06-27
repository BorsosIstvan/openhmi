let client = null;
let currentProject = null;
let mode = "run"; // of "edit"

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

  currentProject.objects.forEach((obj, idx) => {
    let el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left = obj.x + "px";
    el.style.top = obj.y + "px";
    el.style.width = obj.width + "px";
    el.style.height = obj.height + "px";
    el.style.borderRadius = "10px";

    el.dataset.name = obj.name;

    if (obj.type === "button") {
      el.innerText = obj.label;
      el.className = "hmi-button";
      el.style.background = "#48c";
      el.style.color = "white";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.cursor = mode === "edit" ? "move" : "pointer";

      if (mode === "run") {
        el.onclick = () => {
          const topic = obj.publishTopic || ((currentProject.settings.mqttPrefix || '') + "/" + obj.name);
          const payload = obj.publishPayload || "clicked";
          publishMQTT(topic, payload);
        };
      }

    } else if (obj.type === "led") {
      el.className = "hmi-led";
      el.style.background = obj.state ? "lime" : "gray";
      el.style.border = "2px solid #333";
    }

    // Silder en tekst
    if (obj.type === "text") {
  el.className = "hmi-text";
  el.innerText = obj.label || obj.name;
  el.style.fontSize = "16px";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.background = "transparent";
  el.style.cursor = "default";

} else if (obj.type === "slider") {
    // Maak een container voor de slider
let container = document.createElement("div");
container.style.position = "absolute";
container.style.left = obj.x + "px";
container.style.top = obj.y + "px";
container.style.width = obj.width + "px";
container.style.height = obj.height + "px";
container.dataset.name = obj.name;
// Maak de slider
  el = document.createElement("input");
  el.type = "range";
  el.className = "hmi-slider";
  el.min = obj.min || 0;
  el.max = obj.max || 100;
  el.value = obj.value || 50;
  el.style.position = "absolute";
  el.style.left = obj.x + "px";
  el.style.top = obj.y + "px";
  el.style.width = obj.width + "px";
  el.style.height = obj.height + "px";
  el.style.zIndex = 10;

  // Optioneel kleur of rand
  //el.style.background = "#ddd";
  //el.style.border = "1px solid #aaa";

  // Voeg slider toe aan container
container.appendChild(el);

  if (mode === "run") {
    el.oninput = () => {
      const topic = obj.publishTopic || ((currentProject.settings.mqttPrefix || '') + "/" + obj.name);
      const payload = el.value;
      publishMQTT(topic, payload);
    };
  }

  if (mode === "edit") {
    // Maken slider ook versleepbaar
    el.onmousedown = (e) => {
      const startX = e.clientX;
      const startY = e.clientY;
      const origX = obj.x;
      const origY = obj.y;
      e.preventDefault();

      function onMove(ev) {
        obj.x = origX + (ev.clientX - startX);
        obj.y = origY + (ev.clientY - startY);
        renderObjects();
      }

      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };
  }
}

    // End Silder en tekst

    // Alleen in EDIT mode: drag & resize
    if (mode === "edit") {
      el.onmousedown = (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const origX = obj.x;
        const origY = obj.y;

        function onMouseMove(ev) {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          obj.x = origX + dx;
          obj.y = origY + dy;
          renderObjects();
        }

        function onMouseUp() {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        }

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      };

      // RESIZE-hoekje rechtsonder
      const resizeHandle = document.createElement("div");
      resizeHandle.style.position = "absolute";
      resizeHandle.style.right = "0";
      resizeHandle.style.bottom = "0";
      resizeHandle.style.width = "12px";
      resizeHandle.style.height = "12px";
      resizeHandle.style.background = "#0006";
      resizeHandle.style.cursor = "se-resize";
      resizeHandle.style.borderRadius = "2px";

      resizeHandle.onmousedown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const origW = obj.width;
        const origH = obj.height;

        function onMouseMove(ev) {
          obj.width = Math.max(20, origW + (ev.clientX - startX));
          obj.height = Math.max(20, origH + (ev.clientY - startY));
          renderObjects();
        }

        function onMouseUp() {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        }

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      };

      el.appendChild(resizeHandle);
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
  renderObjects()
}

function addObject() {
  //const type = document.getElementById("newObjType").value;
  const type = "silder"
  const baseName = type + "_" + (currentProject.objects.length + 1);

  const newObj = {
    type,
    name: baseName,
    label: type.toUpperCase(),
    x: 50,
    y: 50,
    width: type === "slider" ? 120 : 100,
    height: 40,
  };

  if (type === "slider") {
    newObj.min = 0;
    newObj.max = 100;
    newObj.value = 50;
  }

  currentProject.objects.push(newObj);
  renderObjects();
  openObjectSettings(currentProject.objects.length - 1);
}

function deleteCurrentObject() {
  if (selectedObject) {
    currentProject.objects.splice(selectedObject.index, 1);
    selectedObject = null;
    document.getElementById("objectSettingsPanel").style.display = "none";
    renderObjects();
  }
}


function openObjectSettings(index) {
  const obj = currentProject.objects[index];
  selectedObject = { ...obj, index }; // bewaar index

  // Vul hiervoor hetzelfde als eerder, bijv:
  document.getElementById("objName").value = obj.name;
  document.getElementById("objType").value = obj.type;
  document.getElementById("objLabel").value = obj.label || "";
  document.getElementById("objPublishTopic").value = obj.publishTopic;
  document.getElementById("objPublishPayload").value = obj.publishPayload;
  document.getElementById("objSubscribeTopic").value = obj.subscribeTopic;
  document.getElementById("objStateOn").value = obj.stateOn;
  document.getElementById("objStateOff").value = obj.stateOff;
  // etc.

  document.getElementById('objectSettingsPanel').style.display = 'block';
}

function closeObjectSettings() {
document.getElementById("objectSettingsPanel").style.display = "none"
}

function saveObjectSettings() {
  if (selectedObject && selectedObject.index !== undefined) {
    const obj = currentProject.objects[selectedObject.index];

    // Update eigenschappen, behalve x,y, breedte, hoogte (zoals gevraagd)
    obj.name = document.getElementById("objName").value;
    obj.label = document.getElementById("objLabel").value;
    obj.publishTopic = document.getElementById("objPublishTopic").value;
    obj.publishPayload = document.getElementById("objPublishPayload").value;
    obj.subscribeTopic = document.getElementById("objSubscribeTopic").value;
    obj.stateOn = document.getElementById("objStateOn").value;
    obj.stateOff = document.getElementById("objStateOff").value;


    // Sluit het instellingenpaneel
    closeObjectSettings();

    // Herlaad de objectenlijst, zodat de gewijzigde naam zichtbaar wordt
    openObjectList();
  }
}

function toggleMode(isEdit) {
  mode = isEdit ? "edit" : "run";
  renderObjects(); // herteken de objecten
}

