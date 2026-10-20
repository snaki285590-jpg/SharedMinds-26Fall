import { createRoomRendering } from "./room-rendering.js";
import { createHouseLobby } from "./house-lobby.js";
import { createLobbyModes } from "./lobby-modes.js";
import { createMemorySpace } from "./memory-space.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  push,
  remove,
  onValue
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

/* =========================================================
   FIREBASE
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyBDOmurEZq2J4T6NNheBtWKh-gI9UDL45Q",
  authDomain: "skyler-week4-memory-room.firebaseapp.com",
  databaseURL: "https://skyler-week4-memory-room-default-rtdb.firebaseio.com",
  projectId: "skyler-week4-memory-room",
  storageBucket: "skyler-week4-memory-room.firebasestorage.app",
  messagingSenderId: "799394138961",
  appId: "1:799394138961:web:be1f7c9bb93a4dde6de17e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const HOUSE_ROOT = "memoryHouse";
const usersRef = ref(db, `${HOUSE_ROOT}/users`);

/* =========================================================
   AI MODEL
   ========================================================= */

const PROXY_URL = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
const MODEL = "google/nano-banana-2";

// Your current version already works without an extra NYU token.
// If the class later gives you one, add it here.
const authToken = "";

/* =========================================================
   APP STATE
   ========================================================= */

let currentUserName = "";
let currentUserKey = "";

let currentRoomKey = "";
let currentRoomName = "";

let allUsers = {};
let roomAssets = [];
let roomDimensions = {x:8,y:5,z:7};
function normalizeRoomDimensions(value) {
  const result={};
  for(const [axis,fallback] of Object.entries({x:8,y:5,z:7})) {
    const number=Number(value?.[axis]);
    result[axis]=Number.isFinite(number) && number>=2 && number<=20 ? number : fallback;
  }
  return result;
}

let selectedAssetId = null;
let selectedObject = null;

let unsubscribeRoom = null;
let lobbySubscribed = false;
let roomBuildVersion = 0;
let sequenceVersion = 0;

const assetObjects = new Map();

/* =========================================================
   DOM
   ========================================================= */

const $ = (sel) => document.querySelector(sel);

const loginView = $("#loginView");
const lobbyView = $("#lobbyView");
const roomView = $("#roomView");

const nameInput = $("#nameInput");
const enterBtn = $("#enterBtn");

const apartmentGrid = $("#apartmentGrid");
const lobbyStatus = $("#lobbyStatus");

const myRoomBtn = $("#myRoomBtn");
const seedBtn = $("#seedBtn");
const logoutBtn = $("#logoutBtn");

const backBtn = $("#backBtn");
const deleteRoomBtn = $("#deleteRoomBtn");
const deleteRoomStatus = $("#deleteRoomStatus");
const roomTitle = $("#roomTitle");
const roomSubtitle = $("#roomSubtitle");
const ownerControls = $("#ownerControls");
const modeBadge = $("#modeBadge");

const promptInput = $("#promptInput");
const addObjectBtn = $("#addObjectBtn");
const statusEl = $("#status");

const deleteBtn = $("#deleteBtn");
const clearBtn = $("#clearBtn");

const playBtn = $("#playBtn");
const resetViewBtn = $("#resetViewBtn");
const nextRoomBtn = $("#nextRoomBtn");

const selectedEmpty = $("#selectedEmpty");
const selectedInfo = $("#selectedInfo");
const selectedPreview = $("#selectedPreview");
const selectedPrompt = $("#selectedPrompt");
const selectedTime = $("#selectedTime");

const connectionInput = $("#connectionInput");
const connectionBtn = $("#connectionBtn");
const connectionList = $("#connectionList");

/* =========================================================
   HELPERS
   ========================================================= */

function safeKey(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.#$/\[\]]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60) || "guest";
}

function normalizeAssets(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .map((asset, index) => ({
        ...asset,
        id: asset.id || `legacy_${index}`
      }));
  }

  return Object.entries(value).map(([id, asset]) => ({
    ...asset,
    id: asset?.id || id
  }));
}

function formatDate(timestamp) {
  if (!timestamp) return "Unknown time";

  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return "Unknown time";
  }
}

function setStatus(message) {
  statusEl.textContent = message;
}

function showView(view) {
  loginView.classList.add("hidden");
  lobbyView.classList.add("hidden");
  roomView.classList.add("hidden");

  view.classList.remove("hidden");
  view.classList.remove("view-arrive");
  void view.offsetWidth;
  view.classList.add("view-arrive");

  if (view === lobbyView) requestAnimationFrame(resizeLobby);
  if (view === roomView) {
    roomRendering.enter();
    requestAnimationFrame(() => roomRendering.enter());
  }
}

function isOwner() {
  return currentRoomKey === currentUserKey;
}

function roomPath(userKey) {
  return `${HOUSE_ROOT}/users/${userKey}`;
}

function assetPath(userKey, assetId) {
  return `${roomPath(userKey)}/assets/${assetId}`;
}

function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================================================
   LOGIN / USER IDENTITY
   ========================================================= */

async function enterHouse() {
  const name = nameInput.value.trim();

  if (!name) {
    nameInput.focus();
    return;
  }

  currentUserName = name;
  currentUserKey = safeKey(name);

  localStorage.setItem("memoryHouseName", currentUserName);

  const profileRef = ref(db, `${roomPath(currentUserKey)}/profile`);
  const profileSnap = await get(profileRef);

  if (!profileSnap.exists()) {
    await set(profileRef, {
      name: currentUserName,
      createdAt: Date.now()
    });

    // Import your old Week 4 room once, if it exists.
    if (currentUserName.toLowerCase() === "skyler") {
      await tryImportLegacySkylerRoom();
    }
  } else {
    await update(profileRef, {
      name: currentUserName
    });
  }

  showView(lobbyView);
  subscribeLobby();
  renderLobby();
}

async function tryImportLegacySkylerRoom() {
  const newAssetsRef = ref(db, `${roomPath(currentUserKey)}/assets`);
  const newAssetsSnap = await get(newAssetsRef);

  if (newAssetsSnap.exists()) return;

  const legacySnap = await get(ref(db, "rooms/Skyler"));

  if (!legacySnap.exists()) return;

  const legacyAssets = normalizeAssets(legacySnap.val());

  if (!legacyAssets.length) return;

  const converted = {};

  legacyAssets.forEach((asset, index) => {
    const id = asset.id || `legacy_${Date.now()}_${index}`;

    converted[id] = {
      ...asset,
      id,
      order: asset.order ?? index,
      timestamp: asset.timestamp ?? Date.now()
    };
  });

  await set(newAssetsRef, converted);
}

async function enterSafely() {
  if (enterBtn.disabled) return;
  enterBtn.disabled = true;
  $("#loginError").textContent = "";
  try { await enterHouse(); }
  catch (error) { $("#loginError").textContent = `Could not enter: ${error.message}`; }
  finally { enterBtn.disabled = false; }
}
enterBtn.addEventListener("click", enterSafely);

nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    enterSafely();
  }
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("memoryHouseName");

  currentUserName = "";
  currentUserKey = "";
  nameInput.value = "";

  showView(loginView);
});

function returnToEntrance() {
  detachRoomListener();
  clearSelection();
  currentRoomKey = '';
  currentRoomName = '';
  nameInput.value = currentUserName || localStorage.getItem('memoryHouseName') || '';
  showView(loginView);
}
$('#entranceBtn').addEventListener('click', returnToEntrance);
$('#roomEntranceBtn').addEventListener('click', returnToEntrance);

const rememberedName = localStorage.getItem("memoryHouseName");

if (rememberedName) {
  nameInput.value = rememberedName;
}

/* =========================================================
   LOBBY / APARTMENT CUTAWAY
   ========================================================= */

function subscribeLobby() {
  if (lobbySubscribed) return;

  lobbySubscribed = true;

  onValue(usersRef, (snapshot) => {
    allUsers = snapshot.val() || {};
    renderLobby();
  }, (error) => { lobbyStatus.textContent = `Connection error: ${error.message}`; });
}

// The two lobby modes share one Firebase dataset and the original 3D room.
const memorySpace = createMemorySpace({
  host: apartmentGrid,
  openRoom,
  getIdentity: () => ({key: currentUserKey, name: currentUserName}),
  saveMemory: (key, text) => set(ref(db, `${roomPath(key)}/memoryText`), text),
  callProxy,
  saveSynthetic: async (users) => {
    const patch = {};
    for (const user of users) {
      const key = push(usersRef).key;
      patch[key] = user;
    }
    await update(usersRef, patch);
  },
  status: lobbyStatus
});
const lobbyModes = createLobbyModes({
  semantic: memorySpace,
  createHouse: () => createHouseLobby({
    apartmentGrid: $('#houseGrid'), lobbyStatus: $('#houseStatus'), openRoom,
    normalizeAssets, normalizeRoomDimensions, disposeObject, makeCutoutTexture, addCutoutDepth
  })
});
function renderLobby() { lobbyModes.sync(allUsers, currentUserKey); }
function resizeLobby() { lobbyModes.resize(); }
window.addEventListener('resize', resizeLobby);

function countConnections(connectionsRoot) {
  if (!connectionsRoot) return 0;

  let total = 0;

  Object.values(connectionsRoot).forEach((connectionsForOneAsset) => {
    if (
      connectionsForOneAsset &&
      typeof connectionsForOneAsset === "object"
    ) {
      total += Object.keys(connectionsForOneAsset).length;
    }
  });

  return total;
}

// Explicit creation adds another volunteered-name room without replacing an existing one.
$('#addRoomBtn').addEventListener('click', async () => {
  const button = $('#addRoomBtn');
  if (button.disabled) return;
  const requestedName = prompt('Name the new room / resident. A different name creates a new room.');
  if (!requestedName?.trim()) return;
  const name = requestedName.trim().slice(0,40);
  const key = safeKey(name);
  button.disabled = true;
  try {
    const profileRef = ref(db, `${roomPath(key)}/profile`);
    const existing = await get(profileRef);
    if (existing.exists()) {
      alert(`A room for "${existing.val().name || name}" already exists. Use a different name to add another room.`);
      return;
    }
    await set(profileRef, {name, createdAt:Date.now()});
    // onValue renders every room; no six-room slice or limit is applied.
  } catch (error) {
    alert(`Could not add the room: ${error.message}`);
  } finally { button.disabled = false; }
});

myRoomBtn.addEventListener("click", () => {
  openRoom(currentUserKey);
});

backBtn.addEventListener("click", () => {
  detachRoomListener();

  transform.detach();

  selectedAssetId = null;
  selectedObject = null;

  clearSelectedPanel();
  showView(lobbyView);
});

// Prototype room management. No database write occurs until the user confirms.
deleteRoomBtn.addEventListener('click', async () => {
  if (!currentRoomKey || isOwner() || deleteRoomBtn.disabled) return;
  const key = currentRoomKey;
  const name = currentRoomName;
  const assets = normalizeAssets(allUsers[key]?.assets);
  if (!confirm(`Delete ${name}'s room?\n\nThis permanently deletes the shared Firebase room, its ${assets.length} memory objects and all responses. Everyone will lose access to it.`)) return;
  deleteRoomBtn.disabled = true;
  deleteRoomStatus.textContent = 'Deleting room…';
  try {
    await remove(ref(db, roomPath(key)));
    if (currentRoomKey === key) {
      detachRoomListener();
      clearSelection();
      currentRoomKey = '';
      currentRoomName = '';
      roomAssets = [];
      showView(lobbyView);
    }
  } catch (error) {
    deleteRoomStatus.textContent = `Could not delete room: ${error.message}`;
  } finally {
    deleteRoomBtn.disabled = false;
  }
});

/* =========================================================
   DEMO NEIGHBORS
   ========================================================= */

seedBtn.addEventListener("click", async () => {
  const confirmed = confirm(
    "Add three fake neighbors to Firebase for testing the apartment?"
  );

  if (!confirmed) return;

  seedBtn.disabled = true;
  seedBtn.textContent = "Adding…";

  try {
    const demoUsers = [
      {
        key: "demo_alex",
        name: "Alex",
        prompts: [
          "old guitar",
          "late night subway",
          "family dinner"
        ]
      },
      {
        key: "demo_mina",
        name: "Mina",
        prompts: [
          "childhood book",
          "small house plant",
          "summer beach"
        ]
      },
      {
        key: "demo_noah",
        name: "Noah",
        prompts: [
          "headphones",
          "coffee cup",
          "rainy window"
        ]
      }
    ];

    for (const demo of demoUsers) {
      const demoRef = ref(db, roomPath(demo.key));
      const existing = await get(demoRef);

      if (existing.exists()) continue;

      const assets = {};

      demo.prompts.forEach((prompt, index) => {
        const id = `demo_${index}`;

        assets[id] = {
          id,
          prompt,
          imageUrl: makeDemoSVGDataURL(prompt, index),
          position: [
            -1.8 + index * 1.8,
            1.1 + (index % 2) * 0.25,
            -0.8 + index * 0.35
          ],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          order: index,
          timestamp:
            Date.now() -
            (demoUsers.indexOf(demo) * 5 + index) * 86400000
        };
      });

      await set(demoRef, {
        profile: {
          name: demo.name,
          synthetic: true,
          source: "hand-authored demo (not AI-generated)",
          createdAt: Date.now(),
          demo: true
        },
        assets
      });
    }
  } finally {
    seedBtn.disabled = false;
    seedBtn.textContent = "Add Hand-authored Demos";
  }
});

function makeDemoSVGDataURL(label, index) {
  const shapes = [
    `
      <rect x="90" y="110" width="220" height="160" rx="28" fill="#444"/>
      <rect x="150" y="70" width="100" height="45" rx="20"
        fill="none" stroke="#222" stroke-width="12"/>
    `,
    `
      <circle cx="200" cy="190" r="100" fill="#555"/>
      <rect x="185" y="75" width="30" height="230" rx="15" fill="#222"/>
    `,
    `
      <path d="M110 270 Q200 70 290 270 Z" fill="#333"/>
      <rect x="165" y="245" width="70" height="70" fill="#666"/>
    `
  ];

  const safeLabel = escapeHTML(label);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
      <rect width="100%" height="100%" fill="none"/>
      ${shapes[index % shapes.length]}
      <text
        x="200"
        y="355"
        text-anchor="middle"
        font-family="Arial"
        font-size="22"
        fill="#222"
      >
        ${safeLabel}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* =========================================================
   ROOM SUBSCRIPTION
   ========================================================= */

function detachRoomListener() {
  roomBuildVersion++;
  sequenceVersion++;
  playBtn.disabled = false;
  if (unsubscribeRoom) {
    unsubscribeRoom();
    unsubscribeRoom = null;
  }
}

async function openRoom(userKey) {
  detachRoomListener();

  currentRoomKey = userKey;
  roomDimensions = normalizeRoomDimensions(allUsers[userKey]?.dimensions);
  buildRoomGeometry();
  syncDimensionFields();
  $('#roomSizeControls').classList.add('hidden');
  $('#roomSizeBtn').setAttribute('aria-expanded','false');
  currentRoomName =
    allUsers[userKey]?.profile?.name || userKey;

  roomTitle.textContent = currentRoomName;

  roomSubtitle.textContent = isOwner()
    ? "This is your room. You can add and rearrange memories."
    : "You are visiting someone else's room. Look around and leave a memory connection.";

  const profile = allUsers[userKey]?.profile;
  $('#roomOrigin').textContent = profile?.synthetic || profile?.demo
    ? `SYNTHETIC TEST USER · ${profile?.source || 'hand-authored demo'}` : '';
  $('#roomMemory').textContent = allUsers[userKey]?.memoryText || '';
  ownerControls.classList.toggle("hidden", !isOwner());
  deleteRoomBtn.classList.toggle("hidden", isOwner());
  deleteRoomStatus.textContent = "";

  modeBadge.textContent = isOwner()
    ? "Composing your room"
    : `Visiting ${currentRoomName}`;

  transform.detach();

  selectedAssetId = null;
  selectedObject = null;

  clearSelectedPanel();

  resetCamera();
  showView(roomView);

  const currentRoomRef = ref(db, roomPath(userKey));

  unsubscribeRoom = onValue(
    currentRoomRef,
    async (snapshot) => {
      if (userKey !== currentRoomKey) return;
      const roomData = snapshot.val() || {};

      currentRoomName =
        roomData?.profile?.name || currentRoomName;

      roomTitle.textContent = currentRoomName;
      $('#roomMemory').textContent = roomData.memoryText || '';
      $('#roomOrigin').textContent = roomData.profile?.synthetic || roomData.profile?.demo
        ? `SYNTHETIC TEST USER · ${roomData.profile.source || 'hand-authored demo'}` : '';

      const incomingDimensions = normalizeRoomDimensions(roomData.dimensions);
      if (JSON.stringify(incomingDimensions) !== JSON.stringify(roomDimensions)) {
        roomDimensions = incomingDimensions;
        buildRoomGeometry();
        syncDimensionFields();
        resetCamera();
      }
      roomAssets = normalizeAssets(roomData.assets);

      await rebuildRoom(roomAssets);
      if (userKey !== currentRoomKey || roomView.classList.contains("hidden")) return;

      if (selectedAssetId) {
        const selectedAsset = roomAssets.find(
          (asset) => asset.id === selectedAssetId
        );

        if (selectedAsset) {
          renderSelectedPanel(
            selectedAsset,
            roomData?.connections?.[selectedAssetId] || {}
          );
        } else {
          clearSelection();
        }
      }
    }
  );
}

/* =========================================================
   THREE.JS SETUP
   ========================================================= */

const canvas = $("#threeCanvas");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false
});

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, 2)
);

renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbababa);

const camera = new THREE.PerspectiveCamera(
  45,
  1,
  0.1,
  100
);

camera.position.set(7, 5.3, 8);

const orbit = new OrbitControls(camera, canvas);

orbit.enableDamping = true;
orbit.target.set(0, 1.7, 0);
orbit.minDistance = 4;
orbit.maxDistance = 18;
orbit.maxPolarAngle = Math.PI * 0.49;

const transform = new TransformControls(
  camera,
  canvas
);

scene.add(transform);
let uniformScaleStart = null;
let applyingUniformScale = false;
function proportionalScale(start, changed) {
  const ratios = changed.map((value, index) => value / (start[index] || 1));
  const factor = ratios.reduce((best, ratio) => Math.abs(ratio - 1) > Math.abs(best - 1) ? ratio : best, 1);
  return start.map(value => value * Math.max(.05, factor));
}
transform.addEventListener('objectChange', () => {
  if (applyingUniformScale || !uniformScaleStart || transform.getMode() !== 'scale' || !selectedObject) return;
  applyingUniformScale = true;
  selectedObject.scale.fromArray(proportionalScale(uniformScaleStart, selectedObject.scale.toArray()));
  applyingUniformScale = false;
});

transform.addEventListener(
  "dragging-changed",
  (event) => {
    orbit.enabled = !event.value;
    if (event.value) {
      uniformScaleStart = transform.getMode() === 'scale' && selectedObject
        ? selectedObject.scale.toArray() : null;
    } else {
      uniformScaleStart = null;
    }

    if (
      !event.value &&
      isOwner() &&
      selectedObject &&
      selectedAssetId
    ) {
      persistSelectedTransform();
    }
  }
);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const roomGroup = new THREE.Group();
const assetGroup = new THREE.Group();

scene.add(roomGroup);
scene.add(assetGroup);

buildRoomGeometry();

/* =========================================================
   3D ROOM
   ========================================================= */

function buildRoomGeometry() {
  for (const child of [...roomGroup.children]) {roomGroup.remove(child);disposeObject(child);}
  const {x:w,y:h,z:d}=roomDimensions;
  const t=.18;
  const wallMaterial=new THREE.MeshStandardMaterial({color:0xe2e2e2,roughness:1});
  const floorMaterial=new THREE.MeshStandardMaterial({color:0xd2d2d2,roughness:1});
  function slab(width,height,depth,x,y,z,material) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);
    mesh.position.set(x,y,z);roomGroup.add(mesh);
    const outline=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:0x888888,transparent:true,opacity:.45}));
    mesh.add(outline);return mesh;
  }
  // All existing room surfaces have solid thickness extending outside the interior.
  slab(w+2*t,t,d+t,0,-t/2,-t/2,floorMaterial);
  slab(w+2*t,h,t,0,h/2,-d/2-t/2,wallMaterial);
  slab(t,h,d,-w/2-t/2,h/2,0,wallMaterial);
  slab(t,h,d,w/2+t/2,h/2,0,wallMaterial);
  const points=[];
  for(let x=-w/2;x<=w/2+.001;x+=.5) points.push(new THREE.Vector3(x,.012,-d/2),new THREE.Vector3(x,.012,d/2));
  for(let z=-d/2;z<=d/2+.001;z+=.5) points.push(new THREE.Vector3(-w/2,.012,z),new THREE.Vector3(w/2,.012,z));
  for(let x=-w/2;x<=w/2+.001;x+=.5) points.push(new THREE.Vector3(x,0,-d/2+.012),new THREE.Vector3(x,h,-d/2+.012));
  for(let y=0;y<=h+.001;y+=.5) points.push(new THREE.Vector3(-w/2,y,-d/2+.012),new THREE.Vector3(w/2,y,-d/2+.012));
  roomGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x787878,transparent:true,opacity:.18})));
  const windowW=Math.min(2.5,w*.4),windowH=Math.min(1.8,h*.4);
  const cx=w*.1,cy=h*.6,cz=-d/2+.045;
  slab(windowW,windowH,.05,cx,cy,cz,new THREE.MeshBasicMaterial({color:0x555555}));
  const frameMaterial=new THREE.MeshStandardMaterial({color:0x666666,roughness:1});
  const pieces=[[windowW+.16,.08,cx,cy+windowH/2],[windowW+.16,.08,cx,cy-windowH/2],[.08,windowH+.16,cx-windowW/2,cy],[.08,windowH+.16,cx+windowW/2,cy],[.05,windowH,cx,cy]];
  for(const [fw,fh,fx,fy] of pieces) slab(fw,fh,.08,fx,fy,cz+.04,frameMaterial);
}
// Lights are created once; resizing the room does not duplicate them.
const hemisphere=new THREE.HemisphereLight(0xffffff,0x444444,2.2);scene.add(hemisphere);
const keyLight=new THREE.DirectionalLight(0xffffff,2.6);keyLight.position.set(3,7,4);scene.add(keyLight);
const galleryLight=new THREE.PointLight(0xffffff,18,35);galleryLight.position.set(-2.5,3.8,1.5);scene.add(galleryLight);

/* =========================================================
   RENDER LOOP
   ========================================================= */

const roomRendering = createRoomRendering({
  renderer,scene,camera,orbit,canvas,wrap:$('#canvasWrap'),view:roomView,
  notice:$('#roomRenderNotice'),retry:$('#restoreRoomView'),resetCamera
});
function resizeRenderer() { roomRendering.frame(); }

window.addEventListener(
  "resize",
  resizeRenderer
);

function animate() {
  requestAnimationFrame(animate);

  if (!lobbyView.classList.contains("hidden")) lobbyModes.frame();
  if (!roomView.classList.contains("hidden")) {
    roomRendering.frame();
  }
}

animate();

/* =========================================================
   ASSET RENDERING
   ========================================================= */

async function rebuildRoom(assets) {
  const version = ++roomBuildVersion;
  const sorted = [...assets].sort((a,b)=>(a.order ?? 0)-(b.order ?? 0));
  const loaded = await Promise.all(sorted.map(async asset => {
    try { return {asset, object: await createCutoutObject(asset)}; }
    catch (error) { console.warn('Could not load memory', asset.id, error); return null; }
  }));
  if (version !== roomBuildVersion) {
    loaded.forEach(item=>item && disposeObject(item.object));
    return;
  }
  transform.detach();
  selectedObject = null;
  assetObjects.clear();
  for (const child of [...assetGroup.children]) { assetGroup.remove(child); disposeObject(child); }
  loaded.forEach(item=>{if(item){assetGroup.add(item.object);assetObjects.set(item.asset.id,item.object);}});
  if (selectedAssetId && assetObjects.has(selectedAssetId)) {
    selectedObject = assetObjects.get(selectedAssetId);
    if (isOwner()) transform.attach(selectedObject);
  }
}

function disposeObject(object) {
  const disposed = new Set();
  const release = resource => {if(resource && !disposed.has(resource)){disposed.add(resource);resource.dispose();}};
  object.traverse((child) => {
    if (child.geometry) {
      release(child.geometry);
    }

    if (child.material) {
      const materials =
        Array.isArray(child.material)
          ? child.material
          : [child.material];

      materials.forEach((material) => {
        if (material.map) {
          release(material.map);
        }

        release(material);
      });
    }
  });
}

async function createCutoutObject(asset) {
  const root = new THREE.Group();

  root.userData.assetId = asset.id;

  const texture =
    await makeCutoutTexture(
      asset.imageUrl
    );

  texture.colorSpace =
    THREE.SRGBColorSpace;

  const image = texture.image;

  const aspect =
    image?.width && image?.height
      ? image.width / image.height
      : 1;

  const targetHeight = 1.8;

  const targetWidth =
    Math.max(
      0.7,
      Math.min(
        2.8,
        targetHeight * aspect
      )
    );

  const material =
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.08,
      side: THREE.DoubleSide,
      depthWrite: true
    });

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(
      targetWidth,
      targetHeight
    ),
    material
  );

  mesh.userData.assetId = asset.id;
  root.add(mesh);
  addCutoutDepth(root, mesh, texture, targetWidth, targetHeight, asset.id);

  const position =
    asset.position || [0, 1.1, 0];

  const rotation =
    asset.rotation || [0, 0, 0];

  const scale =
    asset.scale || [1, 1, 1];

  root.position.fromArray(position);

  root.rotation.set(
    rotation[0],
    rotation[1],
    rotation[2]
  );

  root.scale.fromArray(scale);

  return root;
}

// Extrude the alpha silhouette into a thin volume; front/back remain illustrated images.
function addCutoutDepth(parent, front, texture, width, height, assetId) {
  const depth = .16;
  const origin = front.position.clone();
  front.position.z += depth / 2;
  const back = new THREE.Mesh(front.geometry, front.material.clone());
  back.material.color.setHex(0x999999);
  back.position.copy(origin);back.position.z -= depth / 2;
  if(assetId) back.userData.assetId=assetId;
  parent.add(back);
  const vertices=[];
  let pixels=null;
  const size=128;
  try {
    const mask=document.createElement('canvas');mask.width=mask.height=size;
    const context=mask.getContext('2d',{willReadFrequently:true});
    context.drawImage(texture.image,0,0,size,size);
    pixels=context.getImageData(0,0,size,size).data;
  } catch(error) { /* Cross-origin fallback uses a rectangular edge. */ }
  const solid=(x,y)=>x>=0&&y>=0&&x<size&&y<size&&(!pixels||pixels[(y*size+x)*4+3]>32);
  function edge(x1,y1,x2,y2) {
    const ax=(x1/size-.5)*width,ay=(.5-y1/size)*height;
    const bx=(x2/size-.5)*width,by=(.5-y2/size)*height;
    vertices.push(ax,ay,depth/2,bx,by,depth/2,bx,by,-depth/2,ax,ay,depth/2,bx,by,-depth/2,ax,ay,-depth/2);
  }
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) if(solid(x,y)) {
    if(!solid(x,y-1)) edge(x,y,x+1,y);
    if(!solid(x+1,y)) edge(x+1,y,x+1,y+1);
    if(!solid(x,y+1)) edge(x+1,y+1,x,y+1);
    if(!solid(x-1,y)) edge(x,y+1,x,y);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  const sides=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x888888,roughness:1,side:THREE.DoubleSide}));
  sides.position.copy(origin);
  if(assetId) sides.userData.assetId=assetId;
  parent.add(sides);
}

async function makeCutoutTexture(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    const bitmap =
      await createImageBitmap(blob);

    const canvas =
      document.createElement("canvas");

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context =
      canvas.getContext(
        "2d",
        { willReadFrequently: true }
      );

    context.drawImage(
      bitmap,
      0,
      0
    );

    const imageData =
      context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

    const data = imageData.data;

    for (
      let i = 0;
      i < data.length;
      i += 4
    ) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const greenDominance =
        g - Math.max(r, b);

      if (
        g > 110 &&
        greenDominance > 35
      ) {
        const strength =
          Math.min(
            1,
            Math.max(
              0,
              (greenDominance - 35) / 120
            )
          );

        data[i + 3] =
          Math.round(
            255 * (1 - strength)
          );
      }
    }

    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722);
      data[i] = data[i + 1] = data[i + 2] = gray;
    }

    context.putImageData(
      imageData,
      0,
      0
    );

    const texture =
      new THREE.CanvasTexture(canvas);

    texture.needsUpdate = true;

    return texture;
  } catch (error) {
    console.warn(
      "Chroma key failed; using original image.",
      error
    );

    return await new Promise(
      (resolve, reject) => {
        new THREE.TextureLoader().load(
          url,
          resolve,
          undefined,
          reject
        );
      }
    );
  }
}

/* =========================================================
   SELECT OBJECTS
   ========================================================= */

canvas.addEventListener(
  "pointerdown",
  (event) => {
    if (transform.dragging) return;

    const rect =
      canvas.getBoundingClientRect();

    mouse.x =
      ((event.clientX - rect.left) /
        rect.width) *
        2 -
      1;

    mouse.y =
      -(
        (event.clientY - rect.top) /
        rect.height
      ) *
        2 +
      1;

    raycaster.setFromCamera(
      mouse,
      camera
    );

    const meshes = [];

    assetGroup.traverse((object) => {
      if (
        object.isMesh &&
        object.userData.assetId
      ) {
        meshes.push(object);
      }
    });

    const hits =
      raycaster.intersectObjects(
        meshes,
        false
      );

    if (!hits.length) {
      clearSelection();
      return;
    }

    const assetId =
      hits[0].object.userData.assetId;

    selectAsset(assetId);
  }
);

function selectAsset(assetId) {
  selectedAssetId = assetId;

  selectedObject =
    assetObjects.get(assetId) || null;

  if (
    isOwner() &&
    selectedObject
  ) {
    transform.attach(
      selectedObject
    );
  } else {
    transform.detach();
  }

  const asset =
    roomAssets.find(
      (item) =>
        item.id === assetId
    );

  if (!asset) return;

  const roomData =
    allUsers[currentRoomKey] || {};

  const connections =
    roomData?.connections?.[assetId] ||
    {};

  renderSelectedPanel(
    asset,
    connections
  );
}

function clearSelection() {
  selectedAssetId = null;
  selectedObject = null;

  transform.detach();
  clearSelectedPanel();
}

function clearSelectedPanel() {
  selectedEmpty.classList.remove(
    "hidden"
  );

  selectedInfo.classList.add(
    "hidden"
  );

  connectionInput.value = "";
  connectionList.innerHTML = "";
}

function renderSelectedPanel(
  asset,
  connections
) {
  selectedEmpty.classList.add(
    "hidden"
  );

  selectedInfo.classList.remove(
    "hidden"
  );

  selectedPreview.src =
    asset.imageUrl || "";

  selectedPrompt.textContent =
    asset.prompt ||
    "Untitled memory";

  selectedTime.textContent =
    formatDate(asset.timestamp);

  const entries =
    Object.entries(
      connections || {}
    ).sort(
      (a, b) =>
        (b[1]?.timestamp || 0) -
        (a[1]?.timestamp || 0)
    );

  if (!entries.length) {
    connectionList.innerHTML = `
      <div class="selected-empty">
        No connections yet.
      </div>
    `;

    return;
  }

  connectionList.innerHTML =
    entries
      .map(
        ([, connection]) => `
          <div class="connection">
            <strong>
              ${escapeHTML(
                connection.fromName ||
                "Someone"
              )}
            </strong>

            <time>
              ${escapeHTML(
                formatDate(
                  connection.timestamp
                )
              )}
            </time>

            <p>
              ${escapeHTML(
                connection.text || ""
              )}
            </p>
          </div>
        `
      )
      .join("");
}

/* =========================================================
   OWNER TRANSFORM CONTROLS
   ========================================================= */

document
  .querySelectorAll("button.tool-btn[data-mode]")
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const mode =
          button.dataset.mode;

        if (!["translate", "rotate", "scale"].includes(mode)) return;
        transform.setMode(mode);

        document
          .querySelectorAll(
            "button.tool-btn[data-mode]"
          )
          .forEach((otherButton) => {
            otherButton.classList.remove(
              "active"
            );
            otherButton.setAttribute("aria-pressed", "false");
          });

        button.classList.add(
          "active"
        );
        button.setAttribute("aria-pressed", "true");
      }
    );
  });

async function persistSelectedTransform() {
  if (
    !selectedObject ||
    !selectedAssetId ||
    !isOwner()
  ) {
    return;
  }

  const patch = {
    position:
      selectedObject.position.toArray(),

    rotation: [
      selectedObject.rotation.x,
      selectedObject.rotation.y,
      selectedObject.rotation.z
    ],

    scale:
      selectedObject.scale.toArray()
  };

  await update(
    ref(
      db,
      assetPath(
        currentRoomKey,
        selectedAssetId
      )
    ),
    patch
  );
}

/* =========================================================
   AI IMAGE GENERATION
   ========================================================= */

addObjectBtn.addEventListener(
  "click",
  generateObject
);

promptInput.addEventListener(
  "keydown",
  (event) => {
    if (
      (event.metaKey ||
        event.ctrlKey) &&
      event.key === "Enter"
    ) {
      generateObject();
    }
  }
);

async function generateObject() {
  if (!isOwner() || addObjectBtn.disabled) return;
  const generationUserKey = currentUserKey;
  const generationUserName = currentUserName;

  const rawPrompt =
    promptInput.value.trim();

  if (!rawPrompt) {
    promptInput.focus();
    return;
  }

  addObjectBtn.disabled = true;

  setStatus(
    "Generating AI object…"
  );

  try {
    const generationPrompt = `
Draw one isolated memory object as a hand-drawn illustration, not a photograph.

Object or memory:
"${rawPrompt}"

Visual style:
- monochrome hand-drawn architectural illustration with a gentle cartoon quality
- clear fine black ink outlines with subtly irregular human-drawn strokes
- simplified but recognizable shapes and proportions
- white and light gray fills inside the object
- sparse pencil shading and delicate crosshatching for volume
- quiet sketchbook / illustrated dollhouse aesthetic
- front view or gentle three-quarter view, full object visible
- NOT photorealistic, NOT an archival photograph, NOT a glossy 3D render

Technical requirements:
- exactly one main object, centered, with a small margin
- uniform solid bright chroma green (#00FF00) background for cutout removal
- green must appear only outside the object's silhouette
- keep white and light gray interiors opaque, never transparent holes
- no grain, gradients, floor shadows or pencil marks on the green background
- no room, no scene, no extra props, no text, no border, no watermark
    `.trim();

    const result =
      await callProxy(
        MODEL,
        {
          prompt: generationPrompt,
          aspect_ratio: "1:1",
          output_format: "png"
        }
      );

    const imageUrl =
      extractImageUrl(result);

    if (!imageUrl) {
      console.log(
        "Full AI response:",
        result
      );

      throw new Error(
        "No image URL found in AI response."
      );
    }

    const newAssetRef =
      push(
        ref(
          db,
          `${roomPath(
            generationUserKey
          )}/assets`
        )
      );

    const id =
      newAssetRef.key;

    const index =
      roomAssets.length;

    const asset = {
      id,
      user: generationUserName,
      prompt: rawPrompt,
      imageUrl,

      position: [
        -1.5 +
          (index % 4) * 1.0,
        1.05 +
          (index % 2) * 0.15,
        -0.5 +
          Math.floor(index / 4) *
            0.4
      ],

      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      order: index,
      timestamp: Date.now()
    };

    await set(
      newAssetRef,
      asset
    );

    promptInput.value = "";
    if (currentRoomKey === generationUserKey) selectedAssetId = id;

    setStatus(
      "Saved to Firebase."
    );
  } catch (error) {
    console.error(error);

    setStatus(
      `Error: ${error.message}`
    );
  } finally {
    addObjectBtn.disabled = false;
  }
}

async function callProxy(
  model,
  input,
  signal
) {
  const body = {
    model,
    input
  };

  if (authToken) {
    body.authToken =
      authToken;
  }

  const response =
    await fetch(
      PROXY_URL,
      {
        method: "POST",
        signal,

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify(body)
      }
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `Proxy ${response.status}: ${text.slice(0, 180)}`
    );
  }

  return await response.json();
}

function extractImageUrl(result) {
  const candidates = [
    result,
    result?.output,
    result?.image,
    result?.url,
    result?.urls,
    result?.data,
    result?.data?.output
  ];

  for (const candidate of candidates) {
    const found =
      findFirstURL(candidate);

    if (found) return found;
  }

  return null;
}

function findFirstURL(value) {
  if (!value) return null;

  if (typeof value === "string") {
    if (
      value.startsWith("http") ||
      value.startsWith("data:image")
    ) {
      return value;
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found =
        findFirstURL(item);

      if (found) return found;
    }

    return null;
  }

  if (typeof value === "object") {
    for (
      const nestedValue
      of Object.values(value)
    ) {
      const found =
        findFirstURL(nestedValue);

      if (found) return found;
    }
  }

  return null;
}

/* =========================================================
   DELETE / CLEAR
   ========================================================= */

deleteBtn.addEventListener(
  "click",
  async () => {
    if (
      !isOwner() ||
      !selectedAssetId
    ) {
      return;
    }

    const id =
      selectedAssetId;

    clearSelection();

    await Promise.all([
      remove(
        ref(
          db,
          assetPath(
            currentUserKey,
            id
          )
        )
      ),

      remove(
        ref(
          db,
          `${roomPath(
            currentUserKey
          )}/connections/${id}`
        )
      )
    ]);
  }
);

clearBtn.addEventListener(
  "click",
  async () => {
    if (!isOwner()) return;

    const confirmed =
      confirm(
        "Delete every memory object in your apartment?"
      );

    if (!confirmed) return;

    clearSelection();

    await Promise.all([
      remove(
        ref(
          db,
          `${roomPath(
            currentUserKey
          )}/assets`
        )
      ),

      remove(
        ref(
          db,
          `${roomPath(
            currentUserKey
          )}/connections`
        )
      )
    ]);
  }
);

/* =========================================================
   SOCIAL CONNECTIONS
   ========================================================= */

connectionBtn.addEventListener(
  "click",
  async () => {
    if (!selectedAssetId) return;

    const text =
      connectionInput.value.trim();

    if (!text) {
      connectionInput.focus();
      return;
    }

    const newConnection =
      push(
        ref(
          db,
          `${roomPath(
            currentRoomKey
          )}/connections/${selectedAssetId}`
        )
      );

    await set(
      newConnection,
      {
        fromKey:
          currentUserKey,

        fromName:
          currentUserName,

        text,
        timestamp:
          Date.now()
      }
    );

    connectionInput.value = "";
  }
);

/* =========================================================
   MEMORY SEQUENCE
   ========================================================= */

playBtn.addEventListener(
  "click",
  playSequence
);

async function playSequence() {
  if (!roomAssets.length || playBtn.disabled) return;
  const sequence = ++sequenceVersion;

  const sorted =
    [...roomAssets].sort(
      (a, b) =>
        (a.order ?? 0) -
        (b.order ?? 0)
    );

  playBtn.disabled = true;

  for (
    let index = 0;
    index < sorted.length;
    index++
  ) {
    if (sequence !== sequenceVersion) return;
    const asset = sorted[index];

    const object =
      assetObjects.get(asset.id);

    if (!object) continue;

    selectAsset(asset.id);

    const worldPosition =
      new THREE.Vector3();

    object.getWorldPosition(
      worldPosition
    );

    const targetPosition =
      worldPosition
        .clone()
        .add(
          new THREE.Vector3(
            3.0,
            2.0,
            4.2
          )
        );

    await tweenCamera(
      camera.position.clone(),
      targetPosition,
      orbit.target.clone(),
      worldPosition.clone(),
      700
    );

    if (sequence !== sequenceVersion) return;
    modeBadge.textContent =
      `Memory ${index + 1}/${sorted.length} · ${formatDate(asset.timestamp)}`;

    await wait(950);
    if (sequence !== sequenceVersion) return;
  }

  modeBadge.textContent =
    isOwner()
      ? "Composing your room"
      : `Visiting ${currentRoomName}`;

  playBtn.disabled = false;
}

function tweenCamera(
  fromPosition,
  toPosition,
  fromTarget,
  toTarget,
  duration
) {
  const sequence = sequenceVersion;
  return new Promise(
    (resolve) => {
      const start =
        performance.now();

      function step(now) {
        if (sequence !== sequenceVersion) { resolve(); return; }
        const progress =
          Math.min(
            1,
            (now - start) /
              duration
          );

        const eased =
          1 -
          Math.pow(
            1 - progress,
            3
          );

        camera.position
          .lerpVectors(
            fromPosition,
            toPosition,
            eased
          );

        orbit.target
          .lerpVectors(
            fromTarget,
            toTarget,
            eased
          );

        if (progress < 1) {
          requestAnimationFrame(
            step
          );
        } else {
          resolve();
        }
      }

      requestAnimationFrame(
        step
      );
    }
  );
}

function wait(milliseconds) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

/* =========================================================
   CAMERA
   ========================================================= */

resetViewBtn.addEventListener(
  "click",
  resetCamera
);

function resetCamera() {
  const {x,y,z}=roomDimensions;
  const factor=Math.max(x/8,y/5,z/7);
  camera.position.set(7*factor,5.3*factor,8*factor);
  orbit.target.set(0,y*.34,0);
  orbit.minDistance=2*factor;
  orbit.maxDistance=25*factor;
  orbit.update();
}

function syncDimensionFields() {
  for(const axis of ['x','y','z']) $(`#roomSize${axis.toUpperCase()}`).value=roomDimensions[axis];
}
$('#roomSizeBtn').addEventListener('click',()=>{
  syncDimensionFields();
  const hidden = $('#roomSizeControls').classList.toggle('hidden');
  $('#roomSizeBtn').setAttribute('aria-expanded',String(!hidden));
});
$('#saveRoomSizeBtn').addEventListener('click',async()=>{
  if(!isOwner()) return;
  const values={};
  for(const axis of ['x','y','z']) {
    const input=$(`#roomSize${axis.toUpperCase()}`);
    const value=Number(input.value);
    if(!Number.isFinite(value)||value<2||value>20){input.reportValidity();setStatus('Each dimension must be between 2 and 20.');return;}
    values[axis]=value;
  }
  const button=$('#saveRoomSizeBtn');if(button.disabled)return;
  const key=currentRoomKey;
  button.disabled=true;
  try {
    await set(ref(db,`${roomPath(key)}/dimensions`),values);
    if(currentRoomKey===key)setStatus('Room dimensions saved.');
  }catch(error){setStatus(`Could not resize room: ${error.message}`);}
  finally{button.disabled=false;}
});

/* =========================================================
   NEXT ROOM RECOMMENDATION
   70% = semantic neighbors (original word matching until the model is ready)
   30% = different/random
   ========================================================= */

nextRoomBtn.addEventListener(
  "click",
  () => {
    const next =
      chooseNextRoom();

    if (next) {
      openRoom(next);
    }
  }
);

function chooseNextRoom() {
  const candidates =
    Object.entries(allUsers)
      .filter(
        ([key]) =>
          key !== currentRoomKey
      );

  if (!candidates.length) {
    return null;
  }

  /* 30%:
     deliberately leave the filter bubble */
  if (Math.random() < 0.30) {
    return candidates[
      Math.floor(
        Math.random() *
        candidates.length
      )
    ][0];
  }

  const semanticNext = memorySpace.nearest(currentRoomKey)
    .find(item => candidates.some(([key]) => key === item.key));
  if (semanticNext) return semanticNext.key;

  const sourceWords =
    new Set(
      tokenizePrompts(
        normalizeAssets(
          allUsers[
            currentRoomKey
          ]?.assets
        )
      )
    );

  const scored =
    candidates.map(
      ([key, user]) => {
        const words =
          tokenizePrompts(
            normalizeAssets(
              user?.assets
            )
          );

        let overlap = 0;

        words.forEach(
          (word) => {
            if (
              sourceWords.has(word)
            ) {
              overlap += 1;
            }
          }
        );

        return {
          key,
          overlap
        };
      }
    );

  scored.sort(
    (a, b) =>
      b.overlap -
      a.overlap
  );

  const topScore =
    scored[0]?.overlap ?? 0;

  if (topScore === 0) {
    return scored[
      Math.floor(
        Math.random() *
        scored.length
      )
    ].key;
  }

  const top =
    scored.filter(
      (item) =>
        item.overlap === topScore
    );

  return top[
    Math.floor(
      Math.random() *
      top.length
    )
  ].key;
}

function tokenizePrompts(assets) {
  const stopWords =
    new Set([
      "a",
      "an",
      "the",
      "and",
      "or",
      "of",
      "to",
      "in",
      "on",
      "my",
      "from",
      "with",
      "this",
      "that",
      "old",
      "small",
      "big",
      "one",
      "memory"
    ]);

  return assets
    .flatMap((asset) =>
      String(
        asset.prompt || ""
      )
        .toLowerCase()
        .replace(
          /[^a-z0-9\s]/g,
          " "
        )
        .split(/\s+/)
    )
    .filter(
      (word) =>
        word.length > 2 &&
        !stopWords.has(word)
    );
}

/* =========================================================
   INITIAL VIEW
   ========================================================= */

showView(loginView);
