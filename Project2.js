// Project2 Shutao He 3639082

const VSHADER_SOURCE = `
    attribute vec3 a_Position;
    uniform mat4 u_Model;
    uniform mat4 u_World;
    uniform mat4 u_Camera;
    uniform mat4 u_CameraRo;
    uniform mat4 u_Projection;
    attribute vec3 a_Color;
    varying vec3 v_Color;
    void main() {
        gl_Position = u_Projection * u_CameraRo * u_Camera * u_World * u_Model * vec4(a_Position, 1.0);
        v_Color = a_Color;
    }
`

const FSHADER_SOURCE = `
    varying mediump vec3 v_Color;
    void main() {
        gl_FragColor = vec4(v_Color, 1.0);
    }
`

// references to general information
var g_canvas
var gl
var g_lastFrameMS

// fov
var fov

// Regenerate
var rough

// mouse control
var mouseSensitivity

// speed
var catSpeed
var ball1Speed
var ball2Speed
var ball3Speed

// GLSL uniform references
var g_u_model_ref
var g_u_world_ref
var g_u_camera_ref
var g_u_projection_ref
var g_u_camera_ro_ref

// usual model/world matrices
var g_modelMatrix
var g_modelMatrix2
var g_modelMatrix3
var g_modelMatrix4
var g_worldMatrix
var g_worldMatrix2
var g_worldMatrix3
var g_worldMatrix4
var g_cameraMatrix
var g_cameraRotate

// cat direction
var catDir = false

// Mesh definitions
var g_teapotMesh
var g_Mesh2
var g_Mesh3
var g_gridMesh

// Camera
var g_LookUp
var g_LookDown
var g_LookLeft
var g_LookRight
var g_movingForward
var g_movingBackward
var g_movingLeft
var g_movingRight

// keep track of the camera position, always looking at (0, height, 0)
var g_cameraDistance
var g_cameraAngle
var g_cameraHeight

// Ground
var groundY = 0

// Done: init terrain params
var g_terrainModelMatrix
var g_terrainWorldMatrix
var g_terrainMesh

// Colors
var teapotColors
var obj2Colors
var obj3Colors

// rotate
var pitch = 0
var yaw = 0

// current position
var currentPosition = [0, 0, 0]
var faceTo = [0, 0, -1]

// We're using triangles, so our vertices each have 3 elements
// const TRIANGLE_SIZE = 3

// The size in bytes of a floating point
const FLOAT_SIZE = 4

function main() {
    // Done: Mouse control slider
    slider_SEN = document.getElementById("sliderSEN")
    slider_SEN.addEventListener('input', (event) => {
        updateSEN(event.target.value)
    })

    // Done: Add slider
    slider_ROUGH = document.getElementById("sliderROUGH")
    slider_ROUGH.addEventListener('input', (event) => {
        updateROUGH(event.target.value)
    })

    // Perspective FOV slider in HTML
    slider_FOV = document.getElementById('sliderFOV')
    slider_FOV.addEventListener('input', (event) => {
        updateFOV(event.target.value)
    })

    // Change cat direction in HTML
    document.getElementById("directionCat").addEventListener("change", function(event) {
        catDir = event.target.checked
    })

    // Change Cat Speed in HTML
    slider_CatSpeed = document.getElementById('sliderCatSpeed')
    slider_CatSpeed.addEventListener('input', (event) => {
        updateCatSpeed(event.target.value)
    })

    // Change P1 speed in HTML
    slider_Ball1Speed = document.getElementById('sliderBall1')
    slider_Ball1Speed.addEventListener('input', (event) => {
        updateBallSpeed1(event.target.value)
    })

    // Change P2 speed in HTML
    slider_Ball2Speed = document.getElementById('sliderBall2')
    slider_Ball2Speed.addEventListener('input', (event) => {
        updateBallSpeed2(event.target.value)
    })

    // Change P3 speed in HTML
    slider_Ball3Speed = document.getElementById('sliderBall3')
    slider_Ball3Speed.addEventListener('input', (event) => {
        updateBallSpeed3(event.target.value)
    })

    // Keyboard listener in HTML
    // document.addEventListener('keydown', function(event) {
    //
    // })

    // Done: Camera key control ====Done
    cameraKeyControl()

    // Get canvas in HTML
    g_canvas = document.getElementById('canvas')

    // Get the rendering context for WebGL
    gl = getWebGLContext(g_canvas, true)
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL')
        return
    }

    // We will call this at the end of most main functions from now on
    loadOBJFiles()
}

// 1: loadOBJFiles
async function loadOBJFiles() {
    // Add all obj Files
    data = await fetch('./resources/cat2.obj').then(response => response.text()).then((x) => x)
    g_teapotMesh = []
    readObjFile(data, g_teapotMesh)

    data2 = await fetch('./resources/octahedron.obj').then(response => response.text()).then((x) => x)
    g_Mesh2 = []
    readObjFile(data2, g_Mesh2)

    data3 = await fetch('./resources/icosahedron.obj').then(response => response.text()).then((x) => x)
    g_Mesh3 = []
    readObjFile(data3, g_Mesh3)

    // Wait to load our models before starting to render
    startRendering()
}

var terrain
var terrainWidth = 100
var terrainDepth = 100
var highestPosition
// 2: startRendering
function startRendering() {
    // Initialize GPU's vertex and fragment shaders programs
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log('Failed to intialize shaders.')
        return
    }

    // Done: default roughness
    updateROUGH(20)

    // Done: Terrain Mesh and colors
    var terrainGenerator = new TerrainGenerator()
    var seed = new Date().getMilliseconds()
    var options = {
        width: terrainWidth,
        height: 2,
        depth: terrainDepth,
        seed: seed,
        noisefn: "perlin", // Other options are "wave", "simplex" and "perlin"
        roughness: rough
    }
    terrain = terrainGenerator.generateTerrainMesh(options)
    var terrainColors = buildTerrainColors(terrain, options.height)
    g_terrainMesh = []
    for (var i = 0; i < terrain.length; i++) {
        g_terrainMesh.push(...terrain[i])
    }
    highestPosition = searchTerrainHighest(terrain)

    // initialize the VBO
    // Set grid colors
    // var gridInfo = buildGridAttributes(1, 1, [150/256, 140/256, 1])
    // g_gridMesh = gridInfo[0]

    // Set each obj colors
    teapotColors = buildColorAttributes(g_teapotMesh.length / 3, 0)
    obj2Colors = buildColorAttributes(g_Mesh2.length / 3, 2)
    obj3Colors = buildColorAttributes(g_Mesh3.length / 3, 1)

    var data = g_teapotMesh.concat(g_Mesh2).concat(g_Mesh3).concat(g_terrainMesh)
        .concat(teapotColors).concat(obj2Colors).concat(obj3Colors).concat(terrainColors)


    if (!initVBO(new Float32Array(data))) {
        return
    }

    // Send our vertex data to the GPU
    if (!setupVec3('a_Position', 0, 0)) {
        return
    }
    if (!setupVec3('a_Color', 0, (g_teapotMesh.length + g_Mesh2.length + g_Mesh3.length + g_terrainMesh.length) * FLOAT_SIZE)) {
        return -1
    }

    // Get references to GLSL uniforms
    g_u_camera_ro_ref = gl.getUniformLocation(gl.program, 'u_CameraRo')
    g_u_camera_ref = gl.getUniformLocation(gl.program, 'u_Camera')
    g_u_projection_ref = gl.getUniformLocation(gl.program, 'u_Projection')
    g_u_model_ref = gl.getUniformLocation(gl.program, 'u_Model')
    g_u_world_ref = gl.getUniformLocation(gl.program, 'u_World')

    // Done: Set init terrain model and world
    g_terrainModelMatrix = new Matrix4()
    g_terrainWorldMatrix = new Matrix4().translate(-options.width / 2, -options.height, -options.depth / 2)


    // Setup our model by scaling ---->Model Size
    g_modelMatrix = new Matrix4()
    g_modelMatrix = g_modelMatrix.setScale(.3, .3, .3)

    g_modelMatrix2 = new Matrix4()
    g_modelMatrix2 = g_modelMatrix2.setScale(.3, .3, .3)

    g_modelMatrix3 = new Matrix4()
    g_modelMatrix3 = g_modelMatrix3.setScale(.1, .1, .1)

    g_modelMatrix4 = new Matrix4()
    g_modelMatrix4 = g_modelMatrix4.setScale(.05, .05, .05)

    // Reposition our mesh (in this case as an identity operation) ---->Model init position
    g_worldMatrix = new Matrix4()
    g_worldMatrix2 = new Matrix4()
    g_worldMatrix3 = new Matrix4()
    g_worldMatrix4 = new Matrix4()

    g_worldMatrix = new Matrix4().translate(0, -0.4, -1.5)
    // g_worldMatrix2 = new Matrix4().translate(-1, -0.3, -1.5)
    g_worldMatrix3 = new Matrix4().translate(0, -0.3, -0.5)
    g_worldMatrix4 = new Matrix4().translate(0, -0.3, -0.7)

    // Done: init g_camera
    g_cameraMatrix = new Matrix4()
    g_cameraRotate = new Matrix4()

    // Done: camera default position
    g_cameraDistance = 0
    g_cameraAngle = 0
    g_cameraHeight = 0

    // Done: Default ----> Camera moving ====Done
    // Initialize control values
    g_LookUp = false
    g_LookDown = false
    g_LookLeft = false
    g_LookRight = false
    g_movingForward = false
    g_movingBackward = false
    g_movingLeft = false
    g_movingRight = false

    // Enable culling and depth tests
    // gl.enable(gl.CULL_FACE)
    gl.enable(gl.DEPTH_TEST)

    // Setup for ticks
    g_lastFrameMS = Date.now()

    // Done: Default mouse control
    updateSEN(0.90)

    // Default ---->FOV
    updateFOV(80)

    // Default ----> win
    updateWin(false)

    // Default ----> Moving speed
    updateCatSpeed(1)
    updateBallSpeed1(5)
    updateBallSpeed2(3)
    updateBallSpeed3(6)

    tick()
}

// extra constants for cleanliness
// var ROTATION_SPEED = 360/(Math.PI*2000)

// 3: tick
// function to apply all the logic for a single frame tick
var catX = 0
var catY = -0.4
var catZ = -1.5
function tick() {
    // time since the last frame
    var deltaTime

    // calculate deltaTime
    var current_time = Date.now()
    deltaTime = current_time - g_lastFrameMS
    g_lastFrameMS = Date.now()

    // Cat speed direction
    var speedCat = catSpeed
    if (catDir) {
        speedCat = -speedCat
    }

    // Set cat moving
    // g_modelMatrix.concat(new Matrix4().setRotate(speedCat, 0, 1, 0))
    var catAngle = speedCat * 100 *(Math.PI / 2) * (Date.now() / 1000)

    g_worldMatrix = new Matrix4()
        .setTranslate(catX, catY, catZ)
        .multiply(new Matrix4().setRotate(catAngle, 0, 1, 0))
        .multiply(new Matrix4().setTranslate(-0.6, 0, 0))
    // TODO cat follow camera
    // g_worldMatrix = new Matrix4()
    //     .setTranslate(currentPosition[0], currentPosition[1]-0.5, currentPosition[2]-1.3)
    //     .multiply(new Matrix4().setRotate(180-yaw, 0, 1, 0))
    //     .multiply(new Matrix4().setTranslate(-faceTo[0], faceTo[1], faceTo[0]))


    // : Get Cat Position ----> Problem
    // var getCatX = getModelPosition(g_worldMatrix, 0)
    // var getCatZ = getModelPosition(g_worldMatrix, 2)
    // var roundCatX = Math.round(getCatX) || 0
    // var roundCatZ = Math.round(getCatZ) || 0
    // var getTerrainY = getTerrainHeight(roundCatX, roundCatZ, terrain)
    // catY = getTerrainY + 0.1
    // console.log(roundCatX)

    // var t1 = terrain.find(item => item[0] === 1 && item[2] === 1)
    // console.log(t1[1])
    // console.log(terrain)

    // Done: Set P1 Position
    // console.log(highestPosition)
    var ball1Angle = ball1Speed * 10 *(Math.PI / 2) * (Date.now() / 1000)
    g_worldMatrix2 = new Matrix4()
        .setTranslate(highestPosition[0], highestPosition[1]-1.6, highestPosition[2])
        .multiply(new Matrix4().setRotate(ball1Angle, 0, 1, 0))

    // Set P2 moving
    var ball2Angle = ball2Speed * 10 *(Math.PI / 2) * (Date.now() / 1000)
    g_worldMatrix3 = new Matrix4()
        .setTranslate(0, -0.3, -1.5)
        .multiply(new Matrix4().setRotate(ball2Angle, 0, 1, 0))
        .multiply(new Matrix4().setTranslate(0, 0, 1))

    // Set P3 moving (according to P2)
    var ball3Angle = ball3Speed * 10 *(Math.PI / 2) * (Date.now() / 1000)
    g_worldMatrix4 = new Matrix4(g_worldMatrix3)
        .multiply(new Matrix4().setRotate(ball3Angle, 0, 1, 0))
        .multiply(new Matrix4().setTranslate(0, 0, -0.20))

    // Done: Set Camera rotate: update g_cameraRotate
    updateCamera(deltaTime)

    // TODO
    console.log(currentPosition)
    var distance = Math.sqrt((currentPosition[0]-highestPosition[0]) ** 2 + (currentPosition[1]-highestPosition[1]) ** 2 + (currentPosition[2]-highestPosition[2]) ** 2)
    if (distance < 2) {
        updateWin(true)
    }


    draw()

    requestAnimationFrame(tick, g_canvas)
}

// 4: draw
function draw() {


    // Done: Set projection
    var aspectRatio = g_canvas.width / g_canvas.height
    projection_matrix = new Matrix4().setPerspective(fov, aspectRatio, 0.5, 100)

    // Clear the canvas with a black background
    gl.clearColor(38/256, 50/256, 156/256, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Update camera rotation
    gl.uniformMatrix4fv(g_u_camera_ro_ref, false, g_cameraRotate.elements)

    // Updated camera and projection
    gl.uniformMatrix4fv(g_u_camera_ref, false, g_cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref, false, projection_matrix.elements)

    // Draw model 1
    gl.uniformMatrix4fv(g_u_model_ref, false, g_modelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.drawArrays(gl.TRIANGLES, 0, g_teapotMesh.length / 3)

    // Draw model 2
    gl.uniformMatrix4fv(g_u_model_ref, false, g_modelMatrix2.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix2.elements)
    gl.drawArrays(gl.TRIANGLES, g_teapotMesh.length / 3, g_Mesh2.length / 3)

    // Draw model 3
    gl.uniformMatrix4fv(g_u_model_ref, false, g_modelMatrix3.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix3.elements)
    gl.drawArrays(gl.TRIANGLES, (g_teapotMesh.length + g_Mesh2.length) / 3, g_Mesh3.length / 3)

    // Draw model 4
    gl.uniformMatrix4fv(g_u_model_ref, false, g_modelMatrix4.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix4.elements)
    gl.drawArrays(gl.TRIANGLES, g_teapotMesh.length / 3, g_Mesh2.length / 3)

    // Draw grid
    // the grid has a constant identity matrix for model and world
    // world includes our Y offset
    // gl.uniformMatrix4fv(g_u_model_ref, false, new Matrix4().elements)
    // gl.uniformMatrix4fv(g_u_world_ref, false, new Matrix4().translate(0, GRID_Y_OFFSET, 0).elements)
    // gl.drawArrays(gl.LINES, (g_teapotMesh.length + g_Mesh2.length + g_Mesh3.length) / 3, g_gridMesh.length / 3)

    // Done: Draw terrain
    gl.uniformMatrix4fv(g_u_model_ref, false, g_terrainModelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_terrainWorldMatrix.elements)
    gl.drawArrays(gl.TRIANGLES, (g_teapotMesh.length + g_Mesh2.length + g_Mesh3.length) / 3, g_terrainMesh.length / 3)
}


// ****************************** Functions ******************************
// Helper to construct colors
// makes every triangle a slightly different shade of blue
function buildColorAttributes(vertex_count, RGB) {
    var colors = []
    for (var i = 0; i < vertex_count / 3; i++) {
        // three vertices per triangle
        for (var vert = 0; vert < 3; vert++) {
            var shade = (i * 3) / vertex_count /2 + 0.5
            // colors.push(0, 0, shade)
            if (RGB === 0) {
                colors.push(shade, shade, shade)
            } else if (RGB === 1) {
                colors.push(shade, 0, 0)
            } else if (RGB === 2) {
                colors.push(0, shade, 0)
            } else {
                colors.push(0, 0, shade)
            }
        }
    }

    return colors
}

// How far in the X and Z directions the grid should extend
// Recall that the camera "rests" on the X/Z plane, since Z is "out" from the camera
const GRID_X_RANGE = 1000
const GRID_Z_RANGE = 1000

// The default y-offset of the grid for rendering
// const GRID_Y_OFFSET = -0.5

/*
 * Helper to build a grid mesh and colors
 * Returns these results as a pair of arrays
 * Each vertex in the mesh is constructed with an associated grid_color
 */
function buildGridAttributes(grid_row_spacing, grid_column_spacing, grid_color) {
    var mesh = []
    var colors = []

    // Construct the rows
    for (var x = -GRID_X_RANGE; x < GRID_X_RANGE; x += grid_row_spacing) {
        // two vertices for each line
        // one at -Z and one at +Z
        mesh.push(x, 0, -GRID_Z_RANGE)
        mesh.push(x, 0, GRID_Z_RANGE)
    }

    // Construct the columns extending "outward" from the camera
    for (var z = -GRID_Z_RANGE; z < GRID_Z_RANGE; z += grid_column_spacing) {
        // two vertices for each line
        // one at -Z and one at +Z
        mesh.push(-GRID_X_RANGE, 0, z)
        mesh.push(GRID_X_RANGE, 0, z)
    }

    // We need one color per vertex
    // since we have 3 components for each vertex, this is length/3
    for (var i = 0; i < mesh.length / 3; i++) {
        colors.push(grid_color[0], grid_color[1], grid_color[2])
    }

    return [mesh, colors]
}

/*
 * Initialize the VBO with the provided data
 * Assumes we are going to have "static" (unchanging) data
 */
function initVBO(data) {
    // get the VBO handle
    var VBOloc = gl.createBuffer()
    if (!VBOloc) {
        return false
    }

    // Bind the VBO to the GPU array and copy `data` into that VBO
    gl.bindBuffer(gl.ARRAY_BUFFER, VBOloc)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)

    return true
}

/*
 * Helper function to load the given vec3 data chunk onto the VBO
 * Requires that the VBO already be setup and assigned to the GPU
 */
function setupVec3(name, stride, offset) {
    // Get the attribute by name
    var attributeID = gl.getAttribLocation(gl.program, `${name}`)
    if (attributeID < 0) {
        console.log(`Failed to get the storage location of ${name}`)
        return false
    }

    // Set how the GPU fills the a_Position variable with data from the GPU 
    gl.vertexAttribPointer(attributeID, 3, gl.FLOAT, false, stride, offset)
    gl.enableVertexAttribArray(attributeID)

    return true
}

function updateFOV(amount) {
    label = document.getElementById('fov')
    fov = Number(amount)
    label.textContent = `Perspective FOV(Q/E): ${Number(amount).toFixed(2)}`
}

function updateROUGH(amount) {
    label = document.getElementById('rough')
    rough = Number(amount)
    label.textContent = `Roughness: ${Number(amount)}`
}

function updateSEN(amount) {
    // Done: SEN
    label = document.getElementById('sen')
    mouseSensitivity = Number(amount)
    label.textContent = `Mouse Sensitivity: ${Number(amount).toFixed(2)}`
}

// Done: Speed function
function updateCatSpeed(amount) {
    label = document.getElementById('catSpeed')
    catSpeed = Number(amount)
    label.textContent = `Cat Speed: ${catSpeed.toFixed(2)}`
}

function updateBallSpeed1(amount) {
    label = document.getElementById('ball1')
    ball1Speed = Number(amount)
    label.textContent = `Target Speed: ${ball1Speed.toFixed(2)}`
}

function updateBallSpeed2(amount) {
    label = document.getElementById('ball2')
    ball2Speed = Number(amount)
    label.textContent = `Gem 1 Speed: ${ball2Speed.toFixed(2)}`
}

function updateBallSpeed3(amount) {
    label = document.getElementById('ball3')
    ball3Speed = Number(amount)
    label.textContent = `Gem 2 Speed: ${ball3Speed.toFixed(2)}`
}

function cameraKeyControl() {
    document.addEventListener('keydown', function(event) {
        // Done: mouse control
        if (event.key === 't') {
            g_canvas.requestPointerLock()
        }

        // Done: Regenerate terrain
        if (event.key === 'g') {
            regenerateTerrain()
        }

        if (event.key === 'ArrowUp') {
            g_LookUp = true
        }
        else if (event.key === 'ArrowDown') {
            g_LookDown = true
        }
        else if (event.key === 'ArrowLeft') {
            g_LookLeft = true
        }
        else if (event.key === 'ArrowRight') {
            g_LookRight = true
        }
        else if (event.key === 'w') {
            g_movingForward = true
        }
        else if (event.key === 's') {
            g_movingBackward = true
        }
        // Done: add a and d
        else if (event.key === 'a') {
            g_movingLeft = true
        }
        else if (event.key === 'd') {
            g_movingRight = true
        }

        // Change FOV
        if (event.key === 'q' || event.key === 'Q') {
            let currentFOV = parseFloat(slider_FOV.value)
            let newFOV = Math.max(currentFOV - 10, parseFloat(slider_FOV.min))
            slider_FOV.value = newFOV
            updateFOV(newFOV)
        }
        if (event.key === 'e' || event.key === 'E') {
            let currentFOV = parseFloat(slider_FOV.value)
            let newFOV = Math.min(currentFOV + 10, parseFloat(slider_FOV.max))
            slider_FOV.value = newFOV
            updateFOV(newFOV)
        }
    })

    // End movement on key release
    document.addEventListener('keyup', function(event) {
        if (event.key === 'ArrowUp') {
            g_LookUp = false
        }
        else if (event.key === 'ArrowDown') {
            g_LookDown = false
        }
        else if (event.key === 'ArrowLeft') {
            g_LookLeft = false
        }
        else if (event.key === 'ArrowRight') {
            g_LookRight = false
        }
        else if (event.key === 'w') {
            g_movingForward = false
        }
        else if (event.key === 's') {
            g_movingBackward = false
        }
        // Done: add a and d
        else if (event.key === 'a') {
            g_movingLeft = false
        }
        else if (event.key === 'd') {
            g_movingRight = false
        }
    })

    // Done: Mouse control
    document.addEventListener('mousemove', function(event) {
        if (document.pointerLockElement === g_canvas) {
            // console.log("Lock!")
            // Done: Add sensitivity slider
            // let sensitivity = 0.05
            let sensitivity = (mouseSensitivity - 0.40) / 10
            yaw += event.movementX * sensitivity
            pitch += event.movementY * sensitivity
            // console.log(pitch)

            // Limit pitch
            if (pitch > 89) {
                pitch = 89
            }
            if (pitch < -89) {
                pitch = -89
            }
        }
    })
}

// Done: Update Camera Rotate
const CAMERA_ROTATE_SPEED = 0.1
const CAMERA_MOVE_SPEED = 0.005
var cameraYaw = new Quaternion(0, 0, 0, 1)
var cameraPitch = new Quaternion(0, 0, 0, 1)
var cameraQuat = new Quaternion(0, 0, 0, 1)
var posCamerax = 0
var posCameray = 0
var posCameraz = 0
function updateCamera(deltaTime) {
    let cameraRotateAngle = CAMERA_ROTATE_SPEED * deltaTime

    if (g_LookLeft) {
        yaw -= cameraRotateAngle
    }
    if (g_LookRight) {
        yaw += cameraRotateAngle
    }
    cameraYaw.setFromEuler(0, yaw, 0)

    if (g_LookUp) {
        pitch -= cameraRotateAngle
    }
    if (g_LookDown) {
        pitch += cameraRotateAngle
    }
    cameraPitch.setFromEuler(pitch, 0, 0)

    cameraQuat.multiply(cameraPitch, cameraYaw)
    cameraQuat.normalize()
    var under = 1
    if (cameraQuat.x === 0 && cameraQuat.y === 0 && cameraQuat.z === 0) {
        under = 1
    } else {
        under = Math.sqrt(cameraQuat.x*cameraQuat.x + cameraQuat.y*cameraQuat.y + cameraQuat.z*cameraQuat.z)
    }

    // MOVE
    let cameraMoveDistance = CAMERA_MOVE_SPEED * deltaTime
    let initFace = new Vector3([0, 0, -1])
    let faceDirection = cameraQuat.multiplyVector3(initFace)
    let faceX = -faceDirection.elements[0]
    let faceY = -faceDirection.elements[1]
    let faceZ = faceDirection.elements[2]
    faceTo = [faceX, faceY, faceZ]

    if (g_movingForward) {
        posCamerax -= faceX * cameraMoveDistance
        posCameray -= faceY * cameraMoveDistance
        posCameraz -= faceZ * cameraMoveDistance
    }
    if (g_movingBackward) {
        posCamerax += faceX * cameraMoveDistance
        posCameray += faceY * cameraMoveDistance
        posCameraz += faceZ * cameraMoveDistance
    }

    let initLeft = new Vector3([-1, 0, 0])
    let leftDirection = cameraQuat.multiplyVector3(initLeft)
    let leftX = -leftDirection.elements[0]
    let leftY = -leftDirection.elements[1]
    let leftZ = leftDirection.elements[2]
    // Done: Left and Right
    if (g_movingLeft) {
        posCamerax += leftX * cameraMoveDistance * 0.80
        posCameray += leftY * cameraMoveDistance * 0.80
        posCameraz += leftZ * cameraMoveDistance * 0.80
    }
    if (g_movingRight) {
        posCamerax -= leftX * cameraMoveDistance
        posCameray -= leftY * cameraMoveDistance
        posCameraz -= leftZ * cameraMoveDistance
    }

    // console.log(2 * Math.acos(cameraQuat.w) * (180 / Math.PI), cameraQuat.x/under, cameraQuat.y/under, cameraQuat.z/under)
    let angle = 2 * Math.acos(cameraQuat.w) * (180 / Math.PI)

    // TODO: get Terrain Position
    // let currentPosition = [-posCamerax, -posCameray, -posCameraz]
    // let terrainPosition = getTerrainPosition(currentPosition, terrain)
    // let terrainY = getTerrainTriangle(currentPosition, terrain)
    // console.log((terrainY-50)/25)

    g_cameraRotate = new Matrix4()
        .setRotate(angle, cameraQuat.x/under, cameraQuat.y/under, cameraQuat.z/under)
        .multiply(new Matrix4().setTranslate(posCamerax, posCameray, posCameraz))
    currentPosition = [-posCamerax, -posCameray, -posCameraz]
}

// Done: terrain colors function
function buildTerrainColors(terrain, height) {
    var colors = []
    for (var i = 0; i < terrain.length; i++) {
        // calculates the vertex color for each vertex independent of the triangle
        // the rasterizer can help make this look "smooth"

        // we use the y axis of each vertex alone for color
        // higher "peaks" have more shade
        var shade = (terrain[i][1] / height) + 1/2
        // var color = [shade, shade, 1.0]
        var color = [shade, 0, 1.0]

        // give each triangle 3 colors
        colors.push(...color)
    }

    return colors
}

// // var worldMatrix = new Matrix4()
// // var axis = 0    //0-x, 1-y, 2-z
// function getModelPosition(worldMatrix, axis) {
//     if(axis === 0) {
//         return worldMatrix.elements[12]
//     }
//     if(axis === 1) {
//         return worldMatrix.elements[13]
//     }
//     if(axis === 2) {
//         return worldMatrix.elements[14]
//     }
// }

// Done: Regenerate Terrain
function regenerateTerrain() {
    var newSeed = new Date().getMilliseconds()
    var options = {
        width: terrainWidth,
        height: 2,
        depth: terrainDepth,
        seed: newSeed,
        noisefn: "perlin", // Other options are "wave", "simplex" and "perlin"
        roughness: rough
    }

    var terrainGenerator = new TerrainGenerator()
    terrain = terrainGenerator.generateTerrainMesh(options)
    var terrainColors = buildTerrainColors(terrain, options.height)
    g_terrainMesh = []
    for (var i = 0; i < terrain.length; i++) {
        g_terrainMesh.push(...terrain[i])
    }

    //Done: HighestPoint
    highestPosition = searchTerrainHighest(terrain)

    // RE init VBO
    var data = g_teapotMesh.concat(g_Mesh2).concat(g_Mesh3).concat(g_terrainMesh)
        .concat(teapotColors).concat(obj2Colors).concat(obj3Colors).concat(terrainColors)

    gl.deleteBuffer(gl.getParameter(gl.ARRAY_BUFFER_BINDING))

    if (!initVBO(new Float32Array(data))) {
        console.log("Failed to update VBO.")
        return
    }

    // Send our vertex data to the GPU
    if (!setupVec3('a_Position', 0, 0)) {
        console.log("Failed to setup a_Position.")
        return
    }
    if (!setupVec3('a_Color', 0, (g_teapotMesh.length + g_Mesh2.length + g_Mesh3.length + g_terrainMesh.length) * FLOAT_SIZE)) {
        console.log("Failed to setup a_Color.")
        return
    }

    // update world and model
    g_terrainModelMatrix = new Matrix4()
    g_terrainWorldMatrix = new Matrix4().translate(-options.width / 2, -options.height, -options.depth / 2)

    // Re-Draw

    posCamerax = 0
    posCameray = 0
    posCameraz = 0
    yaw = 0
    pitch = 0
    updateWin(false)
    draw()
}

// Done: get highest point in terrain
function searchTerrainHighest(terrain) {
    // Set limitation
    let x_min = 40
    let x_max = 60
    let z_min = 30
    let z_max = 50

    let maxY = -Infinity
    let highestPoint = null
    for (i = 0; i < terrain.length; i++) {
        let [x, y, z] = terrain[i]
        if (x < x_max && x > x_min && z < z_max && z > z_min) {
            if (y > maxY) {
                maxY = y
                highestPoint = [x-50, y, z-50]
            }
        }
    }
    // console.log(highestPoint)
    return highestPoint
}

function getTerrainPosition(position, terrain) {
    let posx = Math.floor(position[0])
    let posz = Math.floor(position[2])

    let terrainPosition = null
    for (i = 0; i < terrain.length; i++) {
        let [x, y, z] = terrain[i]
        if (posx === (x-50) && posz === (z-50)) {
            terrainPosition = [x, y, z]
        }
    }
    return terrainPosition
}

// TODO: get Terrain Y
function getTerrainTriangle(position, terrain) {
    let posx = position[0]
    let posy = position[1]
    let posz = position[2]

    let xrange = Math.abs(posx - Math.floor(posx))
    let zrange = Math.abs(posz - Math.floor(posz))

    let p2 = getTerrainPosition([position[0]+1, position[1], position[2]], terrain)
    let x2 = p2[0]
    let y2 = p2[1]
    let z2 = p2[2]
    let p3 = getTerrainPosition([position[0], position[1], position[2]+1], terrain)
    let x3 = p3[0]
    let y3 = p3[1]
    let z3 = p3[2]

    if ((xrange+zrange) < 1.00) {
        // Upper triangle
        let p1 = getTerrainPosition(position, terrain)
        let x1 = p1[0]
        let y1 = p1[1]
        let z1 = p1[2]

        let under = (z2-z3)*(x1-x3)+(x3-x2)*(z1-z3)
        if (under === 0) {return y1}
        let c1 = ((z2-z3)*(posx-x3)+(x3-x2)*(posz-z3))/under
        let c2 = ((z3-z1)*(posx-x3)+(x1-x3)*(posz-z3))/under
        let c3 = 1-c1-c2

        return c1 * y1 + c2 * y2 + c3 * y3
    } else {
        // Lower triangle
        let p4 = getTerrainPosition([position[0]+1, position[1], position[2]+1], terrain)
        let x4 = p4[0]
        let y4 = p4[1]
        let z4 = p4[2]

        let under = (z2-z3)*(x4-x3)+(x3-x2)*(z4-z3)
        if (under === 0) {return y4}
        let c1 = ((z2-z3)*(posx-x3)+(x3-x2)*(posz-z3))/under
        let c2 = ((z3-z4)*(posx-x3)+(x4-x3)*(posz-z3))/under
        let c3 = 1-c1-c2

        return c1 * y4 + c2 * y2 + c3 * y3
    }
}

function updateWin(isWin) {
    label = document.getElementById('win')
    if (isWin) {
        label.textContent = `You Found it! 'G' to restart`
    } else {
        label.textContent = `A gem is on the nearby mountain peaks. Where is it?`
    }

}