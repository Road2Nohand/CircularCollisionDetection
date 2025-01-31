/** @type {HTMLCanvasElement} */

// Diese Variante nutzt einen vereinfachten, Box2D-ähnlichen Ansatz für die Kreiskollisionen mit iterativer Impuls-
// und Positionskorrektur.
//
// Erweiterung: Wenn der Max-Radius-Slider verändert wird, sollen auch der Partikel-Slider sowie die Anzahl 
// der Partikel entsprechend neu berechnet und angepasst werden, so wie bei einer Neu-Initialisierung.
//
// Vorgehen:
// - Bei Änderung des Max-Radius-Sliders wird zuerst geprüft, ob der gewählte Wert in das Canvas passt.
// - Danach wird der Partikel-Slider via updateParticleSlider() neu angepasst, da sich der maximal mögliche Wert
//   aufgrund des veränderten Radius ändern kann.
// - Anschließend wird die Simulation neu initiiert.

//#region -------- Globals & Setup --------

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth * 0.8; 
canvas.height = window.innerHeight * 0.8; 

const collisionCounter = document.getElementById("collisionCounter");
let collisions = 0;

const kinetikCounter = document.getElementById("kinetikCounter");
let gesKinetik = 0;

const drawDistancesCheckBox = document.getElementById("drawDistances");
let drawDistances = drawDistancesCheckBox.checked;

const drawVectorsCheckBox = document.getElementById("drawVectors");
let drawVectors = drawVectorsCheckBox.checked;

let anzParticles = document.getElementById("anzParticles");
let anzParticlesOutput = document.getElementById("anzParticlesOutput");
let ANZ_KREISE = anzParticles.value;
anzParticlesOutput.innerHTML = anzParticles.value;

let gravityBTN = document.getElementById("gravityBTN");

let mouse = { x: 0, y: 0 };
let MAX_KREIS_RADIUS = 30;  // Standardwert für max Radius

// Neuer Slider für MAX_KREIS_RADIUS
let maxRadiusSlider = document.getElementById("maxRadiusSlider");
let maxRadiusOutput = document.getElementById("maxRadiusOutput");
maxRadiusOutput.innerHTML = MAX_KREIS_RADIUS;

let Kreise = [];
let MausKreis;

const colors = ["#d7d9b1","#aec3c0","#84acce","#838fb0","#827191"];

// Simulationsparameter
let dt = 1/60;       // time step
let iterations = 4;  // Anzahl der Impulsiterationen pro Frame
let gravity = 400;    // Pixel/s^2 nach unten
let restitution = 0.8; // Rückprallfaktor
let friction = 1;   // Einfache Reibung
let allowedPenetration = 0.01; 
let correctionFactor = 0.2; 

//#endregion


//#region -------- Klassen --------

class Kreis {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.mass = Math.PI * radius * radius; // Masse proportional zur Fläche
        this.invMass = (this.mass > 0) ? 1/this.mass : 0;

        this.vx = (Math.random()-0.5)*50; 
        this.vy = (Math.random()-0.5)*50;

        this.hasGravity = false;
    }

    draw() {
        if (drawVectors) {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.vx*0.1, this.y + this.vy*0.1);
            ctx.strokeStyle = "white";
            ctx.stroke();
        }

        if(drawDistances){
            ctx.globalAlpha = 0.1;
            for(let i=0; i<Kreise.length; i++){
                if(Kreise[i] !== this) {
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(Kreise[i].x, Kreise[i].y);
                    ctx.strokeStyle = "white";
                    ctx.stroke();
                }
            }
            ctx.globalAlpha = 1;
        }

        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fill();
    }

    inCanvas() {
        if(this.x + this.radius > canvas.width || this.x - this.radius < 0) return false;
        if(this.y + this.radius > canvas.height || this.y - this.radius < 0) return false;
        return true;
    }
}
//#endregion


//#region -------- Hilfsfunktionen --------

function randomIntFromRange(min, max) {
    return Math.floor(Math.random()*(max - min + 1)+min);
}

function randomColor(colors) {
    return colors[Math.floor(Math.random()*colors.length)];
}

function getDistanceCircle(x1,y1,x2,y2){
    let dx = x2 - x1;
    let dy = y2 - y1;
    return Math.sqrt(dx*dx + dy*dy);
}

function calculateMaxParticles() {
    const circleArea = Math.PI * Math.pow(MAX_KREIS_RADIUS, 2);
    const canvasArea = canvas.width * canvas.height;
    const packingFactor = 0.6;
    return Math.floor((canvasArea * packingFactor) / circleArea);
}

function updateParticleSlider() {
    let maxParticles = calculateMaxParticles();
    // Begrenzung auf 4000 setzen
    maxParticles = Math.min(maxParticles, 4000);

    anzParticles.max = maxParticles;

    if (parseInt(anzParticles.value) > maxParticles) {
        anzParticles.value = maxParticles;
    }
    ANZ_KREISE = anzParticles.value;
    anzParticlesOutput.innerHTML = anzParticles.value;
}

//#endregion


//#region -------- Init & Setup --------

function init(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Sicherstellen, dass MAX_KREIS_RADIUS nicht zu groß ist.
    let maxAllowedRadius = Math.floor(Math.min(canvas.width, canvas.height)/2 - 1);
    if (MAX_KREIS_RADIUS > maxAllowedRadius) {
        MAX_KREIS_RADIUS = maxAllowedRadius;
        maxRadiusSlider.value = MAX_KREIS_RADIUS;
        maxRadiusOutput.innerHTML = MAX_KREIS_RADIUS;
    }

    // Partikel-Anzahl Slider updaten, da sich durch neuen MAX_KREIS_RADIUS die max. Anzahl ändern kann
    updateParticleSlider();

    MausKreis = new Kreis(mouse.x, mouse.y, 50, "white");
    Kreise = [];
    Kreise.push(MausKreis);

    for(let i=0; i<ANZ_KREISE; i++){
        let radius = Math.floor(Math.random() * MAX_KREIS_RADIUS + 1);

        // Falls radius so groß, dass er nicht passen kann, überspringen
        if(radius*2 > canvas.width || radius*2 > canvas.height) {
            continue;
        }

        let x = randomIntFromRange(radius*2, canvas.width - radius*2);
        let y = randomIntFromRange(radius*2, canvas.height - radius*2);

        let attempts = 0;
        let placed = false;
        while(attempts < 50){
            let overlapFound = false;
            for(let j=0; j<Kreise.length; j++){
                if(getDistanceCircle(x,y,Kreise[j].x,Kreise[j].y) < radius + Kreise[j].radius){
                    overlapFound = true;
                    break;
                }
            }
            if(!overlapFound){
                placed = true;
                break;
            } else {
                x = randomIntFromRange(radius*2, canvas.width - radius*2);
                y = randomIntFromRange(radius*2, canvas.height - radius*2);
                attempts++;
            }
        }

        if(placed) {
            Kreise.push(new Kreis(x,y,radius, randomColor(colors)));
        }
    }

    collisions = 0;
}

//#endregion


//#region -------- Kontakt & Kollision --------

class Contact {
    constructor(a, b, nx, ny, penetration) {
        this.a = a;   // erster Kreis
        this.b = b;   // zweiter Kreis
        this.nx = nx; // Normalenvektor x
        this.ny = ny; // Normalenvektor y
        this.penetration = penetration;
    }

    resolvePenetration() {
        const totalInvMass = this.a.invMass + this.b.invMass;
        if(totalInvMass <= 0) return;

        const correction = (Math.max(this.penetration - allowedPenetration, 0) 
                            * correctionFactor) / totalInvMass;

        const cx = this.nx * correction;
        const cy = this.ny * correction;

        this.a.x -= cx * this.a.invMass;
        this.a.y -= cy * this.a.invMass;
        this.b.x += cx * this.b.invMass;
        this.b.y += cy * this.b.invMass;
    }

    resolveVelocity() {
        let rvx = this.b.vx - this.a.vx;
        let rvy = this.b.vy - this.a.vy;

        let velAlongNormal = rvx * this.nx + rvy * this.ny;
        if(velAlongNormal > 0) return; 

        let e = Math.min(restitution, restitution);

        let j = -(1+e)*velAlongNormal;
        let invMassSum = this.a.invMass + this.b.invMass;
        if(invMassSum <= 0) return;
        j = j / invMassSum;

        let jx = this.nx * j;
        let jy = this.ny * j;

        this.a.vx -= jx * this.a.invMass;
        this.a.vy -= jy * this.a.invMass;
        this.b.vx += jx * this.b.invMass;
        this.b.vy += jy * this.b.invMass;

        // Friction
        rvx = this.b.vx - this.a.vx;
        rvy = this.b.vy - this.a.vy;

        let rvDotN = rvx*this.nx + rvy*this.ny;
        let tx = rvx - rvDotN*this.nx;
        let ty = rvy - rvDotN*this.ny;
        let tl = Math.sqrt(tx*tx+ty*ty);
        if(tl > 1e-7) {
            tx /= tl; 
            ty /= tl; 
        } else {
            tx = 0; 
            ty = 0;
        }

        let velAlongT = rvx*tx + rvy*ty;
        let jt = -velAlongT;
        jt = jt / invMassSum;

        let mu = friction;
        let jtMax = j * mu;
        if(Math.abs(jt) > Math.abs(jtMax)) {
            jt = (jt > 0) ? jtMax : -jtMax;
        }

        let jtx = tx * jt;
        let jty = ty * jt;
        this.a.vx -= jtx * this.a.invMass;
        this.a.vy -= jty * this.a.invMass;
        this.b.vx += jtx * this.b.invMass;
        this.b.vy += jty * this.b.invMass;
    }
}

function findContacts() {
    let contacts = [];
    for(let i=0; i<Kreise.length; i++){
        for(let j=i+1; j<Kreise.length; j++){
            const A = Kreise[i];
            const B = Kreise[j];
            const dx = B.x - A.x;
            const dy = B.y - A.y;
            const distSq = dx*dx + dy*dy;
            const minDist = A.radius + B.radius;
            if(distSq < minDist*minDist) {
                let dist = Math.sqrt(distSq);
                if(dist < 1e-7) {
                    const nx = 1; 
                    const ny = 0;
                    const pen = minDist;
                    contacts.push(new Contact(A,B,nx,ny,pen));
                } else {
                    const nx = dx/dist;
                    const ny = dy/dist;
                    const pen = minDist - dist;
                    contacts.push(new Contact(A,B,nx,ny,pen));
                }
            }
        }
    }
    return contacts;
}

//#endregion


//#region -------- Simulation --------

function step() {
    // Integration
    for (let i=0; i<Kreise.length; i++){
        const k = Kreise[i];
        if (k === MausKreis && !k.hasGravity) {
            k.vx = (mouse.x - k.x)*10; 
            k.vy = (mouse.y - k.y)*10;
        } else if (k.hasGravity) {
            k.vy += gravity * dt;
        }

        k.x += k.vx * dt;
        k.y += k.vy * dt;

        // Randkollisionen
        if(k.y + k.radius > canvas.height) {
            k.y = canvas.height - k.radius;
            k.vy = -k.vy * restitution;
            k.vx *= 0.9;
        }
        if(k.y - k.radius < 0) {
            k.y = k.radius;
            k.vy = -k.vy * restitution;
        }
        if(k.x - k.radius < 0) {
            k.x = k.radius;
            k.vx = -k.vx * restitution;
        }
        if(k.x + k.radius > canvas.width) {
            k.x = canvas.width - k.radius;
            k.vx = -k.vx * restitution;
        }
    }

    let contacts = findContacts();

    for(let iter=0; iter<iterations; iter++){
        for(let c of contacts) {
            c.resolveVelocity();
        }

        for(let c of contacts) {
            c.resolvePenetration();
        }
    }

    // kinetische Energie
    gesKinetik = 0;
    for(let i=0; i<Kreise.length; i++) {
        const k = Kreise[i];
        const speed = Math.sqrt(k.vx*k.vx + k.vy*k.vy);
        if(k.color !== "white") gesKinetik += speed;
    }

    collisions += contacts.length;
    collisionCounter.innerHTML = "Circle Collisions: " + collisions;
    kinetikCounter.innerHTML = "Kinetische Energie: " + gesKinetik.toFixed(2);
}

function animate(){
    requestAnimationFrame(animate);
    ctx.clearRect(0,0,canvas.width, canvas.height);
    step();
    for(let k of Kreise){
        k.draw();
    }
}

//#endregion


//#region -------- Events --------

addEventListener("resize", () => {
    canvas.width = window.innerWidth *0.8; 
    canvas.height = window.innerHeight *0.8; 
    Kreise = [];
    init();
});

addEventListener("mousemove", e => {
    mouse.x = e.clientX - canvas.getBoundingClientRect().x; 
    mouse.y = e.clientY - canvas.getBoundingClientRect().y;
});

addEventListener("touchmove", e => {
    mouse.x = e.touches[0].clientX - canvas.getBoundingClientRect().x;
    mouse.y = e.touches[0].clientY - canvas.getBoundingClientRect().y;
});

drawDistancesCheckBox.onchange = e => {
    drawDistances = e.target.checked;
};

drawVectorsCheckBox.onchange = e => {
    drawVectors = e.target.checked;
};

anzParticles.oninput = () => {
    // Anzahl wurde geändert -> ANZ_KREISE anpassen
    ANZ_KREISE = anzParticles.value;
    anzParticlesOutput.innerHTML = anzParticles.value;
    Kreise = [];
    MausKreis.hasGravity = false;
    gravityBTN.style.color = "#804768";
    gravityBTN.style.backgroundColor = "lightblue";
    gravityBTN.style.boxShadow = "2px 2px 10px black";
    init();
}

// EventListener für den MAX_KREIS_RADIUS Slider
maxRadiusSlider.oninput = () => {
    MAX_KREIS_RADIUS = parseInt(maxRadiusSlider.value);
    maxRadiusOutput.innerHTML = MAX_KREIS_RADIUS;

    // Prüfung falls zu groß
    let maxAllowedRadius = Math.floor(Math.min(canvas.width, canvas.height)/2 - 1);
    if (MAX_KREIS_RADIUS > maxAllowedRadius) {
        MAX_KREIS_RADIUS = maxAllowedRadius;
        maxRadiusSlider.value = MAX_KREIS_RADIUS;
        maxRadiusOutput.innerHTML = MAX_KREIS_RADIUS;
    }

    // Partikelanzahl neu berechnen und Slider updaten
    updateParticleSlider();

    Kreise = [];
    MausKreis.hasGravity = false;
    gravityBTN.style.color = "#804768";
    gravityBTN.style.backgroundColor = "lightblue";
    gravityBTN.style.boxShadow = "2px 2px 10px black";
    init();
};

addEventListener("click", () => {
    if(MausKreis.hasGravity){
        MausKreis.hasGravity = false;
        MausKreis.color = "white";
        MausKreis.x = mouse.x;
        MausKreis.y = mouse.y;
        MausKreis.vx = 0;
        MausKreis.vy = 0;
    }
    else if(MausKreis.inCanvas() && !MausKreis.hasGravity){
        MausKreis.color = randomColor(colors);
        MausKreis.hasGravity = true;
    }
});

gravityBTN.onclick = () => {
    let anyWithGravity = false;
    for (let i=0; i<Kreise.length; i++){
        if(Kreise[i] !== MausKreis) {
            if(Kreise[i].hasGravity){
                anyWithGravity = true;
            }
        }
    }
    if(anyWithGravity){
        for (let i=0; i<Kreise.length; i++){
            if(Kreise[i] !== MausKreis) {
                Kreise[i].hasGravity = false;
            }
        }
        gravityBTN.style.color = "#804768";
        gravityBTN.style.backgroundColor = "lightblue";
        gravityBTN.style.boxShadow = "2px 2px 10px black";
        canvas.style.boxShadow = "2px 2px 20px black";
        gravityBTN.style.opacity = 0.6;
    } else {
        for (let i=0; i<Kreise.length; i++){
            if(Kreise[i] !== MausKreis) {
                Kreise[i].hasGravity = true;
                Kreise[i].vx = 0;
                Kreise[i].vy = 0;
            }
        }
        gravityBTN.style.color = "lightblue";
        gravityBTN.style.backgroundColor = "#804768";
        gravityBTN.style.boxShadow = "2px 2px 20px lightblue";
        gravityBTN.style.opacity = 1;
        canvas.style.boxShadow = "0px 10px 10px lightblue";
    }
};

//#endregion


//#region -------- Main --------
init();
animate();
//#endregion
