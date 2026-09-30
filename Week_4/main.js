import * as THREE from "three";

import {
    OrbitControls
} from "three/addons/controls/OrbitControls.js";

import {
    TransformControls
} from "three/addons/controls/TransformControls.js";


// =====================================================
// FIREBASE
// =====================================================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
    onValue
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";


// Your Firebase configuration

const firebaseConfig = {

    apiKey:
        "AIzaSyBDOmurEZq2J4T6NNheBtWKh-gI9UDL45Q",

    authDomain:
        "skyler-week4-memory-room.firebaseapp.com",

    databaseURL:
        "https://skyler-week4-memory-room-default-rtdb.firebaseio.com",

    projectId:
        "skyler-week4-memory-room",

    storageBucket:
        "skyler-week4-memory-room.firebasestorage.app",

    messagingSenderId:
        "799394138961",

    appId:
        "1:799394138961:web:be1f7c9bb93a4dde6de17e"

};


// Initialize Firebase

const firebaseApp =
    initializeApp(
        firebaseConfig
    );


const database =
    getDatabase(
        firebaseApp
    );


// For now we use one room.
// Later this can become a user-entered name.

const USER_NAME =
    "Skyler";


const roomRef =
    ref(
        database,
        `rooms/${USER_NAME}`
    );


console.log(
    "Firebase connected"
);


// =====================================================
// AI API
// =====================================================

const proxyUrl =
    "https://itp-ima-replicate-proxy.web.app/api/create_n_get";


// Leave empty unless teacher proxy requires login

let authToken = "";


// =====================================================
// DOM
// =====================================================

const app =
    document.getElementById("app");


const promptInput =
    document.getElementById(
        "promptInput"
    );


const generateBtn =
    document.getElementById(
        "generateBtn"
    );


const clearBtn =
    document.getElementById(
        "clearBtn"
    );


const statusText =
    document.getElementById(
        "status"
    );


const moveBtn =
    document.getElementById(
        "moveBtn"
    );


const rotateBtn =
    document.getElementById(
        "rotateBtn"
    );


const scaleBtn =
    document.getElementById(
        "scaleBtn"
    );


const deleteBtn =
    document.getElementById(
        "deleteBtn"
    );


const playBtn =
    document.getElementById(
        "playBtn"
    );


const resetCameraBtn =
    document.getElementById(
        "resetCameraBtn"
    );


const inspector =
    document.getElementById(
        "inspector"
    );


const selectedName =
    document.getElementById(
        "selectedName"
    );


const selectedMeta =
    document.getElementById(
        "selectedMeta"
    );


// =====================================================
// DATA
// =====================================================

let assets = [];


// Maps Firebase item ID
// to its Three.js object

const assetRoots =
    new Map();


let selectedId =
    null;


let transformDragging =
    false;


// When generating a new object,
// remember which one should be selected
// after Firebase reloads the room.

let pendingSelectId =
    null;


// =====================================================
// THREE.JS SCENE
// =====================================================

const scene =
    new THREE.Scene();


scene.background =
    new THREE.Color(
        0xd8d0c7
    );


// =====================================================
// CAMERA
// =====================================================

const camera =
    new THREE.PerspectiveCamera(

        45,

        window.innerWidth /
        window.innerHeight,

        0.1,

        100

    );


camera.position.set(
    7,
    5.5,
    9
);


// =====================================================
// RENDERER
// =====================================================

const renderer =
    new THREE.WebGLRenderer({

        antialias: true

    });


renderer.setSize(

    window.innerWidth,

    window.innerHeight

);


renderer.setPixelRatio(

    Math.min(
        window.devicePixelRatio,
        2
    )

);


renderer.shadowMap.enabled =
    true;


renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;


renderer.outputColorSpace =
    THREE.SRGBColorSpace;


app.appendChild(
    renderer.domElement
);


// =====================================================
// ORBIT CAMERA
// =====================================================

const orbit =
    new OrbitControls(

        camera,

        renderer.domElement

    );


orbit.enableDamping =
    true;


orbit.dampingFactor =
    0.06;


orbit.target.set(
    0,
    1.5,
    -0.5
);


orbit.minDistance =
    4;


orbit.maxDistance =
    18;


orbit.maxPolarAngle =
    Math.PI / 2.03;


// =====================================================
// TRANSFORM CONTROLS
// =====================================================

const transform =
    new TransformControls(

        camera,

        renderer.domElement

    );


transform.setMode(
    "translate"
);


transform.setSize(
    0.75
);


scene.add(
    transform
);


transform.addEventListener(

    "dragging-changed",

    event => {

        transformDragging =
            event.value;


        orbit.enabled =
            !event.value;


        /*
          User finished moving / rotating /
          scaling the object.
    
          Update JSON and save everything
          back to Firebase.
        */

        if (!event.value) {

            syncSelectedAsset();

            saveAssets();

        }

    }

);


transform.addEventListener(

    "objectChange",

    () => {

        syncSelectedAsset();

        updateInspector();

    }

);


// =====================================================
// LIGHTING
// =====================================================

const hemisphere =
    new THREE.HemisphereLight(

        0xfff6ea,

        0x655c55,

        2.2

    );


scene.add(
    hemisphere
);


const sunlight =
    new THREE.DirectionalLight(

        0xffe8cc,

        2.7

    );


sunlight.position.set(
    -4,
    8,
    6
);


sunlight.castShadow =
    true;


sunlight.shadow.mapSize.set(
    2048,
    2048
);


scene.add(
    sunlight
);


const warmLight =
    new THREE.PointLight(

        0xffba78,

        15,

        16

    );


warmLight.position.set(
    3,
    4,
    2
);


scene.add(
    warmLight
);


// =====================================================
// ROOM
// =====================================================

const wallMaterial =
    new THREE.MeshStandardMaterial({

        color:
            0xd7cabb,

        roughness:
            0.92

    });


const floorMaterial =
    new THREE.MeshStandardMaterial({

        color:
            0xa98461,

        roughness:
            0.8

    });


// FLOOR

const floor =
    new THREE.Mesh(

        new THREE.BoxGeometry(
            10,
            0.15,
            8
        ),

        floorMaterial

    );


floor.position.set(
    0,
    -0.075,
    0
);


floor.receiveShadow =
    true;


scene.add(
    floor
);


// BACK WALL

const backWall =
    new THREE.Mesh(

        new THREE.BoxGeometry(
            10,
            5,
            0.15
        ),

        wallMaterial

    );


backWall.position.set(
    0,
    2.5,
    -4
);


backWall.receiveShadow =
    true;


scene.add(
    backWall
);


// LEFT WALL

const leftWall =
    new THREE.Mesh(

        new THREE.BoxGeometry(
            0.15,
            5,
            8
        ),

        wallMaterial

    );


leftWall.position.set(
    -5,
    2.5,
    0
);


leftWall.receiveShadow =
    true;


scene.add(
    leftWall
);


// RIGHT WALL

const rightWall =
    new THREE.Mesh(

        new THREE.BoxGeometry(
            0.15,
            5,
            8
        ),

        wallMaterial

    );


rightWall.position.set(
    5,
    2.5,
    0
);


rightWall.receiveShadow =
    true;


scene.add(
    rightWall
);


// GRID

const grid =
    new THREE.GridHelper(

        10,

        10,

        0x765c48,

        0xb99d82

    );


grid.position.y =
    0.01;


grid.material.opacity =
    0.22;


grid.material.transparent =
    true;


scene.add(
    grid
);


// =====================================================
// WINDOW
// =====================================================

const windowFrame =
    new THREE.Mesh(

        new THREE.BoxGeometry(
            2.5,
            2,
            0.08
        ),

        new THREE.MeshStandardMaterial({

            color:
                0x594e47

        })

    );


windowFrame.position.set(
    -2.6,
    2.8,
    -3.88
);


scene.add(
    windowFrame
);


const windowGlass =
    new THREE.Mesh(

        new THREE.PlaneGeometry(
            2.14,
            1.64
        ),

        new THREE.MeshStandardMaterial({

            color:
                0xa7cad8,

            emissive:
                0x54747d,

            emissiveIntensity:
                0.28

        })

    );


windowGlass.position.set(
    -2.6,
    2.8,
    -3.82
);


scene.add(
    windowGlass
);


// =====================================================
// FIREBASE SAVE
// =====================================================

async function saveAssets() {

    try {

        /*
          Firebase treats null as deleting
          the database path.
    
          This is useful when the room
          becomes empty.
        */

        const value =
            assets.length > 0
                ? assets
                : null;


        await set(
            roomRef,
            value
        );


        console.log(
            "Saved to Firebase:",
            assets
        );

    }

    catch (error) {

        console.error(
            "Firebase save error:",
            error
        );


        statusText.textContent =
            "Firebase save failed.";

    }

}


// =====================================================
// HELPERS
// =====================================================

function createId() {

    if (
        window.crypto &&
        crypto.randomUUID
    ) {

        return (
            crypto.randomUUID()
        );

    }


    return (

        Date.now() +
        "-" +
        Math.floor(
            Math.random() *
            100000
        )

    );

}


function getAsset(id) {

    return assets.find(

        asset =>
            asset.id === id

    );

}


function getRoot(id) {

    return assetRoots.get(
        id
    );

}


// =====================================================
// NORMALIZE FIREBASE DATA
// =====================================================

function normalizeFirebaseData(

    value

) {

    if (!value) {

        return [];

    }


    /*
      Firebase can sometimes return
      an Array and sometimes an Object
      with numeric keys.
  
      Convert both forms into one array.
    */

    let result;


    if (
        Array.isArray(value)
    ) {

        result =
            value.filter(Boolean);

    }

    else {

        result =
            Object.values(
                value
            ).filter(Boolean);

    }


    result.sort(

        (
            a,
            b
        ) =>

            (a.order || 0) -
            (b.order || 0)

    );


    return result;

}


// =====================================================
// AI PROXY
// =====================================================

async function callProxy(

    model,

    input

) {

    const headers = {

        "Content-Type":
            "application/json",

        "Accept":
            "application/json"

    };


    if (authToken) {

        headers.Authorization =
            `Bearer ${authToken}`;

    }


    const response =
        await fetch(

            proxyUrl,

            {

                method:
                    "POST",

                headers,

                body:
                    JSON.stringify({

                        model,

                        input

                    })

            }

        );


    let prediction;


    try {

        prediction =
            await response.json();

    }

    catch (error) {

        throw new Error(
            "Proxy returned invalid JSON."
        );

    }


    console.log(
        model,
        prediction
    );


    if (!response.ok) {

        console.error(
            "Proxy error:",
            prediction
        );


        throw new Error(

            "API request failed: " +
            response.status

        );

    }


    return prediction;

}


// =====================================================
// GET IMAGE URL
// =====================================================

function getImageURL(

    prediction

) {

    const output =
        prediction.output;


    if (
        typeof output ===
        "string"
    ) {

        return output;

    }


    if (
        Array.isArray(output)
    ) {

        return output[0];

    }


    if (
        output &&
        typeof output ===
        "object" &&
        output.url
    ) {

        return output.url;

    }


    return null;

}


// =====================================================
// NORMAL IMAGE FALLBACK
// =====================================================

function loadNormalTexture(

    imageUrl

) {

    return new Promise(

        (
            resolve,
            reject
        ) => {


            const loader =
                new THREE.TextureLoader();


            loader.setCrossOrigin(
                "anonymous"
            );


            loader.load(

                imageUrl,


                texture => {


                    texture.colorSpace =
                        THREE.SRGBColorSpace;


                    resolve({

                        texture,

                        width:
                            texture.image.width,

                        height:
                            texture.image.height

                    });

                },


                undefined,


                reject

            );

        }

    );

}


// =====================================================
// GREEN SCREEN CUTOUT
// =====================================================

async function makeCutoutTexture(

    imageUrl

) {

    try {

        const response =
            await fetch(
                imageUrl
            );


        const blob =
            await response.blob();


        const bitmap =
            await createImageBitmap(
                blob
            );


        const maxDimension =
            900;


        const resizeScale =

            Math.min(

                1,

                maxDimension /
                Math.max(
                    bitmap.width,
                    bitmap.height
                )

            );


        const width =
            Math.round(

                bitmap.width *
                resizeScale

            );


        const height =
            Math.round(

                bitmap.height *
                resizeScale

            );


        const canvas =
            document.createElement(
                "canvas"
            );


        canvas.width =
            width;


        canvas.height =
            height;


        const context =
            canvas.getContext(
                "2d",
                {
                    willReadFrequently:
                        true
                }
            );


        context.drawImage(

            bitmap,

            0,
            0,

            width,
            height

        );


        bitmap.close();


        const imageData =
            context.getImageData(

                0,
                0,

                width,
                height

            );


        const pixels =
            imageData.data;


        /*
          Remove bright green pixels
          to create transparency.
        */

        for (

            let i = 0;

            i < pixels.length;

            i += 4

        ) {

            const r =
                pixels[i];

            const g =
                pixels[i + 1];

            const b =
                pixels[i + 2];


            const greenDominant =

                g > 90 &&

                g > r * 1.22 &&

                g > b * 1.22;


            if (greenDominant) {

                const dominance =

                    g -
                    Math.max(
                        r,
                        b
                    );


                pixels[i + 3] =

                    THREE.MathUtils.clamp(

                        255 -
                        dominance * 4,

                        0,

                        255

                    );


                /*
                  Reduce green spill
                  around object edges.
                */

                if (
                    pixels[i + 3] > 0
                ) {

                    pixels[i + 1] =

                        Math.min(

                            pixels[i + 1],

                            Math.max(
                                r,
                                b
                            ) + 25

                        );

                }

            }

        }


        context.putImageData(

            imageData,

            0,
            0

        );


        const texture =
            new THREE.CanvasTexture(
                canvas
            );


        texture.colorSpace =
            THREE.SRGBColorSpace;


        texture.needsUpdate =
            true;


        return {

            texture,

            width,

            height

        };

    }

    catch (error) {

        console.warn(
            "Green screen removal failed:",
            error
        );


        return await loadNormalTexture(
            imageUrl
        );

    }

}


// =====================================================
// CREATE CUTOUT OBJECT
// =====================================================

async function loadCutout(

    asset

) {

    const result =
        await makeCutoutTexture(
            asset.imageUrl
        );


    const texture =
        result.texture;


    const aspect =

        result.width /
        result.height;


    let width;
    let height;


    if (
        aspect >= 1
    ) {

        width =
            1.8;

        height =
            1.8 /
            aspect;

    }

    else {

        height =
            1.8;

        width =
            1.8 *
            aspect;

    }


    const geometry =
        new THREE.PlaneGeometry(

            width,

            height

        );


    const material =
        new THREE.MeshBasicMaterial({

            map:
                texture,

            transparent:
                true,

            alphaTest:
                0.04,

            side:
                THREE.DoubleSide

        });


    const plane =
        new THREE.Mesh(

            geometry,

            material

        );


    const root =
        new THREE.Group();


    root.userData.assetId =
        asset.id;


    root.name =
        asset.prompt;


    plane.position.y =
        height / 2;


    root.add(
        plane
    );


    // position

    if (
        asset.position
    ) {

        root.position.fromArray(
            asset.position
        );

    }


    // rotation

    if (
        asset.rotation
    ) {

        root.rotation.set(

            asset.rotation[0],

            asset.rotation[1],

            asset.rotation[2]

        );

    }


    // scale

    if (
        asset.scale
    ) {

        root.scale.fromArray(
            asset.scale
        );

    }


    scene.add(
        root
    );


    assetRoots.set(

        asset.id,

        root

    );


    return root;

}


// =====================================================
// GENERATE OBJECT
// =====================================================

async function generateObject(

    userPrompt

) {

    generateBtn.disabled =
        true;


    statusText.textContent =
        "Generating memory object...";


    try {


        const generationPrompt = `

A single ${userPrompt}.

One isolated object only.

Full object visible.

Centered composition.

Front three-quarter view.

Realistic object photography.

The object stands alone
in front of a completely flat
bright chroma key green background.

Pure green background.

No room.

No scenery.

No other objects.

No text.

No border.

Clean silhouette.

Avoid green colors on the object
unless absolutely necessary.

    `.trim();


        const prediction =
            await callProxy(

                "google/nano-banana-2",

                {

                    prompt:
                        generationPrompt,

                    aspect_ratio:
                        "1:1"

                }

            );


        const imageUrl =
            getImageURL(
                prediction
            );


        if (!imageUrl) {

            throw new Error(
                "No image returned."
            );

        }


        console.log(
            "Generated image:",
            imageUrl
        );


        const asset = {

            id:
                createId(),

            user:
                USER_NAME,

            prompt:
                userPrompt,

            imageUrl:
                imageUrl,

            position: [

                (
                    Math.random() -
                    0.5
                ) * 4.5,

                0,

                (
                    Math.random() -
                    0.5
                ) * 3

            ],

            rotation: [

                0,

                (
                    Math.random() -
                    0.5
                ) * 0.35,

                0

            ],

            scale: [
                1,
                1,
                1
            ],

            order:
                assets.length + 1,

            timestamp:
                Date.now()

        };


        /*
          Add locally first,
          then Firebase becomes
          the permanent source of truth.
        */

        assets.push(
            asset
        );


        pendingSelectId =
            asset.id;


        statusText.textContent =
            "Saving to Firebase...";


        await saveAssets();


        statusText.textContent =
            "Memory saved to Firebase.";


    }

    catch (error) {

        console.error(
            "Generation error:",
            error
        );


        statusText.textContent =
            "Generation failed. Check Console.";

    }

    finally {

        generateBtn.disabled =
            false;

    }

}


// =====================================================
// CLEAR RENDERED OBJECTS
// =====================================================

function disposeRoot(

    root

) {

    root.traverse(

        child => {

            if (
                child.geometry
            ) {

                child.geometry.dispose();

            }


            if (
                child.material
            ) {

                const materials =

                    Array.isArray(
                        child.material
                    )

                        ? child.material

                        : [child.material];


                materials.forEach(

                    material => {

                        if (
                            material.map
                        ) {

                            material.map.dispose();

                        }


                        material.dispose();

                    }

                );

            }

        }

    );

}


// =====================================================
// REBUILD ROOM FROM FIREBASE
// =====================================================

async function rebuildRoom() {

    transform.detach();


    selectedId =
        null;


    inspector.classList.remove(
        "visible"
    );


    assetRoots.forEach(

        root => {

            scene.remove(
                root
            );


            disposeRoot(
                root
            );

        }

    );


    assetRoots.clear();


    if (
        assets.length === 0
    ) {

        statusText.textContent =
            "Firebase room is empty.";

        return;

    }


    statusText.textContent =
        "Loading room from Firebase...";


    let loaded =
        0;


    for (
        const asset
        of assets
    ) {

        try {

            await loadCutout(
                asset
            );


            loaded++;

        }

        catch (error) {

            console.error(

                "Could not load:",

                asset.prompt,

                error

            );

        }

    }


    statusText.textContent =

        `Loaded ${loaded} memories from Firebase.`;


    /*
      Select newly generated item
      after Firebase reload.
    */

    if (
        pendingSelectId &&
        assetRoots.has(
            pendingSelectId
        )
    ) {

        selectAsset(
            pendingSelectId
        );


        pendingSelectId =
            null;

    }

}


// =====================================================
// FIREBASE REALTIME LISTENER
// =====================================================

onValue(

    roomRef,

    async snapshot => {


        const value =
            snapshot.val();


        assets =
            normalizeFirebaseData(
                value
            );


        console.log(
            "Firebase update:",
            assets
        );


        await rebuildRoom();

    },


    error => {

        console.error(
            "Firebase read error:",
            error
        );


        statusText.textContent =
            "Could not read Firebase.";

    }

);


// =====================================================
// RAYCAST SELECTION
// =====================================================

const raycaster =
    new THREE.Raycaster();


const pointer =
    new THREE.Vector2();


function findAssetRoot(

    object

) {

    let current =
        object;


    while (current) {


        if (
            current.userData &&
            current.userData.assetId
        ) {

            return current;

        }


        current =
            current.parent;

    }


    return null;

}


renderer.domElement.addEventListener(

    "pointerdown",

    event => {


        if (
            transformDragging ||
            transform.axis
        ) {

            return;

        }


        pointer.x =

            (
                event.clientX /
                window.innerWidth
            ) * 2 - 1;


        pointer.y =

            -(
                event.clientY /
                window.innerHeight
            ) * 2 + 1;


        raycaster.setFromCamera(

            pointer,

            camera

        );


        const roots =

            Array.from(
                assetRoots.values()
            );


        const intersections =

            raycaster.intersectObjects(

                roots,

                true

            );


        if (
            intersections.length === 0
        ) {

            deselectAsset();

            return;

        }


        const root =

            findAssetRoot(

                intersections[0].object

            );


        if (root) {

            selectAsset(

                root.userData.assetId

            );

        }

    }

);


// =====================================================
// SELECT OBJECT
// =====================================================

function selectAsset(

    id

) {

    selectedId =
        id;


    const root =
        getRoot(
            id
        );


    if (!root) {

        return;

    }


    transform.attach(
        root
    );


    updateInspector();

}


function deselectAsset() {

    selectedId =
        null;


    transform.detach();


    inspector.classList.remove(
        "visible"
    );

}


// =====================================================
// INSPECTOR
// =====================================================

function updateInspector() {

    if (!selectedId) {

        inspector.classList.remove(
            "visible"
        );

        return;

    }


    const asset =
        getAsset(
            selectedId
        );


    const root =
        getRoot(
            selectedId
        );


    if (
        !asset ||
        !root
    ) {

        return;

    }


    inspector.classList.add(
        "visible"
    );


    selectedName.textContent =
        asset.prompt;


    const time =

        new Date(
            asset.timestamp
        );


    selectedMeta.innerHTML =

        `Memory #${asset.order}<br>
     ${time.toLocaleTimeString()}<br><br>
     X ${root.position.x.toFixed(2)}
     &nbsp;
     Y ${root.position.y.toFixed(2)}
     &nbsp;
     Z ${root.position.z.toFixed(2)}`;

}


// =====================================================
// TRANSFORM -> JSON
// =====================================================

function syncSelectedAsset() {

    if (!selectedId) {

        return;

    }


    const asset =
        getAsset(
            selectedId
        );


    const root =
        getRoot(
            selectedId
        );


    if (
        !asset ||
        !root
    ) {

        return;

    }


    asset.position =
        root.position.toArray();


    asset.rotation = [

        root.rotation.x,

        root.rotation.y,

        root.rotation.z

    ];


    asset.scale =
        root.scale.toArray();

}


// =====================================================
// TRANSFORM MODES
// =====================================================

function setTransformMode(

    mode

) {

    transform.setMode(
        mode
    );


    moveBtn.classList.remove(
        "active"
    );


    rotateBtn.classList.remove(
        "active"
    );


    scaleBtn.classList.remove(
        "active"
    );


    if (
        mode ===
        "translate"
    ) {

        moveBtn.classList.add(
            "active"
        );

    }


    if (
        mode ===
        "rotate"
    ) {

        rotateBtn.classList.add(
            "active"
        );

    }


    if (
        mode ===
        "scale"
    ) {

        scaleBtn.classList.add(
            "active"
        );

    }

}


moveBtn.addEventListener(

    "click",

    () => {

        setTransformMode(
            "translate"
        );

    }

);


rotateBtn.addEventListener(

    "click",

    () => {

        setTransformMode(
            "rotate"
        );

    }

);


scaleBtn.addEventListener(

    "click",

    () => {

        setTransformMode(
            "scale"
        );

    }

);


// =====================================================
// DELETE
// =====================================================

deleteBtn.addEventListener(

    "click",

    async () => {


        if (!selectedId) {

            return;

        }


        const deletingId =
            selectedId;


        assets =
            assets.filter(

                asset =>
                    asset.id !==
                    deletingId

            );


        /*
          Re-number sequence after deletion
        */

        assets.forEach(

            (
                asset,
                index
            ) => {

                asset.order =
                    index + 1;

            }

        );


        selectedId =
            null;


        transform.detach();


        statusText.textContent =
            "Deleting from Firebase...";


        await saveAssets();

    }

);


// =====================================================
// CLEAR ROOM
// =====================================================

clearBtn.addEventListener(

    "click",

    async () => {


        const yes =
            confirm(
                "Clear the whole memory room?"
            );


        if (!yes) {

            return;

        }


        selectedId =
            null;


        transform.detach();


        assets = [];


        statusText.textContent =
            "Clearing Firebase room...";


        await saveAssets();

    }

);


// =====================================================
// GENERATE BUTTON
// =====================================================

generateBtn.addEventListener(

    "click",

    () => {


        const prompt =

            promptInput
                .value
                .trim();


        if (!prompt) {

            return;

        }


        generateObject(
            prompt
        );


        promptInput.value =
            "";

    }

);


promptInput.addEventListener(

    "keydown",

    event => {


        if (
            event.key ===
            "Enter"
        ) {

            generateBtn.click();

        }

    }

);


// =====================================================
// RESET CAMERA
// =====================================================

resetCameraBtn.addEventListener(

    "click",

    () => {


        camera.position.set(
            7,
            5.5,
            9
        );


        orbit.target.set(
            0,
            1.5,
            -0.5
        );


        orbit.update();

    }

);


// =====================================================
// SEQUENCE
// =====================================================

function wait(ms) {

    return new Promise(

        resolve =>

            setTimeout(
                resolve,
                ms
            )

    );

}


playBtn.addEventListener(

    "click",

    async () => {


        if (
            assets.length === 0
        ) {

            return;

        }


        transform.detach();


        const ordered =

            [...assets].sort(

                (
                    a,
                    b
                ) =>

                    a.order -
                    b.order

            );


        playBtn.disabled =
            true;


        statusText.textContent =
            "Playing memory sequence...";


        for (
            const asset
            of ordered
        ) {


            const root =
                getRoot(
                    asset.id
                );


            if (!root) {

                continue;

            }


            selectedName.textContent =
                asset.prompt;


            const time =
                new Date(
                    asset.timestamp
                );


            selectedMeta.innerHTML =

                `Memory #${asset.order}<br>
         ${time.toLocaleTimeString()}`;


            inspector.classList.add(
                "visible"
            );


            const originalScale =
                root.scale.clone();


            root.scale.multiplyScalar(
                1.25
            );


            orbit.target.lerp(

                root.position,

                0.55

            );


            await wait(
                1100
            );


            root.scale.copy(
                originalScale
            );


            await wait(
                250
            );

        }


        inspector.classList.remove(
            "visible"
        );


        playBtn.disabled =
            false;


        statusText.textContent =
            "Sequence complete.";

    }

);


// =====================================================
// KEYBOARD SHORTCUTS
// =====================================================

window.addEventListener(

    "keydown",

    event => {


        if (
            event.target ===
            promptInput
        ) {

            return;

        }


        if (
            event.key === "1"
        ) {

            setTransformMode(
                "translate"
            );

        }


        if (
            event.key === "2"
        ) {

            setTransformMode(
                "rotate"
            );

        }


        if (
            event.key === "3"
        ) {

            setTransformMode(
                "scale"
            );

        }


        if (
            event.key ===
            "Delete" ||
            event.key ===
            "Backspace"
        ) {

            deleteBtn.click();

        }

    }

);


// =====================================================
// RESIZE
// =====================================================

window.addEventListener(

    "resize",

    () => {


        camera.aspect =

            window.innerWidth /
            window.innerHeight;


        camera.updateProjectionMatrix();


        renderer.setSize(

            window.innerWidth,

            window.innerHeight

        );

    }

);


// =====================================================
// ANIMATION LOOP
// =====================================================

function animate() {

    requestAnimationFrame(
        animate
    );


    orbit.update();


    renderer.render(

        scene,

        camera

    );

}


animate();