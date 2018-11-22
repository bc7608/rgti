var canvas;
var gl;

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

function start() {
    canvas = document.getElementById("glcanvas");

    gl = initGL(canvas); // Initialize the GL context
    if (gl) {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // Set clear color to black, fully opaque
        gl.clearDepth(1.0); // Clear everything
        gl.enable(gl.DEPTH_TEST); // Enable depth testing
        gl.depthFunc(gl.LEQUAL); // Near things obscure far things
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Initialize the shaders; this is where all the lighting for the
        // vertices and so forth is established.
        //initShaders();

        // Next, load and set up the textures we'll be using.
        //initTextures();
        //loadTeapot();

        // Set up to draw the scene periodically.
        /*setInterval(function() {
          if (texturesLoaded == numberOfTextures) { // only draw scene and animate when textures are loaded.
            requestAnimationFrame(animate);
            drawScene();
          }
        }, 15);*/
    }
}