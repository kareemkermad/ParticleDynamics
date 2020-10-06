import {Particle, Plane, Scene, Spring, Vector2} from "./particle.js"

var canvas = document.createElement('canvas');
var context = canvas.getContext('2d');
var root = document.getElementById('root');

root.appendChild(canvas);

resizeCanvas();

var scene = new Scene();

var concrete = scene.addMaterial();
var rubber = scene.addMaterial();

scene.setRestitution(concrete, rubber, 1.0);
scene.setFriction(concrete, rubber, 0.9);

var ppm = 100;

var left = Plane.fromAngle(Math.PI * 0.25, new Vector2(-6, 0), concrete);
var right = Plane.fromAngle(Math.PI * 0.75, new Vector2(6, 0), concrete);
var floor = new Plane(new Vector2(0, 1), new Vector2(0, -2), concrete);
var ceiling = new Plane(new Vector2(0, -1), new Vector2(0, 6), concrete);

var ball1 = new Particle(new Vector2(0, 0), Vector2.zero(), 0.5, 1, 0.5, rubber);
var ball2 = new Particle(new Vector2(0, 1), Vector2.zero(), 0.5, 1, 0.5, rubber);
var ball3 = new Particle(new Vector2(1, 0), Vector2.zero(), 0.5, 1, 0.5, rubber);
var ball4 = new Particle(new Vector2(1, 1), Vector2.zero(), 0.5, 1, 0.5, rubber);

var ks = 1000.0;
var kd = 2.0 * Math.sqrt(ks * 1.0);
var spring1 = Spring.atRest(ball1, ball2, ks, kd);
var spring2 = Spring.atRest(ball2, ball4, ks, kd);
var spring3 = Spring.atRest(ball4, ball3, ks, kd);
var spring4 = Spring.atRest(ball3, ball1, ks, kd);
var spring5 = Spring.atRest(ball2, ball3, ks, kd);
var spring6 = Spring.atRest(ball1, ball4, ks, kd);

scene.planes.push(ceiling, floor, right, left);
scene.particles.push(ball1, ball2, ball3, ball4);
scene.springs.push(spring1, spring2, spring3, spring4, spring5, spring6);

function canvasLength(worldLength) {
    return worldLength * ppm;
}

function canvasPosition(worldPosition) {
    return new Vector2(canvas.width * 0.5 + worldPosition.x * ppm, canvas.height * 0.5 - worldPosition.y * ppm);
}

function canvasVector(worldVector) {
    return new Vector2(worldVector.x * ppm, -worldVector.y * ppm);
}

function worldLength(canvasLength) {
    return canvasLength / ppm;
}

function worldPosition(canvasPosition) {
    return new Vector2((canvasPosition.x - canvas.width * 0.5) / ppm, (-canvasPosition.y + canvas.height * 0.5) / ppm);
}

function worldVector(canvasVector) {
    return new Vector2(canvasVector.x / ppm, -canvasVector.y / ppm);
}

var interaction = new Spring(new Particle(Vector2.zero(), Vector2.zero(), 0, 0, 0, -1), null, 0, 100, 0.0);
var interacting = false;

function endInteraction() {
    if (interacting) {
        var index = scene.springs.indexOf(interaction);
        if (index >= 0) {
            scene.springs[index] = scene.springs[scene.springs.length - 1];
            scene.springs.pop();
        }
        interacting = false;
    }
}

function onMouseDown(e) {
    endInteraction();
    var pos = worldPosition(new Vector2(e.x, e.y));
    scene.particles.forEach(particle => {
        if (particle.invmass > 0) {
            var distanceSq = Vector2.subtract(particle.position, pos).magnitudeSq();
            if (distanceSq < particle.radius * particle.radius) {
                interaction.p1.position = pos;
                interaction.p2 = particle;
                interaction.kd = 2.0 * Math.sqrt(interaction.ks / particle.invmass);
                interacting = true;
                scene.springs.push(interaction);
                return;
            }
        }
    });
}

function onMouseUp(e) {
    endInteraction();
}

function onMouseMove(e) {
    if (interacting) {
        interaction.p1.position = worldPosition(new Vector2(e.x, e.y));
    }
}

function onWheel(e) {
    ppm = Math.max(10, ppm - e.deltaY * 0.1);
}

canvas.onmousedown = onMouseDown;
canvas.onmouseup = onMouseUp;
canvas.onmousemove = onMouseMove;
canvas.onwheel = onWheel;

function renderSpring(spring) {
    context.beginPath();
    var p1 = canvasPosition(spring.p1.position);
    var p2 = canvasPosition(spring.p2.position);
    context.moveTo(p1.x, p1.y);
    context.lineTo(p2.x, p2.y);
    context.strokeStyle = "black";
    context.stroke();
}

function renderParticle(particle) {
    context.beginPath();
    var pos = canvasPosition(particle.position);
    context.arc(pos.x, pos.y, canvasLength(particle.radius), 0, 2 * Math.PI);
    context.closePath();    
    context.fillStyle = "red";
    context.fill();
}

function renderPlane(plane) {
    var length = 10000.0;
    var origin = canvasPosition(plane.origin);
    var side = Vector2.scale(canvasVector(plane.normal.orthogonal()), length);
    var back = Vector2.scale(canvasVector(plane.normal), -length);
    var p1 = Vector2.add(origin, side);
    var p2 = Vector2.subtract(origin, side);
    var p3 = Vector2.add(p2, back);
    var p4 = Vector2.add(p1, back);

    context.beginPath();
    context.moveTo(p1.x, p1.y);
    context.lineTo(p2.x, p2.y);
    context.lineTo(p3.x, p3.y);
    context.lineTo(p4.x, p4.y);
    context.closePath();
    context.fillStyle = "#808080";
    context.fill();
}

function renderScene() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    scene.planes.forEach(plane => {
        renderPlane(plane);
    });
    scene.particles.forEach(particle => {
        renderParticle(particle);
    });
    scene.springs.forEach(spring => {
        renderSpring(spring);
    });
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

renderScene();
//window.addEventListener("resize", resizeCanvas, false)

var oldTime = 0;
var substeps = 10;
function advance(time) {
    requestAnimationFrame(advance);
    if (time) {
        var dt = time - oldTime;
        oldTime = time;
        for (var i = 0; i < substeps; i++) {
            scene.step(dt * 0.001 / substeps);
        }
        renderScene();
    }
}

requestAnimationFrame(advance);
