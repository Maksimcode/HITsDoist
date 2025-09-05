const addBtn = document.getElementById("addBtn");
addBtn.addEventListener("click", createTask);

function createTask() {
    const taskText = document
    .getElementById("input")
    .value
    .trim();

    if (taskText === "") {
        alert("Пожалуйста, введите задачу.");
        return;
    }

    const li = document.createElement('li');
    const textSpan = document.createElement('span');
    const completeBtn = document.createElement('button');
    const delBtn = document.createElement('button');

    textSpan.textContent   = taskText;
    completeBtn.textContent = '✅';
    delBtn.textContent = '🗑️';
    
    textSpan.addEventListener('click', editTask);
    completeBtn.addEventListener('click', completeTask);
    delBtn.addEventListener('click', deleteTask);
    
    li.append(textSpan, completeBtn, delBtn);
    document.getElementById('incompleteTasks').appendChild(li);

}

function deleteTask(e) {
    const li = e.target.parentElement;
    li.parentNode.removeChild(li)
}

function completeTask(e) { 
    const li = e.target.parentNode; 
    const inIncomplete = li.parentNode.id === 'incompleteTasks';

    const targetList = inIncomplete 
        ? document.getElementById('completedTasks') 
        : document.getElementById('incompleteTasks'); 

    e.target.textContent = inIncomplete ? '↩️' : '✅'; 

    targetList.appendChild(li); }

function editTask(e) {
    const taskText = e.target.textContent;
    const newTaskText = prompt("Отредактируйте задачу", taskText);
    if (newTaskText !== null) {
        e.target.textContent = newTaskText;
    }
}


// let todo = JSON.parse(localStorage.getItem("incompleteTasks"));
// if (!todo) {
//   todo = [];
// }