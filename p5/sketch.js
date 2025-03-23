let port, reader, inputStream;
let mode = "Normal", currentLight = "Off", greenBlinkState = 0, potBrightness = 0;
let redSlider, yellowSlider, greenSlider;
let redOnlyBtn, blinkBtn, toggleBtn;

function setup() {
  createCanvas(600, 500);
  textFont("Arial");

  createP("🔴 Red Duration").position(210, 350);
  redSlider = createSlider(500, 5000, 2000).position(210, 400);

  createP("🟡 Yellow Duration").position(390, 350);
  yellowSlider = createSlider(200, 3000, 500).position(390, 400);

  createP("🟢 Green Duration").position(570, 350);
  greenSlider = createSlider(1000, 5000, 2000).position(570, 400);

  redOnlyBtn = createButton("🔴 Red Only").position(180, 250).style("font-size", "20px").mousePressed(() => sendMode("Red Only"));
  blinkBtn = createButton("✨ Blink").position(380, 250).style("font-size", "20px").mousePressed(() => sendMode("All Blink"));
  toggleBtn = createButton("⛔ Off/On").position(550, 250).style("font-size", "20px").mousePressed(() => sendMode("All Off"));
}

function draw() {
  background(240);
  fill(0); textSize(18);
  text("Mode: " + mode, 20, 40);

  let r = color(100), y = color(100), g = color(100);
  let b = potBrightness || 150;

  if (mode === "All Blink" && millis() % 1000 < 500) {
    r = color(255, 0, 0, b); y = color(255, 255, 0, b); g = color(0, 255, 0, b);
  } else if (mode === "Red Only") {
    r = color(255, 0, 0, b);
  } else if (mode === "All Off") {
    // all off
  } else if (greenBlinkState === 1) {
    g = millis() % 167 < 83 ? color(0, 255, 0, b) : color(100);
  } else {
    if (currentLight === "Red") r = color(255, 0, 0, b);
    else if (currentLight === "Yellow") y = color(255, 255, 0, b);
    else if (currentLight === "Green") g = color(0, 255, 0, b);
  }

  fill(r); ellipse(150, 350, 80, 80);
  fill(y); ellipse(330, 350, 80, 80);
  fill(g); ellipse(510, 350, 80, 80);

  sendDurations();
}

function sendDurations() {
  if (port?.writable) {
    let msg = `D:${redSlider.value()},${yellowSlider.value()},${greenSlider.value()}`;

    const writer = port.writable.getWriter();
    writer.write(new TextEncoder().encode(msg + "\n"));
    writer.releaseLock();
  }
}

let lastModeSent = "";  // 마지막으로 보낸 모드 저장

async function sendMode(newMode) {
  if (!port?.writable) return;

  // 같은 모드를 다시 누르면 Normal 모드로
  if (newMode === lastModeSent) {
    newMode = "Normal";
    lastModeSent = "";  // 초기화
  } else {
    lastModeSent = newMode;
  }

  const writer = port.writable.getWriter();
  const msg = `M:${newMode}\n`;
  const encoded = new TextEncoder().encode(msg);

  for (let i = 0; i < 3; i++) {
    await writer.write(encoded);
  }
  writer.releaseLock();
}



async function connectToArduino() {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    const decoder = new TextDecoderStream();
    inputStream = decoder.readable.pipeThrough(new TransformStream(new LineBreakTransformer()));
    port.readable.pipeTo(decoder.writable);
    reader = inputStream.getReader();

    // ✅ 연결 상태 텍스트를 명확하게 변경
    const statusDiv = document.getElementById("status");
    if (statusDiv) {
      statusDiv.textContent = "✅ Status: Connected";
      statusDiv.style.color = "green";
    }

    readLoop(); // 시작
  } catch (err) {
    console.error("Connection failed:", err);
    const statusDiv = document.getElementById("status");
    if (statusDiv) {
      statusDiv.textContent = "❌ Status: Connection Failed";
      statusDiv.style.color = "red";
    }
  }
}

async function readLoop() {
  while (true) {
    try {
      const { value, done } = await reader.read();
      if (done) break;
      serialEvent(value);
    } catch (e) {
      break;
    }
  }
}

function serialEvent(data) {
  let lines = data.trim().split('\n');
  lines.forEach(line => {
    try {
      if (line.startsWith('{') && line.endsWith('}')) {
        let json = JSON.parse(line);
        mode = json.Mode;
        currentLight = json.Light;
        greenBlinkState = json.GreenBlink;
        potBrightness = json.Brightness;
        redraw();
      }
    } catch (e) {
      console.warn("⚠️ JSON Parse Error:", line);
    }
  });
}

class LineBreakTransformer {
  constructor() { this.container = ""; }
  transform(chunk, controller) {
    this.container += chunk;
    const lines = this.container.split('\n');
    this.container = lines.pop();
    lines.forEach(line => controller.enqueue(line));
  }
  flush(controller) { controller.enqueue(this.container); }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("connectButton")?.addEventListener("click", () => {
    connectToArduino();
  });
});