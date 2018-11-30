var shaderSourceFragment = ` 
   precision mediump float;

	    	// uniform attribute for setting texture coordinates
		    varying vec2 vTextureCoord;
	    	// uniform attribute for setting normals
		    varying vec3 vTransformedNormal;
	    	// uniform attribute for setting positions
		    varying vec4 vPosition;

	    	// uniform attribute for setting shininess
		    uniform float uMaterialShininess;

			// uniform attribute for enabling speculars
		    uniform bool uShowSpecularHighlights;
			// uniform attribute for enabling lighting
		    uniform bool uUseLighting;
			// uniform attribute for enabling textures
		    uniform bool uUseTextures;

		    uniform vec3 uAmbientColor;	// ambient color uniform

		    uniform vec3 uPointLightingLocation;			// light direction uniform
		    uniform vec3 uPointLightingSpecularColor;		// specular light color
		    uniform vec3 uPointLightingDiffuseColor;		// difuse light color

			// uniform attribute for setting 2D sampler
		    uniform sampler2D uSampler;


		    void main(void) {
		        vec3 lightWeighting;
		        if (!uUseLighting) {
		            lightWeighting = vec3(1.0, 1.0, 1.0);
		        } else {
		            vec3 lightDirection = normalize(uPointLightingLocation - vPosition.xyz);
		            vec3 normal = normalize(vTransformedNormal);

		            // Specular component
		            float specularLightWeighting = 0.0;
		            if (uShowSpecularHighlights) {
		                vec3 eyeDirection = normalize(-vPosition.xyz);
		                vec3 reflectionDirection = reflect(-lightDirection, normal);

		                specularLightWeighting = pow(max(dot(reflectionDirection, eyeDirection), 0.0), uMaterialShininess);
		            }

		            // diffuese component
		            float diffuseLightWeighting = max(dot(normal, lightDirection), 0.0);
		            lightWeighting = uAmbientColor
		                + uPointLightingSpecularColor * specularLightWeighting
		                + uPointLightingDiffuseColor * diffuseLightWeighting;
		        }

		        vec4 fragmentColor;
		        if (uUseTextures) {
	    			// sample the fragment color from texture
		            fragmentColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
		        } else {
		    		// set the fragment color to white
		            fragmentColor = vec4(1.0, 1.0, 1.0, 1.0);
		        }
	    		// sample the fragment color from texture
		        gl_FragColor = vec4(fragmentColor.rgb * lightWeighting, fragmentColor.a);
		    }
    `
var shaderSourceVertex = `
 // atributes for setting vertex position, normals and texture coordinates
		    attribute vec3 aVertexPosition;
		    attribute vec3 aVertexNormal;
		    attribute vec2 aTextureCoord;

		    uniform mat4 uMVMatrix;	// model-view matrix
		    uniform mat4 uPMatrix;	// projection matrix
		    uniform mat3 uNMatrix;	// normal matrix

			// variable for passing texture coordinates and lighting weights
			// from vertex shader to fragment shader
		    varying vec2 vTextureCoord;
		    varying vec3 vTransformedNormal;
		    varying vec4 vPosition;


		    void main(void) {
		    	// calculate the vertex position
		        vPosition = uMVMatrix * vec4(aVertexPosition, 1.0);
		        gl_Position = uPMatrix * vPosition;
		        vTextureCoord = aTextureCoord;
		        vTransformedNormal = uNMatrix * aVertexNormal;
		    }
`

var canvas;
var gl;
var shaderProgram;
var obstaclesLocations = [];
var powerUpLocations = [];
var pickedPowerUps = [];
var obL = 13;
var pwL = 5;
var scoreElement;
var healthElement;


//buffers
var worldVertexPositionBuffer;
var worldVertexNormalBuffer;
var worldVertexTextureCoordBuffer;
var worldVertexIndexBuffer;

var shipVertexPositionBuffer;
var shipVertexNormalBuffer;
var shipVertexTextureCoordBuffer;
var shipVertexIndexBuffer;


var powerVertexPositionBuffer;
var powerVertexNormalBuffer;
var powerVertexTextureCoordBuffer;
var powerVertexIndexBuffer;
var powerTranslationsBuffer;
var powerUpBonusBuffer;

var backVertexPositionBuffer;
var backVertexNormalBuffer;
var backVertexTextureCoordBuffer;
var backVertexIndexBuffer;

// Model-view and projection matrix and model-view matrix stack
var mvMatrixStack = [];
var mvMatrix = mat4.create();
var pMatrix = mat4.create();

// Variable for storing textures
var shipTexture;
var metalTexture;
var backTexture;
var healthTexture;
var boostTexture;

// Variable that stores  loading state of textures.

var numberOfTextures = 6;
var texturesLoaded = 0;

// Helper variables for rotation
var powerUpAngle = 180;
var lastTime = 0;

// Helper variable for animation
var currentlyPressedKeys = {};

// Variables for storing current position and speed
var pitch = 0;
var pitchRate = 0;
var yaw = 0;
var yawRate = 0;
var xPosition = 0.0;
var yPosition = 2.75;
var zPosition = 0.0;
var shipLine = 0;
var shipAltitude = 0;
var speed = 1;
var score = 0;
var health = 100;
var obIndex = 0;
var pwIndex = 0;
var nextPowUp = -50;
var nextObstacle = -30;
var multiplier = 1;
var intervalId;


function handleCollisions(callback) {
    if (zPosition - 5 == nextObstacle) {
        for (var i = 0; i < obstaclesLocations[obIndex].length; i++) {
            if (obstaclesLocations[obIndex][i] == nextObstacle) {
                if (shipLine == obstaclesLocations[obIndex][i - 2] && shipAltitude == obstaclesLocations[obIndex][i - 1]) {
                    health -= 25;
                    if (health == 0) {
                        clearInterval(intervalId);
                        setTimeout(function() {
                            overElement = document.getElementById("over");
                            overElement.style.visibility = "visible";
                            var audio = new Audio('/assets/Game - Over.mp3');
                            audio.play()
                        }, 1000)

                    }
                }
            }
        }

        obIndex++;
        nextObstacle = obstaclesLocations[obIndex][2];

    }
    if (zPosition - 9 == nextPowUp) {
        for (var i = 0; i < powerUpLocations[pwIndex].length; i++) {
            if (powerUpLocations[pwIndex][i] == nextPowUp) {
                if (shipLine == powerUpLocations[pwIndex][i - 2] && shipAltitude == powerUpLocations[pwIndex][i - 1]) {
                    if (determinePowerUp() == "health") {
                        if (health < 100) {
                            health += 25;
                            console.log("health boost picked");
                        }
                    } else {
                        console.log("speedboost picked");
                        speed *= 2;
                        multiplier *= 2;
                        setTimeout(speedBoost, 1500);
                    }
                    pickedPowerUps.push(pwIndex);
                }
            }
        }

        pwIndex++;
        nextPowUp = powerUpLocations[pwIndex][2];
        console.log(nextPowUp);
    }

    callback();
}

function speedBoost() {
    speed /= 2;
    multiplier /= 2;
}

function determinePowerUp() {
    var powerUp = powerUpBonusBuffer[pwIndex];
    return powerUp;
}


function updateShipLine() {
    if (xPosition > -5 && xPosition < -3 && yPosition == 2.75) {
        shipLine = -2;
        shipAltitude = 0;
    } else if (xPosition > -3 && xPosition < -1 && yPosition == 2.75) {
        shipLine = -1;
        shipAltitude = 0;
    } else if (xPosition > -1 && xPosition < 1 && yPosition == 2.75) {
        shipLine = 0;
        shipAltitude = 0;
    } else if (xPosition > 1 && xPosition < 3 && yPosition == 2.75) {
        shipLine = 1;
        shipAltitude = 0;
    } else if (xPosition > 3 && xPosition < 5 && yPosition == 2.75) {
        shipLine = 2;
        shipAltitude = 0;
    } else if (xPosition > -5 && xPosition < -3 && yPosition == 3.5) {
        shipLine = -2;
        shipAltitude = 1;
    } else if (xPosition > -3 && xPosition < -1 && yPosition == 3.5) {
        shipLine = -1;
        shipAltitude = 1;
    } else if (xPosition > -1 && xPosition < 1 && yPosition == 3.5) {
        shipLine = 0;
        shipAltitude = 1;
    } else if (xPosition > 1 && xPosition < 3 && yPosition == 3.5) {
        shipLine = 1;
        shipAltitude = 1;
    } else if (xPosition > 3 && xPosition < 5 && yPosition == 3.5) {
        shipLine = 2;
        shipAltitude = 1;
    }
}


//
// Matrix utility functions
//
// mvPush   ... push current matrix on matrix stack
// mvPop    ... pop top matrix from stack
// degToRad ... convert degrees to radians
//
function mvPushMatrix() {
    var copy = mat4.create();
    mat4.set(mvMatrix, copy);
    mvMatrixStack.push(copy);
}

function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
        throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

function initObstacleBuffer() {
    for (var i = 0; i < obL; i++) {
        obstaclesLocations[i] = [];
    }
    for (var i = 0; i < pwL; i++) {
        powerUpLocations[i] = [];
    }

}

//
// initGL
//
// Initialize WebGL, returning the GL context or null if
// WebGL isn't available or could not be initialized.
//
function initGL(canvas) {
    var gl = null;
    try {
        // Try to grab the standard context. If it fails, fallback to experimental.
        gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {}

    // If we don't have a GL context, give up now
    if (!gl) {
        alert("Unable to initialize WebGL. Your browser may not support it.");
    }
    return gl;
}



function getShader(gl, id) {
    var shaderSource = ``;
    var shader;
    if (id == "shader-fs") {
        shaderSource = shaderSourceFragment;
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (id == "shader-vs") {
        shaderSource = shaderSourceVertex;
        shader = gl.createShader(gl.VERTEX_SHADER);
    }
    gl.shaderSource(shader, shaderSource);

    // Compile the shader program
    gl.compileShader(shader);

    // See if it compiled successfully
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

function initShaders() {
    var fragmentShader = getShader(gl, "shader-fs");
    var vertexShader = getShader(gl, "shader-vs");

    // Create the shader program
    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    // If creating the shader program failed, alert
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Unable to initialize the shader program.");
    }

    // start using shading program for rendering
    gl.useProgram(shaderProgram);

    // store location of aVertexPosition variable defined in shader
    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");

    // turn on vertex position attribute at specified position
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    // store location of vertex normals variable defined in shader
    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");

    // turn on vertex normals attribute at specified position
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

    // store location of texture coordinate variable defined in shader
    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");

    // turn on texture coordinate attribute at specified position
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    // store location of uPMatrix variable defined in shader - projection matrix 
    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    // store location of uMVMatrix variable defined in shader - model-view matrix 
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    // store location of uNMatrix variable defined in shader - normal matrix 
    shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
    // store location of uSampler variable defined in shader
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
    // store location of uMaterialShininess variable defined in shader
    shaderProgram.materialShininessUniform = gl.getUniformLocation(shaderProgram, "uMaterialShininess");
    // store location of uShowSpecularHighlights variable defined in shader
    shaderProgram.showSpecularHighlightsUniform = gl.getUniformLocation(shaderProgram, "uShowSpecularHighlights");
    // store location of uUseTextures variable defined in shader
    shaderProgram.useTexturesUniform = gl.getUniformLocation(shaderProgram, "uUseTextures");
    // store location of uUseLighting variable defined in shader
    shaderProgram.useLightingUniform = gl.getUniformLocation(shaderProgram, "uUseLighting");
    // store location of uAmbientColor variable defined in shader
    shaderProgram.ambientColorUniform = gl.getUniformLocation(shaderProgram, "uAmbientColor");
    // store location of uPointLightingLocation variable defined in shader
    shaderProgram.pointLightingLocationUniform = gl.getUniformLocation(shaderProgram, "uPointLightingLocation");
    // store location of uPointLightingSpecularColor variable defined in shader
    shaderProgram.pointLightingSpecularColorUniform = gl.getUniformLocation(shaderProgram, "uPointLightingSpecularColor");
    // store location of uPointLightingDiffuseColor variable defined in shader
    shaderProgram.pointLightingDiffuseColorUniform = gl.getUniformLocation(shaderProgram, "uPointLightingDiffuseColor");
}

//
// setMatrixUniforms
//
// Set the uniform values in shaders for model-view and projection matrix.
//
function setMatrixUniforms() {
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);

    var normalMatrix = mat3.create();
    mat4.toInverseMat3(mvMatrix, normalMatrix);
    mat3.transpose(normalMatrix);
    gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
}

function initTextures() {
    shipTexture = gl.createTexture();
    shipTexture.image = new Image();
    shipTexture.image.onload = function() {
        handleTextureLoaded(shipTexture)
    }
    shipTexture.image.src = "./assets/shipTex.jpg";

    metalTexture = gl.createTexture();
    metalTexture.image = new Image();
    metalTexture.image.onload = function() {
        handleTextureLoaded(metalTexture)
    }
    metalTexture.image.src = "./assets/metal.jpg";

    healthTexture = gl.createTexture();
    healthTexture.image = new Image();
    healthTexture.image.onload = function() {
        handleTextureLoaded(healthTexture)
    }
    healthTexture.image.src = "./assets/health.jpg";

    boostTexture = gl.createTexture();
    boostTexture.image = new Image();
    boostTexture.image.onload = function() {
        handleTextureLoaded(boostTexture);
    }
    boostTexture.image.src = "./assets/boost.jpg";

    shipTexture = gl.createTexture();
    shipTexture.image = new Image();
    shipTexture.image.onload = function() {
        handleTextureLoaded(shipTexture)
    }
    shipTexture.image.src = "./assets/shipTex.jpg";

    backTexture = gl.createTexture();
    backTexture.image = new Image();
    backTexture.image.onload = function() {
        handleTextureLoaded(backTexture)
    }
    backTexture.image.src = "./assets/bgPic1.png";

    backTexture = gl.createTexture();
    backTexture.image = new Image();
    backTexture.image.onload = function() {
        handleTextureLoaded(backTexture)
    }
    backTexture.image.src = "./assets/bgPic1.png"

}


function handleTextureLoaded(texture) {

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // Third texture usus Linear interpolation approximation with nearest Mipmap selection
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);

    gl.bindTexture(gl.TEXTURE_2D, null);

    // when texture loading is finished we can draw scene.
    texturesLoaded += 1;
}

//
// handleLoadedWorld
//
// Handle loaded teapot
//
function handleLoadedWorld(worldData) {
    // Pass the normals into WebGL
    worldVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(worldData.vertexNormals), gl.STATIC_DRAW);
    worldVertexNormalBuffer.itemSize = 3;
    worldVertexNormalBuffer.numItems = worldData.vertexNormals.length / 3;

    // Pass the texture coordinates into WebGL
    worldVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexTextureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(worldData.vertexTextureCoords), gl.STATIC_DRAW);
    worldVertexTextureCoordBuffer.itemSize = 2;
    worldVertexTextureCoordBuffer.numItems = worldData.vertexTextureCoords.length / 2;

    // Pass the vertex positions into WebGL
    worldVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(worldData.vertexPositions), gl.STATIC_DRAW);
    worldVertexPositionBuffer.itemSize = 3;
    worldVertexPositionBuffer.numItems = worldData.vertexPositions.length / 3;

    // Pass the indices into WebGL
    worldVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, worldVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(worldData.indices), gl.STATIC_DRAW);
    worldVertexIndexBuffer.itemSize = 1;
    worldVertexIndexBuffer.numItems = worldData.indices.length;

    document.getElementById("loadingtext").textContent = "";
}

function handleLoadedBackground(backData) {
    // Pass the normals into WebGL
    //console.log(backData);
    backVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, backVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(backData.vertexNormals), gl.STATIC_DRAW);
    backVertexNormalBuffer.itemSize = 3;
    backVertexNormalBuffer.numItems = backData.vertexNormals.length / 3;
    // Pass the texture coordinates into WebGL
    backVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, backVertexTextureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(backData.vertexTextureCoords), gl.STATIC_DRAW);
    backVertexTextureCoordBuffer.itemSize = 2;
    backVertexTextureCoordBuffer.numItems = backData.vertexTextureCoords.length / 2;
    // Pass the vertex positions into WebGL
    backVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, backVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(backData.vertexPositions), gl.STATIC_DRAW);
    backVertexPositionBuffer.itemSize = 3;
    backVertexPositionBuffer.numItems = backData.vertexPositions.length / 3;
    // Pass the indices into WebGL
    backVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, backVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(backData.indices), gl.STATIC_DRAW);
    backVertexIndexBuffer.itemSize = 1;
    backVertexIndexBuffer.numItems = backData.indices.length;
    document.getElementById("loadingtext").textContent = "";
}


function handleLoadedPowerUps(powerData) {
    // Pass the normals into WebGL
    //console.log(powerData);
    powerVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, powerVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(powerData.vertexNormals), gl.STATIC_DRAW);
    powerVertexNormalBuffer.itemSize = 3;
    powerVertexNormalBuffer.numItems = powerData.vertexNormals.length / 3;

    // Pass the texture coordinates into WebGL
    powerVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, powerVertexTextureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(powerData.vertexTextureCoords), gl.STATIC_DRAW);
    powerVertexTextureCoordBuffer.itemSize = 2;
    powerVertexTextureCoordBuffer.numItems = powerData.vertexTextureCoords.length / 2;


    // Pass the vertex positions into WebGL
    powerVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, powerVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(powerData.vertexPositions), gl.STATIC_DRAW);
    powerVertexPositionBuffer.itemSize = 3;
    powerVertexPositionBuffer.numItems = powerData.vertexPositions.length / 3;

    // Pass the indices into WebGL
    powerVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, powerVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(powerData.indices), gl.STATIC_DRAW);
    powerVertexIndexBuffer.itemSize = 1;
    powerVertexIndexBuffer.numItems = powerData.indices.length;

    powerTranslationsBuffer = powerData.translations;
    powerTranslationsBuffer.itemSize = 3;
    powerTranslationsBuffer.numItems = Object.keys(powerTranslationsBuffer).length - 1;

    powerUpBonusBuffer = powerData.powerUpBonus;
    console.log(powerUpBonusBuffer);
    powerUpBonusBuffer.numItems = powerUpBonusBuffer.length;

    document.getElementById("loadingtext").textContent = "";
}

function handleLoadedShip(shipData) {
    // Pass the normals into WebGL
    //console.log(shipData);
    shipVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, shipVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shipData.vertexNormals), gl.STATIC_DRAW);
    shipVertexNormalBuffer.itemSize = 3;
    shipVertexNormalBuffer.numItems = shipData.vertexNormals.length / 3;

    // Pass the texture coordinates into WebGL
    shipVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, shipVertexTextureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shipData.vertexTextureCoords), gl.STATIC_DRAW);
    shipVertexTextureCoordBuffer.itemSize = 2;
    shipVertexTextureCoordBuffer.numItems = shipData.vertexTextureCoords.length / 2;

    // Pass the vertex positions into WebGL
    shipVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, shipVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shipData.vertexPositions), gl.STATIC_DRAW);
    shipVertexPositionBuffer.itemSize = 3;
    shipVertexPositionBuffer.numItems = shipData.vertexPositions.length / 3;

    // Pass the indices into WebGL
    shipVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shipVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(shipData.indices), gl.STATIC_DRAW);
    shipVertexIndexBuffer.itemSize = 1;
    shipVertexIndexBuffer.numItems = shipData.indices.length;

    document.getElementById("loadingtext").textContent = "";
}



function handleLoadedBackground(backData) {
    // Pass the normals into WebGL
    //console.log(backData);
    backVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, backVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(backData.vertexNormals), gl.STATIC_DRAW);
    backVertexNormalBuffer.itemSize = 3;
    backVertexNormalBuffer.numItems = backData.vertexNormals.length / 3;

    // Pass the texture coordinates into WebGL
    backVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, backVertexTextureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(backData.vertexTextureCoords), gl.STATIC_DRAW);
    backVertexTextureCoordBuffer.itemSize = 2;
    backVertexTextureCoordBuffer.numItems = backData.vertexTextureCoords.length / 2;

    // Pass the vertex positions into WebGL
    backVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, backVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(backData.vertexPositions), gl.STATIC_DRAW);
    backVertexPositionBuffer.itemSize = 3;
    backVertexPositionBuffer.numItems = backData.vertexPositions.length / 3;

    // Pass the indices into WebGL
    backVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, backVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(backData.indices), gl.STATIC_DRAW);
    backVertexIndexBuffer.itemSize = 1;
    backVertexIndexBuffer.numItems = backData.indices.length;

    document.getElementById("loadingtext").textContent = "";
}



function loadShip() {
    var request = new XMLHttpRequest();
    request.open("GET", "./assets/ship10.json");
    request.onreadystatechange = function() {
        if (request.readyState == 4) {
            handleLoadedShip(JSON.parse(request.responseText));
        }
    }
    request.send();
}

function loadBackground() {
    var request = new XMLHttpRequest();
    request.open("GET", "./assets/background.json");
    request.onreadystatechange = function() {
        if (request.readyState == 4) {
            handleLoadedBackground(JSON.parse(request.responseText));
        }
    }
    request.send();
}

function loadWorld() {
    var request = new XMLHttpRequest();
    request.open("GET", "./assets/world.json");
    request.onreadystatechange = function() {
        if (request.readyState == 4) {
            handleLoadedWorld(JSON.parse(request.responseText));
        }
    }
    request.send();
}

function loadBackground() {
    var request = new XMLHttpRequest();
    request.open("GET", "./assets/background.json");
    request.onreadystatechange = function() {
        if (request.readyState == 4) {
            handleLoadedBackground(JSON.parse(request.responseText));
        }
    }
    request.send();
}
function handleLoadedObstacles(obstacleData) {
    obstaclesLocations = obstacleData.obstaclesLocations;
    nextObstacle = obstaclesLocations[0][2];
    powerUpLocations = obstacleData.powUpLocations;
    nextPowUp = powerUpLocations[0][2];
}

function loadObstacles() {
    var request = new XMLHttpRequest();
    request.open("GET", "./assets/obstacles.json");
    request.onreadystatechange = function() {
        if (request.readyState == 4) {
            handleLoadedObstacles(JSON.parse(request.responseText));
        }
    }
    request.send();
}

function loadPowerUps() {
    var request = new XMLHttpRequest();
    request.open("GET", "./assets/powerups.json");
    request.onreadystatechange = function() {
        if (request.readyState == 4) {
            handleLoadedPowerUps(JSON.parse(request.responseText));
        }
    }
    request.send();
}



function drawScene() {
    // set the rendering environment to full canvas size
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    score = -zPosition;
    scoreElement.innerHTML = score.toFixed(0);
    healthElement.innerHTML = health.toFixed(0);

    // Clear the canvas before we start drawing on it.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (worldVertexPositionBuffer == null || worldVertexNormalBuffer == null || worldVertexTextureCoordBuffer == null || worldVertexIndexBuffer == null) {
        return;
    }

    // Establish the perspective with which we want to view the
    // scene. Our field of view is 45 degrees, with a width/height
    // ratio of 640:480, and we only want to see objects between 0.1 units
    // and 100 units away from the camera.
    mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);

    var specularHighlights = document.getElementById("specular").checked;
    gl.uniform1i(shaderProgram.showSpecularHighlightsUniform, specularHighlights);

    // Ligthing
    var lighting = document.getElementById("lighting").checked;

    // set uniform to the value of the checkbox.
    gl.uniform1i(shaderProgram.useLightingUniform, lighting);

    // set uniforms for lights as defined in the document
    if (lighting) {
        gl.uniform3f(
            shaderProgram.ambientColorUniform,
            parseFloat(document.getElementById("ambientR").value),
            parseFloat(document.getElementById("ambientG").value),
            parseFloat(document.getElementById("ambientB").value)
        );

        gl.uniform3f(
            shaderProgram.pointLightingLocationUniform,
            parseFloat(document.getElementById("lightPositionX").value),
            parseFloat(document.getElementById("lightPositionY").value),
            parseFloat(document.getElementById("lightPositionZ").value)
        );

        gl.uniform3f(
            shaderProgram.pointLightingSpecularColorUniform,
            parseFloat(document.getElementById("specularR").value),
            parseFloat(document.getElementById("specularG").value),
            parseFloat(document.getElementById("specularB").value)
        );

        gl.uniform3f(
            shaderProgram.pointLightingDiffuseColorUniform,
            parseFloat(document.getElementById("diffuseR").value),
            parseFloat(document.getElementById("diffuseG").value),
            parseFloat(document.getElementById("diffuseB").value)
        );
    }

    // Textures
    var texture = document.getElementById("texture").value;

    // set uniform to the value of the checkbox.
    gl.uniform1i(shaderProgram.useTexturesUniform, true);

    mat4.identity(mvMatrix);
    //mat4.translate(mvMatrix, [-xPosition, -yPosition, -zPosition]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, backTexture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);
    mvPushMatrix();
    // Set the vertex positions attribute for the teapot vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, backVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, backVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
    // Set the texture coordinates attribute for the vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, backVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, backVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);
    // Set the normals attribute for the vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, backVertexNormalBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, backVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);
    // Set the index for the vertices.
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, backVertexIndexBuffer);
    setMatrixUniforms();
    // Draw the teapot
    gl.drawElements(gl.TRIANGLES, backVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    mvPopMatrix();

    //background
    mat4.identity(mvMatrix);
    //mat4.translate(mvMatrix, [-xPosition, -yPosition, -zPosition]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, backTexture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);
    mvPushMatrix();
    // Set the vertex positions attribute for the teapot vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, backVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, backVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
    // Set the texture coordinates attribute for the vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, backVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, backVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);
    // Set the normals attribute for the vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, backVertexNormalBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, backVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);
    // Set the index for the vertices.
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, backVertexIndexBuffer);
    setMatrixUniforms();
    // Draw the teapot
    gl.drawElements(gl.TRIANGLES, backVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    mvPopMatrix();



    // Set the drawing position to the "identity" point, which is
    // the center of the scene.
    mat4.identity(mvMatrix);

    // Now move the drawing position a bit to where we want to start
    // drawing the world.

    mat4.translate(mvMatrix, [-xPosition, -yPosition, -zPosition]);

    // Activate textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, metalTexture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);

    // Activate shininess
    gl.uniform1f(shaderProgram.materialShininessUniform, parseFloat(document.getElementById("shininess").value));

    mvPushMatrix();
    // Set the vertex positions attribute for the teapot vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, worldVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
    // Set the texture coordinates attribute for the vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, worldVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);
    // Set the normals attribute for the vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexNormalBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, worldVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);
    // Set the index for the vertices.
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, worldVertexIndexBuffer);
    setMatrixUniforms();
    // Draw the teapot
    gl.drawElements(gl.TRIANGLES, worldVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    mvPopMatrix();


    //ship
    mat4.identity(mvMatrix);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, shipTexture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);
    mat4.translate(mvMatrix, [0, -2, -8]);
    mat4.scale(mvMatrix, [0.2, 0.2, 0.2]);

    
    mvPushMatrix();
    mat4.rotate(mvMatrix, degToRad(180), [0, 1, 0]);
    gl.bindBuffer(gl.ARRAY_BUFFER, shipVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, shipVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, shipVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, shipVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(shaderProgram.samplerUniform, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, shipVertexNormalBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, shipVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shipVertexIndexBuffer);
    setMatrixUniforms();
    gl.drawElements(gl.TRIANGLES, shipVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    mvPopMatrix();


    // gl.uniform1i(shaderProgram.useTexturesUniform, true);
    //powerups
    if (pickedPowerUps.length < 1) {

        mat4.identity(mvMatrix);
        mat4.translate(mvMatrix, [-xPosition, -yPosition + 0.8, -zPosition - 50]);
        mat4.rotate(mvMatrix, degToRad(powerUpAngle), [0, 1, 0]);
        drawPowerUps(0);

    }

    if (pickedPowerUps.length < 2) {
        mat4.identity(mvMatrix);
        mat4.translate(mvMatrix, [-xPosition + 2, -yPosition + 0.8, -zPosition - 80]);
        mat4.rotate(mvMatrix, degToRad(powerUpAngle), [0, 1, 0]);
        drawPowerUps(1);
    }

    if (pickedPowerUps.length < 3) {
        mat4.identity(mvMatrix);
        mat4.translate(mvMatrix, [-xPosition + 3, -yPosition + 0.8, -zPosition - 130]);
        mat4.rotate(mvMatrix, degToRad(powerUpAngle), [0, 1, 0]);
        drawPowerUps(2);
    }

    if (pickedPowerUps.length < 4) {
        mat4.identity(mvMatrix);
        mat4.translate(mvMatrix, [-xPosition - 1, -yPosition + 0.8, -zPosition - 190]);
        mat4.rotate(mvMatrix, degToRad(powerUpAngle), [0, 1, 0]);
        drawPowerUps(3);
    }
    if (pickedPowerUps.length < 5) {
        mat4.identity(mvMatrix);
        mat4.translate(mvMatrix, [-xPosition - 2, -yPosition + 0.8, -zPosition - 260]);
        mat4.rotate(mvMatrix, degToRad(powerUpAngle), [0, 1, 0]);
        drawPowerUps(4);
    }

}

function drawPowerUps(index) {

    mvPushMatrix();
    gl.bindBuffer(gl.ARRAY_BUFFER, powerVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, powerVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
    //dodaj za teksturo!
    gl.bindBuffer(gl.ARRAY_BUFFER, powerVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, powerVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);
    var texture = powerUpBonusBuffer[index];
    gl.activeTexture(gl.TEXTURE0);
    if (texture == "speed") {
        gl.bindTexture(gl.TEXTURE_2D, boostTexture);
    } else if (texture == "health") {
        gl.bindTexture(gl.TEXTURE_2D, healthTexture);
    }
    gl.uniform1i(shaderProgram.samplerUniform, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, powerVertexNormalBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, powerVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, powerVertexIndexBuffer);
    setMatrixUniforms();
    gl.drawElements(gl.TRIANGLES, powerVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    mvPopMatrix();
}

function animate() {
    var timeNow = new Date().getTime();
    if (lastTime != 0) {
        var elapsed = timeNow - lastTime;
        powerUpAngle += 0.05 * elapsed;
    }
    lastTime = timeNow;
}


var previousSpeed = 0;
var pauseFlag = false;

function handleKeys(e) {
    if (e.code == "KeyA") {
        if (xPosition == -2) {
            xPosition = -4;
        } else if (xPosition == 0) {
            xPosition = -2;
        } else if (xPosition == 2) {
            xPosition = 0;
        } else if (xPosition == 4) {
            xPosition = 2;
        }
    } else if (e.code == "KeyD") {
        if (xPosition == -4) {
            xPosition = -2;
        } else if (xPosition == -2) {
            xPosition = 0;
        } else if (xPosition == 0) {
            xPosition = 2;
        } else if (xPosition == 2) {
            xPosition = 4;
        }

    } else if (e.code == "KeyW" && yPosition == 2.75) {
        yPosition = 3.5
    } else if (e.code = "KeyS" && yPosition == 3.5) {
        yPosition = 2.75

    } else if (e.code = "KeyE" && (yPosition == 2.75 || yPosition == 3.5)) {


        if (!pauseFlag) {

            previousSpeed = speed;
            speed = 0;
            //e.preventDefault();
            pauseFlag = true;
        } else {
            speed = previousSpeed;
            pauseFlag = false;

        }


    } else {
        e.preventDefault();
    }
    e.preventDefault();
}

function initUI() {
    scoreElement = document.getElementById("score");
    healthElement = document.getElementById("health");

}




function start() {
    canvas = document.getElementById("glcanvas");

    gl = initGL(canvas); // Initialize the GL context

    // Only continue if WebGL is available and working
    if (gl) {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // Set clear color to black, fully opaque
        gl.clearDepth(1.0); // Clear everything
        gl.enable(gl.DEPTH_TEST); // Enable depth testing
        gl.depthFunc(gl.LEQUAL); // Near things obscure far things
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // Initialize the shaders; this is where all the lighting for the
        // vertices and so forth is established.
        initObstacleBuffer();
        initUI();
        console.log("UI pognan");
        initShaders();
        console.log("ShaderProgram pognan");
        initTextures();
        loadBackground();
        loadPowerUps();
        console.log("Teksture inicializirane");
        loadShip();
        loadWorld();
        loadObstacles();
        console.log("Objekti nalozeni");


        // Set up to draw the scene periodically.
        intervalId = setInterval(function() {
            if (texturesLoaded == numberOfTextures) { // only draw scene and animate when textures are loaded.
                zPosition -= 0.25 * speed;
                if (zPosition == -200) {
                    speed *= 2;
                }
                // if (!pauseFlag) {
                handleCollisions(function() {
                    requestAnimationFrame(animate);
                    updateShipLine();
                    document.addEventListener("keypress", handleKeys);
                    drawScene();
                });
                //}





            }
        }, 15);
    }
}