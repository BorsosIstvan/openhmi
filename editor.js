// Project Editor for OpenHMI
// Includes: Open, SaveAs, Insert, Delete, EditProperties, Edit/Run toggle
// Object types: Text, Button, Lamp, Potentiometer, Number (bit/int, in/out), all with optional MQTT settings

// MQTT
let client = null;
let currentProject = null;
let mode = "run";

function connectMQTT(brokerURL) {
  if (client) client.end();
  client = mqtt.connect(brokerURL);

  client.on('connect', () => {
    console.log("✅ Verbonden met MQTT broker:", brokerURL);
    currentProject?.objects?.forEach(obj => {
      if (obj.subscribeTopic) client.subscribe(obj.subscribeTopic);
    });
  });

  client.on('message', (topic, message) => {
    const msg = message.toString();
    currentProject.objects.forEach(obj => {
      if (obj.subscribeTopic === topic) updateObjectState(obj, msg);
    });
  });
}

function updateObjectState(obj, msg) {
  const el = document.querySelector(`[data-name='${obj.name}']`);
  if (!el) return;

  if (obj.type === "lamp") {
    const isOn = msg === obj.stateOn || msg === "1" || msg.toLowerCase() === "on";
    el.style.background = isOn ? 'lime' : 'gray';
  } else if (obj.type === "number") {
    el.textContent = msg;
  }
}

function publishMQTT(topic, payload) {
  if (client && client.connected) client.publish(topic, payload);
}

// Project Handling
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

function saveProject(name = null) {
  if (!currentProject) {
    alert("Geen project geladen.");
    return;
  }
  name = name || currentProject.projectName || prompt("Voer projectnaam in:");
  if (!name) return;
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
  .catch(err => alert("Project opslaan mislukt."));
}

function saveProjectAs() {
  const name = prompt("Voer een nieuwe projectnaam in:");
  if (!name) return;
  const copy = { ...currentProject, projectName: name, created: new Date().toISOString(), saved: new Date().toISOString() };
  fetch('/openhmi/api/save_project.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(copy)
  })
  .then(res => res.json())
  .then(data => {
    alert(data.message || "Project succesvol opgeslagen.");
    currentProject = copy;
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
      renderObjects();
      connectMQTT(currentProject.settings.mqttBroker || 'ws://poci.n-soft.net:9001');
    });
}

window.onload = getProjectList;

function toggleMode() {
  mode = mode === "run" ? "edit" : "run";
  renderObjects();
}

function insertObject(type) {
  const obj = {
    name: `${type}_${Date.now()}`,
    type,
    x: 10,
    y: 10,
    width: 80,
    height: 30,
    label: type,
    publishTopic: "",
    subscribeTopic: "",
    publishPayload: "1",
    stateOn: "1"
  };
  currentProject.objects.push(obj);
  renderObjects();
}

function deleteSelected() {
  const name = prompt("Naam van object om te verwijderen:");
  if (!name) return;
  currentProject.objects = currentProject.objects.filter(o => o.name !== name);
  renderObjects();
}

function editProperties(name) {
  const obj = currentProject.objects.find(o => o.name === name);
  if (!obj) return alert("Object niet gevonden.");
  const newLabel = prompt("Label:", obj.label);
  const newTopic = prompt("Publish Topic:", obj.publishTopic);
  const newSub = prompt("Subscribe Topic:", obj.subscribeTopic);
  if (newLabel !== null) obj.label = newLabel;
  if (newTopic !== null) obj.publishTopic = newTopic;
  if (newSub !== null) obj.subscribeTopic = newSub;
  renderObjects();
}

function renderObjects() {
  const screen = document.getElementById("screen");
  screen.innerHTML = "";
  currentProject.objects.forEach(obj => {
    let el = document.createElement("div");
    el.dataset.name = obj.name;
    el.style.position = "absolute";
    el.style.left = obj.x + "px";
    el.style.top = obj.y + "px";
    el.style.width = obj.width + "px";
    el.style.height = obj.height + "px";
    el.style.border = "1px solid #333";
    el.style.borderRadius = "5px";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.cursor = mode === "edit" ? "move" : "pointer";

    if (obj.type === "text") {
      el.innerText = obj.label;
    } else if (obj.type === "button") {
      el.innerText = obj.label;
      if (mode === "run") el.onclick = () => publishMQTT(obj.publishTopic, obj.publishPayload);
    } else if (obj.type === "lamp") {
      el.style.background = "gray";
    } else if (obj.type === "potentiometer") {
      el = document.createElement("input");
      el.type = "range";
      el.min = obj.min || 0;
      el.max = obj.max || 100;
      el.value = obj.value || 50;
      el.style.position = "absolute";
      el.style.left = obj.x + "px";
      el.style.top = obj.y + "px";
      el.style.width = obj.width + "px";
      if (mode === "run") el.oninput = () => publishMQTT(obj.publishTopic, el.value);
    } else if (obj.type === "number") {
      el.innerText = "0";
    }

    if (mode === "edit") {
      el.ondblclick = () => editProperties(obj.name);
      el.onmousedown = e => {
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = obj.x;
        const startTop = obj.y;
        function move(ev) {
          obj.x = startLeft + (ev.clientX - startX);
          obj.y = startTop + (ev.clientY - startY);
          renderObjects();
        }
        function up() {
          document.removeEventListener("mousemove", move);
          document.removeEventListener("mouseup", up);
        }
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", up);
      };
    }
    screen.appendChild(el);
  });
}
