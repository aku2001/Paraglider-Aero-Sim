    /* ===============================
       CONSTANTS
    ================================ */
    const GLIDER_MASS = 5.0; // kg
    const GRAVITY = 9.81;
    const R_GAS = 287.058;

    // Aerodynamic constants
    const WING_PROFILE_DRAG = 0.025;
    const LINE_DRAG = 0.015;
    const PILOT_CD_COEFF = 1.0;

    const CL_SLOPE = 0.10;     // per degree
    const CL_OFFSET = 0.1;
    const CL_MAX = 1.3;        // soft stall cap

    /* ===============================
       DOM SETUP & EVENT LISTENERS
    ================================ */
    const inputs = [
      'span','chord','taper','aoa','brake',
      'alt','temp','mass','pilotArea'
    ];

    const elements = {};

    inputs.forEach(id => {
        elements[id] = document.getElementById(id);           // The range slider
        elements[`${id}Num`] = document.getElementById(`${id}-num`); // The number input
        
        // When slider moves, update number input
        elements[id].addEventListener('input', (e) => {
            elements[`${id}Num`].value = e.target.value;
            updateSimulation();
        });

        // When number is typed, update slider
        elements[`${id}Num`].addEventListener('input', (e) => {
            // Prevent empty or completely invalid strings from breaking the slider
            if(e.target.value !== "") {
                elements[id].value = e.target.value;
                updateSimulation();
            }
        });
    });

    /* ===============================
       MAIN SIMULATION
    ================================ */
    function updateSimulation() {

        /* ---- 1. GET CURRENT VALUES ---- */
        // Fallback to 0 if the user clears the number input entirely
        const span = parseFloat(elements.spanNum.value) || 0;
        const rootChord = parseFloat(elements.chordNum.value) || 0;
        const taperRatio = parseFloat(elements.taperNum.value) || 0;
        const userAoA = parseFloat(elements.aoa.value) || 0; // Read from slider state for base AoA
        const brake = parseFloat(elements.brakeNum.value) || 0;
        const alt = parseFloat(elements.altNum.value) || 0;
        const tempC = parseFloat(elements.tempNum.value) || 0;
        const pilotMass = parseFloat(elements.massNum.value) || 0;
        const pilotFrontalArea = parseFloat(elements.pilotAreaNum.value) || 0;

        /* ---- 2. AoA / BRAKE LOGIC ---- */
        let effectiveAoA;

        if (brake > 0) {
            // Disable AoA inputs and show auto indicator
            elements.aoa.disabled = true;
            elements.aoaNum.disabled = true;
            document.getElementById('aoa-label').classList.add('disabled-text');
            document.getElementById('aoa-auto').style.display = 'inline';
            
            // Brakes pull down the trailing edge, increasing AoA
            effectiveAoA = 6 + (brake/100)*8;
            
            // Overwrite the number input to show the auto-calculated value
            elements.aoaNum.value = effectiveAoA.toFixed(1);
        } else {
            // Enable AoA inputs
            elements.aoa.disabled = false;
            elements.aoaNum.disabled = false;
            document.getElementById('aoa-label').classList.remove('disabled-text');
            document.getElementById('aoa-auto').style.display = 'none';
            
            effectiveAoA = userAoA;
            
            // Sync the number input back to the slider's user value
            if(document.activeElement !== elements.aoaNum) {
                elements.aoaNum.value = effectiveAoA;
            }
        }

        /* ---- 3. GEOMETRY (WITH TAPER) ---- */
        const meanChord = rootChord * ((1 + taperRatio) / 2);
        const area = span * meanChord;
        
        // Prevent divide by zero if user types 0
        const aspect_ratio = area > 0 ? (span * span) / area : 0;

        /* ---- 4. ATMOSPHERE ---- */
        const tempK = tempC + 273.15;
        const pressure = 101325 * Math.pow(1 - 0.0000225577 * alt, 5.25588);
        const rho = pressure / (R_GAS * tempK);

        /* ---- 5. AERODYNAMICS ---- */
        let CL = CL_OFFSET + CL_SLOPE * effectiveAoA;
        CL = Math.max(0.05, Math.min(CL, CL_MAX));

        const e = 0.85; 
        const CD_induced = aspect_ratio > 0 ? (CL * CL) / (Math.PI * e * aspect_ratio) : 0;
        const CD_brakes = Math.pow(brake / 100, 1.5) * 0.12;
        const CD_wing = WING_PROFILE_DRAG + LINE_DRAG + CD_induced + CD_brakes;

        /* ---- 6. FLIGHT MECHANICS ---- */
        const totalWeight = (pilotMass + GLIDER_MASS) * GRAVITY;

        // Prevent math errors if area or CL are zero
        let velocity_ms = 0;
        let CD_total = 0;
        let totalDrag = 0;

        if (area > 0 && CL > 0) {
            velocity_ms = Math.sqrt((2 * totalWeight) / (rho * area * CL));
            const V2 = velocity_ms * velocity_ms;

            const drag_wing = 0.5 * rho * V2 * area * CD_wing;
            const drag_pilot = 0.5 * rho * V2 * pilotFrontalArea * PILOT_CD_COEFF;
            totalDrag = drag_wing + drag_pilot;

            CD_total = totalDrag / (0.5 * rho * V2 * area);
        }

        /* ---- PERFORMANCE COMPUTATION ---- */
        const glide_ratio = CD_total > 0 ? CL / CD_total : 0;
        const glide_angle = CL > 0 ? Math.atan(CD_total / CL) : 0;
        const sink_rate = velocity_ms * Math.sin(glide_angle);
        const velocity_kmh = velocity_ms * 3.6;

        /* ---- 7. STALL WARNINGS ---- */
        const stallWarning = document.getElementById('stall-warning');

        if(effectiveAoA > 12 || brake > 80){
            stallWarning.innerText = "⚠️ WARNING: Critical AoA — stall likely.";
        }
        else if(effectiveAoA < -1){
            stallWarning.innerText = "⚠️ WARNING: Frontal collapse risk.";
        }
        else{
            stallWarning.innerText = "";
        }

        /* ---- 8. DOM OUTPUT ---- */
        document.getElementById('out-area').innerText = area.toFixed(1);
        document.getElementById('out-ar').innerText = aspect_ratio.toFixed(2);
        document.getElementById('out-rho').innerText = rho.toFixed(3);
        document.getElementById('out-eff-aoa').innerText = effectiveAoA.toFixed(1);
        document.getElementById('out-speed').innerText = velocity_kmh.toFixed(1);
        document.getElementById('out-gr').innerText = glide_ratio.toFixed(1);
        document.getElementById('out-sink').innerText = sink_rate.toFixed(2);
    }

    /* INIT */
    updateSimulation();