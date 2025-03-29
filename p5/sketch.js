let handpose; // ml5.js에서 제공하는 손 제스처 모델
let video; // 웹캠 캡처용 비디오 객체
let predictions = []; // 현재 프레임에서 감지된 손 landmark 정보를 저장
let port, reader, inputStream; 
let mode = "Normal", currentLight = "Off", greenBlinkState = 0, potBrightness = 0;
let redSlider, yellowSlider, greenSlider;
let redOnlyBtn, blinkBtn, toggleBtn;
let lastModeSent = "";
let selectedLight = null; // 현재 선택된 조정 대상 LED ("Red", "Yellow", "Green")
let writerLock = false; // 아두이노로 데이터 중복 전송 방지용 락 변수
let lastGestureTime = 0; // 마지막 제스처 인식 시간 (모드 전환용)
let adjustHoldStart = 0; // 슬라이더 조정 시, 제스처 입력 딜레이 타이머
let inDurationMode = false; // 슬라이더 조절 모드 진입 여부 플래그
let durationModeStart = 0; // 조절 모드가 시작된 시간

// 👇 [변경] 슬라이더 조절 모드 종료 조건을 위한 변수 추가
let lastPredictionTime = 0; // 마지막으로 손 제스처가 감지된 시간 저장
let hadGestureDuringMode = false; // 슬라이더 조정 모드 동안 제스처가 있었는지 여부
let lastGestureDetectedTime = 0; // 마지막 제스처가 감지된 시간

function setup() {
  createCanvas(640, 700);

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  handpose = ml5.handpose(video, () => {
    console.log("🤖 Handpose model ready");
  });
  handpose.on("predict", (results) => {
    predictions = results;  // 예측된 손 데이터를 저장
    lastPredictionTime = millis(); // 손 인식이 발생한 시간을 저장

    // 👇 [변경] 슬라이더 조절 중 손이 인식되면 타이머 초기화
    if (inDurationMode && results.length > 0) {
      hadGestureDuringMode = true; // 슬라이더 조정 중 제스처가 있었다고 표시
      lastGestureDetectedTime = millis(); // 마지막 제스처 감지 시간 갱신
    }
  });

  redSlider = createSlider(0, 5000, 2000).position(610, 730);
  yellowSlider = createSlider(0, 5000, 500).position(790, 730);
  greenSlider = createSlider(0, 5000, 2000).position(950, 730);

  redOnlyBtn = createButton("🔴 Red Only").position(610, 800).mousePressed(() => {
    // 현재 모드가 Red Only면 Normal로 되돌리기
    if (mode === "Red Only") sendMode("Normal");
    else sendMode("Red Only");
  });

  blinkBtn = createButton("✨ Blink").position(800, 800).mousePressed(() => {
    if (mode === "All Blink") sendMode("Normal");
    else sendMode("All Blink");
  });

  toggleBtn = createButton("⛔ Off/On").position(960, 800).mousePressed(() => {
    if (mode === "All Off") sendMode("Normal");
    else sendMode("All Off");
  });


  document.getElementById("connectButton")?.addEventListener("click", () => connectToArduino());
}

function draw() {
  background(240);

  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, 480);
  pop();

  detectGestures();
  detectLightSelection();
  if (inDurationMode) detectIndexDirection();

  // 👇 [변경] 슬라이더 조절 모드가 시작된 뒤 제스처 없거나 손이 사라지면 자동 종료
  if (inDurationMode) {
    const now = millis();
    const elapsed = now - durationModeStart;
    const gestureGone = now - lastGestureDetectedTime > 1500; // 최근 제스처 이후 일정 시간 지나면 종료 조건 성립
    const handGone = predictions.length === 0;  // 손이 감지되지 않는 경우도 포함

    if (elapsed > 2000 && (gestureGone || handGone)) {
      inDurationMode = false;
      selectedLight = null;
      sendMode("Normal"); // 모드를 다시 Normal로 전환
    }
  }

  if (predictions.length > 0) { // 손이 인식된 경우우
    let lm = predictions[0].landmarks;
    for (let i = 0; i < lm.length; i++) {
      let x = width - lm[i][0]; // 좌우 반전
      let y = lm[i][1];
      fill(255, 0, 0); // 각 손 관절에 빨간색 점점
      noStroke();
      circle(x, y, 10);
    }
  }

  drawTrafficLights();
  drawStatusText();
  sendDurations();
}

function drawTrafficLights() {
  let r = color(100), y = color(100), g = color(100);
  let b = potBrightness || 150;

  if (!inDurationMode) { 
    if (mode === "All Blink" && millis() % 1000 < 500) {
      r = color(255, 0, 0, b); y = color(255, 255, 0, b); g = color(0, 255, 0, b);
    } else if (mode === "Red Only") {
      r = color(255, 0, 0, b);
    } else if (mode === "All Off") {
    } else if (greenBlinkState === 1) {
      g = millis() % 167 < 83 ? color(0, 255, 0, b) : color(100);
    } else {
      if (currentLight === "Red") r = color(255, 0, 0, b);
      else if (currentLight === "Yellow") y = color(255, 255, 0, b);
      else if (currentLight === "Green") g = color(0, 255, 0, b);
    }
  }

  if (inDurationMode && selectedLight === "Red") r = color(255, 165, 0);
  if (inDurationMode && selectedLight === "Yellow") y = color(255, 165, 0);
  if (inDurationMode && selectedLight === "Green") g = color(255, 165, 0);

  fill(r); ellipse(150, 480, 100);
  fill(y); ellipse(320, 480, 100);
  fill(g); ellipse(490, 480, 100);
}

function drawStatusText() {
  fill(0);
  textSize(16);
  textAlign(LEFT);
  text(`📘 Mode: ${mode}`, 20, 30);
  text(`💡 Current Light: ${currentLight}`, 220, 30);
  text(`🌞 Brightness: ${potBrightness}`, 450, 30);
  if (inDurationMode && selectedLight) { 
    text("⏱️ Duration adjustment mode...", 20, 55); // 슬라이더 조절 모드 진입 시 상태 표시
  }
}

function detectGestures() {
  if (predictions.length === 0) return;
  let lm = predictions[0].landmarks;
  const now = millis();
  if (now - lastGestureTime < 1000) return;

  const tip = [4, 8, 12, 16, 20]; // 손가락 끝 지점 (엄지~새끼)
  const pip = [3, 6, 10, 14, 18]; // 각 손가락의 아래 마디 지점

  // 👇 [변경] 손가락이 접혀 있는지 펴져 있는지 판별
  const fingerFolded = tip.map((t, i) => lm[t][1] > lm[pip[i]][1] + 10); // 접힘: 끝이 마디보다 아래에 있음
  const fingerExtended = tip.map((t, i) => lm[t][1] < lm[pip[i]][1] - 10);  // 펼침: 끝이 마디보다 위에 있음 

  let isFist = fingerFolded.slice(1).every(v => v); // 주먹: 엄지를 제외한 네 손가락이 다 접힘
  let isHandOpen = fingerExtended.every(v => v); // 손 펼침: 모든 손가락이 펴짐
  let isThreeFingers = fingerExtended[1] && fingerExtended[2] && fingerExtended[3] && !fingerExtended[0] && !fingerExtended[4];
  let isVSign = fingerExtended[1] && fingerExtended[2] && !fingerExtended[3] && !fingerExtended[4] && !fingerExtended[0];

  if (!inDurationMode) { // 슬라이더 조절 모드가 아닐 때만 제스처 인식
    if (isFist) { sendMode("Normal"); lastGestureTime = now; } // 주먹을 쥐면 Normal 모드로 전환
    else if (isHandOpen) { sendMode("All Off"); lastGestureTime = now; } // 손을 펴면 All Off 모드로 전환
    else if (isThreeFingers) { sendMode("All Blink"); lastGestureTime = now; } // 세 손가락을 펼치면 All Blink 모드로 전환
    else if (isVSign) { sendMode("Red Only"); lastGestureTime = now; } // V자 손가락을 하면 Red Only 모드로 전환
  }
}

function detectLightSelection() {
  if (predictions.length === 0) return; // 손이 익식되지 않으면 종료
  let [x, y] = predictions[0].landmarks[8]; // 검지 손가락 끝 좌표 추출 (index finger tip)
  x = width - x; // 좌우 반전 (캔버스가 미러링된 상태이므로 보정 필요)
  
  let target = null;
   // 👇 손가락이 특정 원형 버튼에 가까우면 해당 색상 선택
  if (dist(x, y, 150, 480) < 50) target = "Red";
  else if (dist(x, y, 320, 480) < 50) target = "Yellow";
  else if (dist(x, y, 490, 480) < 50) target = "Green";

  if (target !== null) {
    // 👇 [변경] 슬라이더 조절 모드 진입 시 타이머와 상태 변수 초기화
    if (!inDurationMode) {
      inDurationMode = true;  // 슬라이더 조절 모드 시작
      durationModeStart = millis(); // 모드 시작 시각 저장
      hadGestureDuringMode = false; // 이 모드 동안 제스처 인식 여부 false로 초기화
      lastGestureDetectedTime = millis(); // 마지막 제스처 시각을 현재로 초기화
    }
    selectedLight = target; // 선택한 조명 색상 업데이트
  }
}

function detectIndexDirection() {
  if (predictions.length === 0 || !selectedLight) return; // 손이 없거나 선택된 불이 없으면 종료
  let lm = predictions[0].landmarks;

  const indexY = lm[8][1]; // 검지 끝의 y좌표
  const baseY = lm[5][1]; // 손바닥 기준 y좌표 (엄지 아래 마디)
  const now = millis();

  // 👇 [변경] 위로 손가락 올리면 슬라이더 증가, 아래로 내리면 감소 + 제스처 감지 시각 갱신
  if (indexY < baseY - 30 && now - adjustHoldStart > 150) {
    changeSlider(1); // 위로 올림 → 슬라이더 값 증가
    adjustHoldStart = now; // 다음 입력까지 딜레이 시간 초기화
    lastGestureDetectedTime = now;  // 마지막 제스처 감지 시각 업데이트
  } else if (indexY > baseY + 30 && now - adjustHoldStart > 150) {
    changeSlider(-1); // 아래로 내림 → 슬라이더 값 감소
    adjustHoldStart = now;
    lastGestureDetectedTime = now;
  }
}

function changeSlider(delta) { // 선택된 불에 따라 슬라이더 값을 증가 또는 감소시킴
  // delta : 1이면 증가, -1이면 감소  
  if (selectedLight === "Red") redSlider.value(redSlider.value() + delta * 100); // 선택된 불이 red인 경우, red 슬라이더 값 조정
  if (selectedLight === "Yellow") yellowSlider.value(yellowSlider.value() + delta * 100); // 선택된 불이 yellow인 경우, yellow 슬라이더 값 조정
  if (selectedLight === "Green") greenSlider.value(greenSlider.value() + delta * 100); // 선택된 불이 green인 경우, green 슬라이더 값 조정
}

async function sendMode(newMode) {
  if (!port?.writable || writerLock) return;
  if (newMode === lastModeSent) return;

  lastModeSent = newMode;
  writerLock = true;

  try {
    const writer = port.writable.getWriter();
    const encoded = new TextEncoder().encode(`M:${newMode}\n`);
    await writer.write(encoded);
    writer.releaseLock();
  } catch (err) {
    console.error("⚠️ Failed to send mode:", err);
  } finally {
    writerLock = false;
  }
}

let lastDurationSent = 0;

async function sendDurations() {
  const now = millis();
  if (now - lastDurationSent < 300 || !port?.writable || writerLock) return;

  lastDurationSent = now;
  writerLock = true;

  const msg = `D:${redSlider.value()},${yellowSlider.value()},${greenSlider.value()}\n`;
  try {
    const writer = port.writable.getWriter();
    await writer.write(new TextEncoder().encode(msg));
    writer.releaseLock();
  } catch (err) {
    console.error("⚠️ Failed to send durations:", err);
  } finally {
    writerLock = false;
  }
}

async function connectToArduino() {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    const decoder = new TextDecoderStream();
    inputStream = decoder.readable.pipeThrough(new TransformStream(new LineBreakTransformer()));
    port.readable.pipeTo(decoder.writable);
    reader = inputStream.getReader();

    const statusDiv = document.getElementById("status");
    if (statusDiv) {
      statusDiv.textContent = "✅ Status: Connected";
      statusDiv.style.color = "green";
    }

    readLoop();
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
