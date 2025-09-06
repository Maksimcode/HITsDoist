const addBtn = document.getElementById("addBtn");
addBtn.addEventListener("click", createTask);

let tasks = []

window.addEventListener("DOMContentLoaded", () => {
  loadTasks();
  renderTasks();
});

function loadTasks() {
    const saved = localStorage.getItem('tasks');
    tasks = saved ? JSON.parse(saved) : [];
}
function saveTasks(){
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

function renderTasks() {
    const incompleteTasks = document.getElementById('incompleteTasks');
    const completedTasks = document.getElementById('completedTasks');

    incompleteTasks.innerHTML = '';
    completedTasks.innerHTML = '';

    tasks.forEach(({ taskText, done }, i) => {
        const li = document.createElement('li');
        const textSpan = document.createElement('span');
        const completeBtn = document.createElement('button');
        const delBtn = document.createElement('button');

        textSpan.textContent = taskText;
        completeBtn.textContent = done ? '↩️' : '✅';
        delBtn.textContent = '🗑️'

        textSpan.addEventListener('click',() => editTask(i));
        completeBtn.addEventListener('click', () => completeTask(i));
        delBtn.addEventListener('click', () => deleteTask(i));

        li.append(textSpan, completeBtn, delBtn);

        if (done) {
            completedTasks.appendChild(li);
        } else {
            incompleteTasks.appendChild(li);
        }
    });
}
        

function createTask() {
    const taskText = document
    .getElementById("input")
    .value
    .trim();

    if (taskText === "") {
        alert("Пожалуйста, введите задачу.");
        return;
    }
    tasks.push({ taskText: taskText, done: false });
    saveTasks();
    renderTasks();
}

function deleteTask(i) {
    tasks.splice(i, 1);
    saveTasks();
    renderTasks();
}

function completeTask(i) { 
    tasks[i].done = !tasks[i].done;
    saveTasks();
    renderTasks();
}

function editTask(i) {
    const taskText = tasks[i].taskText;
    const newTaskText = prompt("Отредактируйте задачу", taskText);
    if (newTaskText !== null && newTaskText.trim()) {
        tasks[i].taskText = newTaskText.trim();
        saveTasks();
        renderTasks();
    }
}


