/** @type {HTMLCanvasElement} */ //Damit intelisense für ctx an ist


//#region --------  Globals -------- 

// #canvas
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth *0.8; //80% des Screens
canvas.height = window.innerHeight *0.8; //80% des Screens
console.log("canvas.width: " + canvas.width);
console.log("canvas.height: " + canvas.height);
const collisionCounter = document.getElementById("collisionCounter");
let collisions = 0;

const kinetikCounter = document.getElementById("kinetikCounter");
let gesKinetik = 0;

//checkbox drawDistances
const drawDistancesCheckBox = document.getElementById("drawDistances");
let drawDistances = drawDistancesCheckBox.checked;

//checkbox drawVectors
const drawVectorsCheckBox = document.getElementById("drawVectors");
let drawVectors = drawVectorsCheckBox.checked;

//slider von anzParticles
let anzParticles = document.getElementById("anzParticles");
let anzParticlesOutput = document.getElementById("anzParticlesOutput");
anzKreise = anzParticles.value;
anzParticles.value = anzKreise;
anzParticlesOutput.innerHTML = anzParticles.value;

// Gravity Button
let gravityBTN = document.getElementById("gravityBTN");

//MausPos wegspeichern, als objekt mit x,y Attributen, standardmäßig zenriert
let mouse = {
    x: 0,
    y: 0
}
var MausKreis;

let Kreise = []; //Array an Kreis Partikeln

//color Template
const colors = ["#d7d9b1","#aec3c0","#84acce","#838fb0","#827191"];

// Updates pro Frame für stabilere Simulation
let updatesPerFrame = 6;

// Reibungskoeffiziente damit bei eingeschalteter Gravitation nicht ewig weiter bouncen 
// -> Funktioniert nicht glitchen noch mehr ineinander weil sie keine Kraft mehr haben um sich zu "wehren", 
// --> hier muss generell eher ein anderer Collision Algorithmus wie z.B. verwendet werden "Verlet Integration" ist viel besser vermutlich
// In der "Verlet Integration" geht es um Positionsveränderungen über die Zeit, hier werden die Geschwindigkeiten nur indirekt berechnet, anders wie bei meiner Variante mit dem oneD-Newtonian
// ToDo: https://www.youtube.com/watch?v=-GWTDhOQU6M&ab_channel=pikuma durcharbeiten
const frictionCoefficient = 0; 


//#endregion -----  Globals -------- 




//#region -------- Klassen --------

class Kreis {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.hasGravity = false;
        this.color = color;
        this.mass = 1 * radius; //Masse proportional zur größe
        this.velocityVector = {
          x: Math.random() - 0.5, // [-0.5, 0.5]
          y: Math.random() - 0.5
        };
    }
  
    draw() {

        if(drawVectors){
            ctx.fillStyle = "white"; // wird von this.color irwo überschrieben
            ctx.beginPath();
            ctx.globalAlpha = 1;
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.velocityVector.x*100, this.y + this.velocityVector.y*100);
            ctx.stroke();
        }

        if(drawDistances){
            for(let i=0; i<Kreise.length; i++){
                ctx.fillStyle = "white"; // wird von this.color irwo überschrieben
                ctx.beginPath();
                ctx.globalAlpha = 0.1;
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(Kreise[i].x, Kreise[i].y);
                ctx.stroke();
            }
        }

        ctx.beginPath();
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.color;
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fill();
        ctx.closePath();
    }//draw()
  

    update() {

        // Die Reihenfolge der hier aufgeführten Bedingungen der Kreise ist entscheident, da ein später folgende Position Aktualisierungen durch Bedinungen sich gegenseitig beeinflussen
        // Generell gilt: Die wichtigsten Bedingungen sollten zuerst folgen, wie z.B. die Collision mit den anderen Kreisen

        //checken der eigenen collisionen mit allen anderen Kreisen
        for (let i = 0; i < Kreise.length; i++) {
            //no circle should check collision with itself
            if (this === Kreise[i]) continue;

            let distance = getDistanceCircle(this.x, this.y, Kreise[i].x, Kreise[i].y);

            //if colliden
            if (distance <= this.radius + Kreise[i].radius) {
                //Newtons reaction on collision -> updating vectors of colliding objects
                oneDnewtonianCollision(this, Kreise[i]);
                collisions++;
                collisionCounter.innerHTML = "Circle Collisions: " + collisions;
            }
        }//for Circle Collision Detection 

        // checken collision links/rechts vom canvas
        if(this.x < this.radius || this.x > canvas.width - this.radius) {
            this.velocityVector.x = -this.velocityVector.x;
        }

        //checken collision oben/unten vom canvas
        if(this.y < this.radius || this.y > canvas.height - this.radius) {
            this.velocityVector.y = -this.velocityVector.y;
        }

        // Gravitation anwenden
        if(this.hasGravity){
            // hier müsste man eig prüfen, solange nicht in der Luft oder nicht auf einem anderen liegend
            if(this.y + this.radius < canvas.height){ //solange in der Luft
                this.velocityVector.y += 0.3 / updatesPerFrame;
            }
        }        


        //velocity Vektoren der Circles als LETZTES aktualiseren
            // MausKreis Vektoren updaten
        if(this === MausKreis && !this.hasGravity){
            //richtungsVektor bestimmen
            MausKreis.velocityVector.x =  mouse.x - MausKreis.x;
            MausKreis.velocityVector.y =  mouse.y - MausKreis.y;
        
            //Position aktualisieren
            MausKreis.x += MausKreis.velocityVector.x / updatesPerFrame;
            MausKreis.y += MausKreis.velocityVector.y / updatesPerFrame;
        }
            // normal circle Vektoren updaten
        else{ 
        
            //Position updating to new vector
            this.x += this.velocityVector.x / updatesPerFrame;
            this.y += this.velocityVector.y / updatesPerFrame;
            
            // Wenn die Energie zu hoch ist aktiviere Reibung bis unter 1
            // Verhindert dass die kinetische Energie explodiert bei Mausberührung
            if(Math.abs(this.velocityVector.x) > 1 || Math.abs(this.velocityVector.y) > 1){
                this.velocityVector.x *= Math.pow(0.98, 1/updatesPerFrame);
                this.velocityVector.y *= Math.pow(0.98, 1/updatesPerFrame);
            }
        }    
    
        this.draw(); //erst Position update, dann erst drawn für mehr Aktualität
    }//update()

    inCanvas() {
        //links oder rechts außerhalb
        if(this.x + this.radius > canvas.width || this.x - this.radius < 0) {
            return false;
        }
        //oben oder unten außerhalb
        else if(this.y + this.radius > canvas.height || this.y - this.radius < 0){
            return false;
        }
        else{
            return true;
        }
    }//inCanvas()

  }//endOf class Kreis

//#endregion ----- Klassen --------




//#region -------- Funktionen --------

function randomIntFromRange(min, max) {
    return Math.floor(Math.random() * (max-min+1)+min);
}

function randomColor(colors) {
    return colors[Math.floor(Math.random() * colors.length)];
}

//berechnet horizontalen und vertikalen abstand der Zentren um auf die Hypothenusenlänge und den Abstand zweier Kreise zu ermitteln
function getDistanceCircle(x_Kreis1, y_Kreis1, x_Kreis2, y_Kreis2) {
    let xDistance = x_Kreis2 - x_Kreis1;
    let yDistance = y_Kreis2 - y_Kreis1;    

    return Math.sqrt( Math.pow(xDistance, 2) + Math.pow(yDistance,2) );
}

//Winkel Rotierung für 1D Newtonian
function rotate(velocity, angle){
    const rotatedVelocities = {
        x: velocity.x * Math.cos(angle) - velocity.y * Math.sin(angle),
        y: velocity.x * Math.sin(angle) + velocity.y * Math.cos(angle)
    }
    return rotatedVelocities;
}

//"One-Dimensional Newtonian" (elastic collision)
function oneDnewtonianCollision(Kreis1, Kreis2) {
    //Differenzen der Geschwindigkeiten
    const xVelocityDiff = Kreis1.velocityVector.x - Kreis2.velocityVector.x;
    const yVelocityDiff = Kreis1.velocityVector.y - Kreis2.velocityVector.y;

    //Distanzen (dx und dy Kanten des Dreiecks um Winkel zu berechnen)
    const xDist = Kreis2.x - Kreis1.x;
    const yDist = Kreis2.y - Kreis1.y;

    //overlappen der Kreise erkennen & vermeiden
    if (xVelocityDiff*xDist + yVelocityDiff*yDist >= 0){

        //Winkel der beiden Kreise zueinander bekommen, damit wieder 1d gerechnet werden kann
        const angle = -Math.atan2(yDist, xDist);

        //die Massen der beiden Kreise in kurz speichern
        const m1 = Kreis1.mass;
        const m2 = Kreis2.mass;

        //Geschwindigkeit vor collision rotiert um angle, damit 1d
        const u1 = rotate(Kreis1.velocityVector, angle);
        const u2 = rotate(Kreis2.velocityVector, angle);

        //neue velocityVectoren berechnen
        const v1 = {
            x: u1.x * (m1 - m2) / (m1 + m2) + u2.x * 2 * m2 / (m1 + m2),
            y: u1.y
        };
        const v2 = {
            x: u2.x * (m1 - m2) / (m1 + m2) + u1.x * 2 * m1 / (m1 + m2),
            y: u2.y
        };

        //neue vektoren wieder richtig drehen um vorigen angle
        const vFinal1 = rotate(v1, -angle);
        const vFinal2 = rotate(v2, -angle);

        //Abschließend: alte Vektoren der Kreise durch neue ersetzen
        Kreis1.velocityVector.x = vFinal1.x;
        Kreis1.velocityVector.y = vFinal1.y;
        Kreis2.velocityVector.x = vFinal2.x;
        Kreis2.velocityVector.y = vFinal2.y;

        // Anwendung der Reibung bei aktivierter Gravitation
        if (Kreis1.hasGravity || Kreis2.hasGravity) {
            Kreis1.velocityVector.x *= 1 - frictionCoefficient;
            Kreis1.velocityVector.y *= 1 - frictionCoefficient;
            Kreis2.velocityVector.x *= 1 - frictionCoefficient;
            Kreis2.velocityVector.y *= 1 - frictionCoefficient;
        }
    }
}//endOf 1dCollision alla Newton


function init(){ //hier werden Objekte erstellt
    console.log("init()...");  
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    MausKreis = new Kreis(mouse.x, mouse.y, 50, "white");
    Kreise.push(MausKreis);  

    //i anzahl Kreise zufällig im rahmen des Canvas spawnen
    for (let i=0; i < anzKreise;i++){
        let radius = Math.floor(Math.random() * 29 + 1); // [1,10]
        let x = randomIntFromRange(radius*2, canvas.width-radius*2);
        let y = randomIntFromRange(radius*2, canvas.height-radius*2);

        //Maßnahme gegen overlappen beim spawnen der Kreise
        if(i > 0) {
            for(let j=0; j < Kreise.length; j++){
                if(getDistanceCircle(x, y, Kreise[j].x, Kreise[j].y) < radius*2){
                    x = randomIntFromRange(radius*2, canvas.width-radius*2);
                    y = randomIntFromRange(radius*2, canvas.height-radius*2);

                    j = -1; //damit nochmal wirklich gegen alle Kreise gecheckt wird
                }
            }
        }
        Kreise.push(new Kreis(x, y, radius, randomColor(colors) ));
    }    
}

function animate(){
    requestAnimationFrame(animate); //was machst du hier? Wrm nich am Ende?
    //canvas clearen in jedem Frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Mehr Updates pro Frame für stabilere Simulation
    for(i=  0; i < updatesPerFrame; i++ ){
        Kreise.forEach(Kreis => Kreis.update() );
    }

    //kinetische Energie berechnen
    Kreise.forEach(Kreis => {
        if(Kreis.color !== "white") {
            let vektorBetrag = Math.sqrt( Math.pow(Kreis.velocityVector.x, 2) + Math.pow(Kreis.velocityVector.y, 2));
            gesKinetik += vektorBetrag;
        }
    });
    kinetikCounter.innerHTML = "Kinetische Energie: "+gesKinetik.toFixed(2);
    gesKinetik = 0;
}

//#endregion ----- Funktionen --------




//#region -------- EVENTS --------

addEventListener("resize", () => {
    canvas.width = window.innerWidth *0.8; //80% des Screens
    canvas.height = window.innerHeight *0.8; //80% des Screens
    console.log("canvas.width: " + canvas.width);
    console.log("canvas.height: " + canvas.height);
});

//Aktuelle Position der Maus getten
addEventListener("mousemove", e => {
    mouse.x = e.clientX - canvas.getBoundingClientRect().x; //um offset des Canvas zentriert
    mouse.y = e.clientY - canvas.getBoundingClientRect().y;
});

// Draw Distances
drawDistancesCheckBox.onchange = e =>  {
    if(e.target.checked){
        drawDistances = true;
    }
    else{
        drawDistances = false;
    }
};

// Draw Vectors
drawVectorsCheckBox.onchange = e =>  {
    if(e.target.checked){
        drawVectors = true;
    }
    else{
        drawVectors = false;
    }
};

anzParticles.oninput = () => {
    anzParticlesOutput.innerHTML = anzParticles.value;
    anzKreise = anzParticles.value;
    Kreise = [];
    MausKreis.hasGravity = false;
    gravityBTN.style.color = "#804768";
    gravityBTN.style.backgroundColor = "lightblue";
    gravityBTN.style.boxShadow = "2px 2px 10px black";
    init();
}

addEventListener("click", () => {
    //wenn bereits geklickt wurde
    if(MausKreis.hasGravity){
        MausKreis.hasGravity = false;
        MausKreis.color = "white";
        MausKreis.x = mouse.x;
        MausKreis.y = mouse.y;
    }
    //wenn noch nicht geklickt wurde
    //wenn MausKreis im Canvas  UND  !gravity
    else if(MausKreis.inCanvas() && !MausKreis.hasGravity){
        MausKreis.color = randomColor(colors);
        MausKreis.mass = 1 * MausKreis.radius;
        MausKreis.hasGravity = true;
    }
});

gravityBTN.onclick = () => {
    Kreise.forEach(Kreis => {
        if(!(Kreis == MausKreis)) {
            if(Kreis.hasGravity){
                Kreis.hasGravity = false;
                gravityBTN.style.color = "#804768";
                gravityBTN.style.backgroundColor = "lightblue";
                gravityBTN.style.boxShadow = "2px 2px 10px black";
            }else{
                Kreis.hasGravity = true;
                gravityBTN.style.color = "lawngreen";
                gravityBTN.style.backgroundColor = "#804768";
                gravityBTN.style.boxShadow = "2px 2px 20px lawngreen";
                Kreis.velocityVector.x = 0;
                Kreis.velocityVector.y = 0;
            }
        }
    });
};

//#endregion ----- EVENTS --------





//#region -------- MAIN --------

init();
animate();

//#endregion ----- MAIN --------
