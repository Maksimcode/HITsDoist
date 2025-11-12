const API_HOST = "http://127.0.0.1:8000";
const WS_HOST = (API_HOST.startsWith("https") ? "wss" : "ws") + "://" + API_HOST.replace(/^https?:\/\//, "") + "/ws/todos";

const addBtn = document.getElementById("addBtn");
const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const loadInput = document.getElementById("loadInput");
const inputEl = document.getElementById("input");
const incompleteListEl = document.getElementById("incompleteTasks");
const completedListEl = document.getElementById("completedTasks");

let tasks = []; 
let ws;
let wsAlive = false;
let pollInterval = null;

init();

function init() {
  bindUI();
  loadLocal();
  renderTasks();
  bootstrapFromServer().then(ok => {
    if (!ok) {
      
      startWebSocket();
      startPollingFallback();
    } else {
      startWebSocket();
      stopPollingFallback();
    }
  });
}

function bindUI() {
  addBtn.addEventListener("click", createTask);
  saveBtn.addEventListener("click", saveToFile);
  loadBtn.addEventListener("click", () => loadInput.click());
  loadInput.addEventListener("change", loadFromFile);
}

function loadLocal() {
  const saved = localStorage.getItem("tasks_v2");
  tasks = saved ? JSON.parse(saved) : [];
}

function saveLocal() {
  localStorage.setItem("tasks_v2", JSON.stringify(tasks));
}

function renderTasks() {
  incompleteListEl.innerHTML = "";
  completedListEl.innerHTML  = "";

  tasks.forEach(({ id, description, is_done }) => {
    const li          = document.createElement("li");
    const textSpan    = document.createElement("span");
    const completeBtn = document.createElement("button");
    const delBtn      = document.createElement("button");

    textSpan.textContent    = description;
    completeBtn.textContent = is_done ? "вернуть" : "готово";
    delBtn.textContent      = "удалить";

    textSpan.addEventListener("click",  () => editTask(id));
    completeBtn.addEventListener("click", () => toggleTaskStatus(id));
    delBtn.addEventListener("click",     () => deleteTask(id));

    li.append(textSpan, completeBtn, delBtn);
    (is_done ? completedListEl : incompleteListEl).appendChild(li);
  });
}

// ----------------------- REST operations -----------------------

async function fetchTodos() {
  const res = await fetch(`${API_HOST}/todos`, { mode: "cors" });
  if (!res.ok) throw new Error("Failed to fetch todos: " + res.status);
  return res.json();
}

async function postTodo(description) {
  const res = await fetch(`${API_HOST}/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
    mode: "cors"
  });
  if (!res.ok) throw new Error("Failed to create todo: " + res.status);
  return res.json();
}

async function patchTodo(id, payload) {
  const res = await fetch(`${API_HOST}/todos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    mode: "cors"
  });
  if (!res.ok) throw new Error("Failed to update todo: " + res.status);
  return res.json();
}

async function deleteTodoRequest(id) {
  const res = await fetch(`${API_HOST}/todos/${id}`, {
    method: "DELETE",
    mode: "cors"
  });
  if (!res.ok && res.status !== 204) throw new Error("Failed to delete todo: " + res.status);
}

// ----------------------- UI actions -----------------------

async function createTask() {
  const text = inputEl.value.trim();
  if (!text) {
    alert("Пожалуйста, введите задачу.");
    return;
  }
  try {
    const created = await postTodo(text);
    upsertLocal(created);
    saveLocal();
    renderTasks();
    inputEl.value = "";
    inputEl.focus();
  } catch (err) {
    console.error("Create error", err);
    alert("Ошибка создания задачи: " + err.message + "\nПроверьте, запущен ли сервер и разрешён ли CORS.");
  }
}

async function deleteTask(id) {
  try {
    await deleteTodoRequest(id);
    removeLocal(id);
    saveLocal();
    renderTasks();
  } catch (err) {
    console.error("Delete error", err);
    alert("Ошибка удаления: " + err.message);
  }
}

async function toggleTaskStatus(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  try {
    const updated = await patchTodo(id, { is_done: !t.is_done });
    upsertLocal(updated);
    saveLocal();
    renderTasks();
  } catch (err) {
    console.error("Toggle error", err);
    alert("Ошибка смены статуса: " + err.message);
  }
}

async function editTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  const updated = prompt("Отредактируйте задачу", t.description);
  if (updated !== null && updated.trim()) {
    try {
      const res = await patchTodo(id, { description: updated.trim() });
      upsertLocal(res);
      saveLocal();
      renderTasks();
    } catch (err) {
      console.error("Edit error", err);
      alert("Ошибка редактирования: " + err.message);
    }
  }
}

// ----------------------- local helpers -----------------------

function upsertLocal(item) {
  const idx = tasks.findIndex(t => t.id === item.id);
  const normalized = { id: item.id, description: item.description, is_done: !!item.is_done };
  if (idx === -1) tasks.push(normalized);
  else tasks[idx] = normalized;
}

function removeLocal(id) {
  tasks = tasks.filter(t => t.id !== id);
}

function replaceAllLocal(arr) {
  tasks = arr.map(it => ({ id: it.id, description: it.description, is_done: !!it.is_done }));
}



function startWebSocket() {

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  try {
    ws = new WebSocket(WS_HOST);
  } catch (err) {
    console.warn("WS create failed", err);
    wsAlive = false;
    return;
  }

  ws.onopen = () => {
    console.log("WS open");
    wsAlive = true;
    stopPollingFallback();
  };

  ws.onmessage = (e) => {
    try {
      const ev = JSON.parse(e.data);
      handleEvent(ev);
    } catch (err) {
      console.warn("Bad WS message", err);
    }
  };

  ws.onclose = (ev) => {
    console.log("WS closed", ev);
    wsAlive = false;
    startPollingFallback();
    setTimeout(startWebSocket, 1000 + Math.random() * 2000);
  };

  ws.onerror = (err) => {
    console.log("WS error", err);
    try { ws.close(); } catch (_) {}
  };
}

function handleEvent(ev) {
  switch (ev.type) {
    case "todo_created":
      upsertLocal(ev.payload);
      break;
    case "todo_updated":
      upsertLocal(ev.payload);
      break;
    case "todo_deleted":
      removeLocal(ev.payload.id);
      break;
    case "todos_replaced":
      replaceAllLocal(ev.payload);
      break;
    default:
      console.warn("Unknown event", ev);
  }
  saveLocal();
  renderTasks();
}


function startPollingFallback() {
  if (pollInterval) return;
  pollInterval = setInterval(async () => {
    if (wsAlive) { clearInterval(pollInterval); pollInterval = null; return; }
    try {
      const list = await fetchTodos();
      replaceAllLocal(list);
      saveLocal();
      renderTasks();
    } catch (err) {
      console.log("Polling failed", err);
    }
  }, 5000);
}

function stopPollingFallback() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}


async function bootstrapFromServer() {
  try {
    const list = await fetchTodos();
    replaceAllLocal(list);
    saveLocal();
    renderTasks();
    console.log("Initial sync from server succeeded");
    return true;
  } catch (err) {
    console.warn("Initial sync failed:", err);
    // показываем подсказку, если это CORS или сетевой отказ
    if (err.message && err.message.toLowerCase().includes("failed to fetch")) {
      console.warn("Failed to fetch from API. Проверьте, что сервер запущен и запущен с CORS разрешением (см. main.py).");
    }
    return false;
  }
}


function saveToFile() {
  const dataStr  = JSON.stringify(tasks, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url      = URL.createObjectURL(dataBlob);
  const link     = document.createElement("a");

  link.href    = url;
  link.download = "todo-list.json";
  link.click();

  URL.revokeObjectURL(url);
}

function loadFromFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const arr = JSON.parse(reader.result);
      if (!Array.isArray(arr)) throw new Error("Ожидается массив");
      const normalized = arr.map(item => {
        if (item.taskText !== undefined) {
          return { description: item.taskText, is_done: !!item.done };
        }
        if (item.description && typeof item.is_done === "boolean") {
          return { description: item.description, is_done: item.is_done };
        }
        throw new Error("Неверный формат объекта задачи");
      });
      const res = await fetch(`${API_HOST}/todos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todos: normalized }),
        mode: "cors"
      });
      if (!res.ok) throw new Error("Server rejected upload: " + res.status);
      const saved = await res.json();
      replaceAllLocal(saved);
      saveLocal();
      renderTasks();
      alert("Задачи успешно загружены и синхронизированы с сервером");
    } catch (err) {
      console.error("Load from file failed", err);
      alert("Не удалось загрузить JSON: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}
