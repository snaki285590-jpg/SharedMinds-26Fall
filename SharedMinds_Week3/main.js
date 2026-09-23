console.log("main.js loaded");

const proxyUrl = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
let authToken = ""; // 如果之后老师要求 token，再填进来

let items = JSON.parse(localStorage.getItem("thoughtCollageItems")) || [];

const promptInput = document.getElementById("promptInput");
const generateBtn = document.getElementById("generateBtn");
const clearBtn = document.getElementById("clearBtn");
const statusText = document.getElementById("statusText");
const stage = document.getElementById("stage");

let dragItemId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

function saveItems() {
    localStorage.setItem("thoughtCollageItems", JSON.stringify(items));
}

function getItemById(id) {
    return items.find(item => item.id === id);
}

function renderItems() {
    stage.innerHTML = "";

    items.forEach(item => {
        const wrapper = document.createElement("div");
        wrapper.className = "collage-item";
        wrapper.dataset.id = item.id;
        wrapper.style.left = item.x + "px";
        wrapper.style.top = item.y + "px";
        wrapper.style.width = item.width + "px";
        wrapper.style.setProperty("--seed", item.seed);

        const img = document.createElement("img");
        img.src = item.imageUrl;
        img.alt = item.prompt;
        img.draggable = false;

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = item.prompt;

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "deleteBtn";
        deleteBtn.textContent = "×";

        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            items = items.filter(i => i.id !== item.id);
            saveItems();
            renderItems();
        });

        wrapper.appendChild(img);
        wrapper.appendChild(label);
        wrapper.appendChild(deleteBtn);

        wrapper.addEventListener("mousedown", startDrag);

        stage.appendChild(wrapper);
    });
}

function startDrag(event) {
    const itemElement = event.currentTarget;
    dragItemId = Number(itemElement.dataset.id);

    const item = getItemById(dragItemId);
    const rect = stage.getBoundingClientRect();

    dragOffsetX = event.clientX - rect.left - item.x;
    dragOffsetY = event.clientY - rect.top - item.y;
}

document.addEventListener("mousemove", (event) => {
    if (dragItemId === null) return;

    const item = getItemById(dragItemId);
    if (!item) return;

    const rect = stage.getBoundingClientRect();

    item.x = event.clientX - rect.left - dragOffsetX;
    item.y = event.clientY - rect.top - dragOffsetY;

    const itemElement = stage.querySelector(`[data-id="${dragItemId}"]`);
    if (itemElement) {
        itemElement.style.left = item.x + "px";
        itemElement.style.top = item.y + "px";
    }
});

document.addEventListener("mouseup", () => {
    if (dragItemId !== null) {
        saveItems();
        dragItemId = null;
    }
});

async function generateImage(promptText) {
    statusText.textContent = "Generating...";
    generateBtn.disabled = true;

    try {
        const data = {
            model: "google/nano-banana-2",
            input: {
                prompt: promptText,
                aspect_ratio: "1:1"
            }
        };

        const fetchOptions = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`,
                "Accept": "application/json"
            },
            body: JSON.stringify(data)
        };

        console.log("Sending request:", data);

        const response = await fetch(proxyUrl, fetchOptions);
        const prediction = await response.json();

        console.log("Prediction:", prediction);
        console.log("FULL RESPONSE:", JSON.stringify(prediction, null, 2));

        if (!response.ok) {
            console.error("Server error:", prediction);
            throw new Error("API request failed: " + response.status);
        }

        let imageUrl = null;

        if (prediction.output) {
            if (Array.isArray(prediction.output)) {
                imageUrl = prediction.output[0];
            } else {
                imageUrl = prediction.output;
            }
        }

        if (!imageUrl) {
            throw new Error("No image returned from API.");
        }

        const newItem = {
            id: Date.now(),
            type: "image",
            prompt: promptText,
            imageUrl: imageUrl,
            x: 80 + Math.random() * 500,
            y: 80 + Math.random() * 300,
            width: 220,
            seed: Math.random() * 10
        };

        items.push(newItem);
        saveItems();
        renderItems();

        statusText.textContent = "Done.";
    } catch (error) {
        console.error(error);
        statusText.textContent = "Error. Check console.";
    } finally {
        generateBtn.disabled = false;
    }
}

generateBtn.addEventListener("click", () => {
    console.log("Generate button clicked");

    const promptText = promptInput.value.trim();
    if (!promptText) return;

    generateImage(promptText);
    promptInput.value = "";
});

promptInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        generateBtn.click();
    }
});

clearBtn.addEventListener("click", () => {
    const reallyClear = confirm("Clear all images?");
    if (!reallyClear) return;

    items = [];
    saveItems();
    renderItems();
    statusText.textContent = "Cleared.";
});

renderItems();