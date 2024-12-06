/** @type {HTMLCanvasElement} */

// Diese Variante orientiert sich näher an den Prinzipien, wie sie in Physik-Engines wie Box2D eingesetzt werden.
// Box2D verwendet einen sogenannten "Sequential Impulse Solver", der iterativ Kollisionen durch Impulse korrigiert, 
// sowie eine Positionskorrektur (Baumgarte Stabilization), um Penetration zwischen Körpern zu verringern.
// Hier ist eine vereinfachte Version für Kreise:
// 
// Grundprinzip:
// 1. Integrationsschritt: Aktualisiere Positionen basierend auf Geschwindigkeit und Beschleunigung (Gravitation).
// 2. Kollisionsdetektion: Finde alle Paare von Kreisen, die sich überlappen.
// 3. Kollisionsauflösung (Impulse basierend auf relativer Geschwindigkeit und Normalenrichtungsvektor).
// 4. Positionskorrektur (um Penetration aufzuheben, ähnlich wie Baumgarte in Box2D).
// 5. Mehrere Iterationen pro Frame, um stabile Ergebnisse zu erzielen (z.B. 10 Iterationen).
//
// Zusätzlich werden Reibung und Restitution berücksichtigt, um realistischer wirkende Kontakte zu erhalten.
// Die Kreise sollten sich nun stabiler verhalten und nicht unbegrenzt Energie gewinnen. 
// Komplett perfekt wird es nicht, aber deutlich besser als rein naive Lösungen.
//
// Einstellungen wie restitution, friction, allowedPenetration und correctionFactor können feinjustiert werden, 
// um ein besseres Ergebnis zu erzielen.
//
// Hinweis: Box2D ist weit komplexer, nutzt Warm Starting, feature-reiche Broadphase/Narrowphase-CD usw. 
// Dies hier ist nur ein sehr vereinfachtes Modell.
// 
// Viel Erfolg!


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
let MAX_KREIS_RADIUS = 29;
let Kreise = [];
let MausKreis;

const colors = ["#d7d9b1","#aec3c0","#84acce","#838fb0","#827191"];

// Simulationsparameter
let dt = 1/60;       // time step
let iterations = 4;  // Anzahl der Impulsiterationen pro Frame für Kollisionslösung
let gravity = 400;    // Pixel/s^2 nach unten
let restitution = 0.8; // Rückprallfaktor
let friction = 0.3;   // Einfache Reibung
let allowedPenetration = 0.01; // Penetrationstoleranz
let correctionFactor = 0.2; // wie stark Penetration korrigiert wird
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

        this.vx = (Math.random()-0.5)*50; // Startgeschwindigkeit
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
    const maxParticles = calculateMaxParticles();
    anzParticles.max = maxParticles;
    if (parseInt(anzParticles.value) > maxParticles) {
        anzParticles.value = maxParticles;
        anzParticlesOutput.innerHTML = maxParticles;
        ANZ_KREISE = maxParticles;
    }
}

//#endregion


//#region -------- Init & Setup --------

function init(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    updateParticleSlider();

    MausKreis = new Kreis(mouse.x, mouse.y, 50, "white");
    Kreise = [];
    Kreise.push(MausKreis);

    for(let i=0; i<ANZ_KREISE; i++){
        let radius = Math.floor(Math.random() * MAX_KREIS_RADIUS + 1);
        let x = randomIntFromRange(radius*2, canvas.width - radius*2);
        let y = randomIntFromRange(radius*2, canvas.height - radius*2);

        for(let j=0; j<Kreise.length; j++){
            if(getDistanceCircle(x,y,Kreise[j].x,Kreise[j].y) < radius + Kreise[j].radius){
                x = randomIntFromRange(radius*2, canvas.width - radius*2);
                y = randomIntFromRange(radius*2, canvas.height - radius*2);
                j = -1;
            }
        }
        Kreise.push(new Kreis(x,y,radius, randomColor(colors)));
    }

    collisions = 0;
}

//#endregion


//#region -------- Collision Detection & Resolution --------

// Kontaktstruktur
// Speichert Daten zwischen zwei Kreisen für Kollision
class Contact {
    constructor(a, b, nx, ny, penetration) {
        this.a = a;   // erster Kreis
        this.b = b;   // zweiter Kreis
        this.nx = nx; // Normalenvektor x (vom a zum b)
        this.ny = ny; // Normalenvektor y
        this.penetration = penetration;
    }

    resolvePenetration() {
        // Positionskorrektur, ähnlich wie in Box2D (baumgarte)
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
        // Relativgeschwindigkeit
        let rvx = this.b.vx - this.a.vx;
        let rvy = this.b.vy - this.a.vy;

        // Geschwindigkeit entlang der Normalen
        let velAlongNormal = rvx * this.nx + rvy * this.ny;
        if(velAlongNormal > 0) return; // Sie bewegen sich auseinander, kein Impuls nötig

        // Berechne restitution
        let e = Math.min(restitution, restitution);

        // Impulsstärke
        let j = -(1+e)*velAlongNormal;
        let invMassSum = this.a.invMass + this.b.invMass;
        if(invMassSum <= 0) return;
        j = j / invMassSum;

        // Impuls anwenden
        let jx = this.nx * j;
        let jy = this.ny * j;

        this.a.vx -= jx * this.a.invMass;
        this.a.vy -= jy * this.a.invMass;
        this.b.vx += jx * this.b.invMass;
        this.b.vy += jy * this.b.invMass;

        // Reibung
        // Tangentialrichtung bestimmen
        rvx = this.b.vx - this.a.vx;
        rvy = this.b.vy - this.a.vy;

        // Tangentialvektor = rv - (rv·n)*n
        let rvDotN = rvx*this.nx + rvy*this.ny;
        let tx = rvx - rvDotN*this.nx;
        let ty = rvy - rvDotN*this.ny;
        let tl = Math.sqrt(tx*tx+ty*ty);
        if(tl > 1e-7) {
            tx /= tl; ty /= tl; 
        } else {
            tx = 0; ty = 0;
        }

        // Tangentialgeschwindigkeit
        let velAlongT = rvx*tx + rvy*ty;
        let jt = -velAlongT;
        jt = jt / invMassSum;

        // Reibung begrenzen
        let mu = friction;
        let jtMax = j * mu;
        if(Math.abs(jt) > jtMax) {
            jt = jt > 0 ? jtMax : -jtMax;
        }

        // Tangentialen Impuls
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
                    // Notfall: liegen fast am gleichen Ort
                    // Schubse minimal auseinander
                    // Normal arbiträr
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
    // Positionsintegration
    for (let i=0; i<Kreise.length; i++){
        const k = Kreise[i];
        if (k === MausKreis && !k.hasGravity) {
            k.vx = (mouse.x - k.x)*10; 
            k.vy = (mouse.y - k.y)*10;
        } else if (k.hasGravity) {
            k.vy += gravity * dt;
        }

        // Euler Integration
        k.x += k.vx * dt;
        k.y += k.vy * dt;

        // Randkollisionen
        // Boden
        if(k.y + k.radius > canvas.height) {
            k.y = canvas.height - k.radius;
            // normal velocity flip
            k.vy = -k.vy * restitution;
            // etwas reibung auf vx
            k.vx *= 0.9;
        }
        // Decke
        if(k.y - k.radius < 0) {
            k.y = k.radius;
            k.vy = -k.vy * restitution;
        }
        // Linke Wand
        if(k.x - k.radius < 0) {
            k.x = k.radius;
            k.vx = -k.vx * restitution;
        }
        // Rechte Wand
        if(k.x + k.radius > canvas.width) {
            k.x = canvas.width - k.radius;
            k.vx = -k.vx * restitution;
        }
    }

    // Kontakte suchen
    let contacts = findContacts();

    // Mehrere Durchläufe um Kontakte zu lösen
    for(let iter=0; iter<iterations; iter++){
        for(let c of contacts) {
            // Velocity solve
            c.resolveVelocity();
        }

        for(let c of contacts) {
            // Position solve
            c.resolvePenetration();
        }
    }

    // Kinetische Energie berechnen
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
    anzParticlesOutput.innerHTML = anzParticles.value;
    ANZ_KREISE = anzParticles.value;
    Kreise = [];
    MausKreis.hasGravity = false;
    gravityBTN.style.color = "#804768";
    gravityBTN.style.backgroundColor = "lightblue";
    gravityBTN.style.boxShadow = "2px 2px 10px black";
    init();
}

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
                // Geschwindigkeit zurücksetzen
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
