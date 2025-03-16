// 시리얼 포트 및 관련 변수 초기화
let port, reader, inputDone, outputDone, inputStream, outputStream, writer;
let potBrightness = 0;  // 가변저항 값 (LED 밝기 조절)
let mode = "Normal", currentLight = "Off", isConnected = false;  // 모드, 현재 불빛 상태, 연결 상태
let greenBlinkState = false;  // 초록 LED 깜빡임 상태
let redPotSlider, yellowPotSlider, greenPotSlider;  // 각 LED의 밝기를 조절하는 슬라이더
let blinkInterval = 100, blinkDuration = 50;  // 깜빡이는 간격 설정
let blinkCount = 0, maxBlinkCount = 3;  // 초록색 깜빡임 횟수 및 최대 깜빡임 횟수 설정

// 시리얼 연결 함수
async function connectToArduino() {
    try {
        port = await navigator.serial.requestPort();  // 시리얼 포트 선택
        await port.open({ baudRate: 9600 });  // 시리얼 포트 열기

        // 데이터 스트림 처리: 입력 스트림과 출력 스트림을 설정
        const textDecoder = new TextDecoderStream();
        inputDone = port.readable.pipeTo(textDecoder.writable);
        inputStream = textDecoder.readable.pipeThrough(new TransformStream(new LineBreakTransformer()));
        reader = inputStream.getReader();

        const textEncoder = new TextEncoderStream();
        outputDone = textEncoder.readable.pipeTo(port.writable);
        outputStream = textEncoder.writable;
        writer = outputStream.getWriter();

        isConnected = true;  // 연결 상태 업데이트
        document.getElementById("status").innerText = "Status: Connected";  // HTML에 연결 상태 표시

        readLoop();  // 시리얼 데이터 읽기 시작
    } catch (error) {
        console.error('Error opening the serial port:', error);  // 에러 처리
    }
}

// 시리얼 데이터 읽기 함수 (비동기적으로 데이터 읽기)
async function readLoop() {
    while (true) {
        try {
            const { value, done } = await reader.read();  // 데이터 읽기
            if (done) {
                reader.releaseLock();  // 스트림 잠금 해제
                break;  // 종료 조건
            }
            serialEvent(value);  // 데이터 처리
        } catch (error) {
            console.error('Error reading from the serial port:', error);  // 에러 처리
            break;
        }
    }
}

// p5.js UI 생성: 슬라이더 및 텍스트 설정
function setup() {
    createCanvas(600, 500);  // 캔버스 크기 설정

    // 빨간색, 노란색, 초록색 LED 밝기 조절 슬라이더 생성
    createP("🔴 Red LED Light ").position(20, 270);
    redPotSlider = createSlider(0, 255, 0).position(20, 310).attribute('disabled', '');

    createP("🟡 Yellow LED Light ").position(20, 340);
    yellowPotSlider = createSlider(0, 255, 0).position(20, 380).attribute('disabled', '');

    createP("🟢 Green LED Light ").position(20, 410);
    greenPotSlider = createSlider(0, 255, 0).position(20, 450).attribute('disabled', '');
}

// 시리얼 데이터를 처리하는 함수
function serialEvent(data) {
    let trimmedData = data.trim();  // 공백 제거
    if (trimmedData.length > 0) {
        try {
            let json = JSON.parse(trimmedData);  // JSON으로 변환

            // 각 데이터 값을 변수에 저장
            potBrightness = json.Brightness;
            mode = json.Mode;
            currentLight = json.Light;

            // 초록색 깜빡임 상태 업데이트
            if (mode === "Normal" && json.hasOwnProperty("GreenBlink")) {
                greenBlinkState = json.GreenBlink;
            }

            // 가변저항 슬라이더 값 업데이트
            if (json.hasOwnProperty("Brightness")) {
                redPotSlider.value(potBrightness);
                yellowPotSlider.value(potBrightness);
                greenPotSlider.value(potBrightness);
            }

            redraw();  // 화면 갱신
        } catch (e) {
            console.error("🚨 JSON Parsing Error:", e, "Received Data:", data);  // JSON 파싱 에러 처리
        }
    }
}

// 화면을 그리는 함수
function draw() {
    background(220);  // 배경색 설정
    fill(0);
    textSize(20);
    text("Mode: " + mode, 20, 40);  // 현재 모드 표시

    // LED 색상 설정 (기본적으로 회색)
    let redCircleColor = color(100);
    let yellowCircleColor = color(100);
    let greenCircleColor = color(100);

    // 모드에 따라 LED 색상 설정
    if (mode === "All Off") {
        redCircleColor = yellowCircleColor = greenCircleColor = color(100);  // 모두 꺼짐
    } else if (mode === "Red Only") {
        redCircleColor = color(255, 0, 0, potBrightness);  // 빨간색만 켬
    } else if (mode === "Normal") {
        if (currentLight === "Red") {
            redCircleColor = color(255, 0, 0, potBrightness);  // 빨간색 켬
        } else if (currentLight === "Yellow") {
            yellowCircleColor = color(255, 255, 0, potBrightness);  // 노란색 켬
        } else if (greenBlinkState && blinkCount < maxBlinkCount) {
            greenCircleColor = frameCount % blinkInterval < blinkDuration ? color(0, 255, 0, potBrightness) : color(100);  // 초록색 깜빡임
            if (frameCount % blinkInterval < blinkDuration) {
                blinkCount++;  // 깜빡임 횟수 증가
            }
        } else if (currentLight === "Green") {
            greenCircleColor = color(0, 255, 0, potBrightness);  // 초록색 켬
        }
    } else if (mode === "All Blink") {
        // 모든 색상 깜빡임
        if (frameCount % blinkInterval < blinkDuration) {
            redCircleColor = color(255, 0, 0, potBrightness);
            yellowCircleColor = color(255, 255, 0, potBrightness);
            greenCircleColor = color(0, 255, 0, potBrightness);
        } else {
            redCircleColor = yellowCircleColor = greenCircleColor = color(100);  // 깜빡일 때가 아니면 어두운 색
        }
    }

    // 원형을 제일 밑으로 내리고 색상을 설정
    fill(redCircleColor);
    ellipse(width / 4, height - 50, 80, 80);  // 빨간 원
    fill(yellowCircleColor);
    ellipse(width / 2, height - 50, 80, 80);  // 노란 원
    fill(greenCircleColor);
    ellipse((width / 4) * 3, height - 50, 80, 80);  // 초록 원
}

// 시리얼 데이터에서 줄바꿈 변환
class LineBreakTransformer {
    constructor() {
        this.container = '';
    }

    transform(chunk, controller) {
        this.container += chunk;
        const lines = this.container.split('\n');  // 줄바꿈 기준으로 데이터 분리
        this.container = lines.pop();  // 마지막 남은 부분은 container에 저장
        lines.forEach(line => controller.enqueue(line));  // 각각의 줄을 컨트롤러로 전달
    }

    flush(controller) {
        controller.enqueue(this.container);  // 마지막 남은 데이터 전달
    }
}

// HTML 버튼에 이벤트 추가 (버튼 클릭 시 connectToArduino 함수 호출)
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("connectButton").addEventListener("click", () => {
        connectToArduino();
    });
});
