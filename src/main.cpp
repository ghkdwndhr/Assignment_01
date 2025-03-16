#include <Arduino.h>
#include <TaskScheduler.h>
#include <PinChangeInterrupt.h>

// 🔹 핀 설정
const int redLedPin = 9;
const int yellowLedPin = 10;
const int blueLedPin = 11;
const int button1Pin = 4;  // 4번 핀에 연결된 1번 버튼
const int button2Pin = 5;  // 5번 핀에 연결된 2번 버튼
const int button3Pin = 6;
const int potPin = A0;

bool redState = false;
bool yellowState = false;
bool blueState = false;

// 🔹 TaskScheduler 객체 생성
Scheduler runner;

// 🔹 Task 함수 선언
void trafficLightTaskCallback();
void blueBlinkTaskCallback();
void blinkTaskCallback();
void adjustBrightnessTaskCallback();
void sendSerialData();  // ✅ p5.js에 데이터 전송

// 🔹 인터럽트 핸들러 함수 선언
void toggleRedOnlyMode();
void toggleBlinkMode();
void toggleAllLedOff();

// 🔹 Task 객체 생성
Task trafficLightTask(500, TASK_FOREVER, &trafficLightTaskCallback, &runner, false);
Task blueBlinkTask(167, 6, &blueBlinkTaskCallback, &runner, false);
Task blinkTask(500, TASK_FOREVER, &blinkTaskCallback, &runner, false);
Task adjustBrightnessTask(10, TASK_FOREVER, &adjustBrightnessTaskCallback, &runner, true);
Task serialTask(100, TASK_FOREVER, &sendSerialData, &runner, true);  // ✅ 시리얼 데이터 전송

// 🔹 상태 변수
volatile bool blinkMode = false;
volatile bool redOnlyMode = false;
volatile bool allLedOff = false;
bool blinkState = true;
bool blueBlinkStarted = false;
int brightness = 255;
String mode = "Normal"; // 신호등 모드

// 🔹 신호등 점등 시간
unsigned long redDuration = 2000;
unsigned long yellowDuration = 500;
unsigned long blueDuration = 3000;
const unsigned long extraYellowDuration = 500;
unsigned long previousMillis = 0;

void setup() {
    Serial.begin(9600);

    pinMode(redLedPin, OUTPUT);
    pinMode(yellowLedPin, OUTPUT);
    pinMode(blueLedPin, OUTPUT);
    pinMode(potPin, INPUT);

    pinMode(button1Pin, INPUT_PULLUP);  // 4번 핀에 버튼1 연결
    pinMode(button2Pin, INPUT_PULLUP);  // 5번 핀에 버튼2 연결
    pinMode(button3Pin, INPUT_PULLUP);

    attachPCINT(digitalPinToPCINT(button1Pin), toggleRedOnlyMode, FALLING);  // 버튼 1: 빨간 LED만 켜기
    attachPCINT(digitalPinToPCINT(button2Pin), toggleBlinkMode, FALLING);  // 버튼 2: LED 3개 깜빡이기
    attachPCINT(digitalPinToPCINT(button3Pin), toggleAllLedOff, FALLING);

    previousMillis = millis();
    trafficLightTask.enable();
    adjustBrightnessTask.enable();
    serialTask.enable();  // ✅ 시리얼 전송 Task 활성화
}

void loop() {
    runner.execute();
}

// ✅ **가변저항 값을 읽어 LED 밝기 조절**
void adjustBrightnessTaskCallback() {
    int potValue = analogRead(potPin);
    brightness = map(potValue, 0, 1023, 5, 255); 
}

void trafficLightTaskCallback() {
    if (blinkMode || redOnlyMode || allLedOff) return;

    unsigned long elapsedTime = millis() - previousMillis;
    bool blueBlinking = false;

    if (elapsedTime < redDuration) {  
        // 🔴 빨간 불 ON
        analogWrite(redLedPin, brightness);
        analogWrite(yellowLedPin, 0);
        analogWrite(blueLedPin, 0);

        redState = true;
        yellowState = false;
        blueState = false;
    } 
    else if (elapsedTime < redDuration + yellowDuration) {  
        // 🟡 노란 불 ON
        analogWrite(redLedPin, 0);
        analogWrite(yellowLedPin, brightness);
        analogWrite(blueLedPin, 0);

        redState = false;
        yellowState = true;
        blueState = false;
    } 
    else if (elapsedTime < redDuration + yellowDuration + blueDuration - 1000) {  
        // 🔵 파란 불 ON
        analogWrite(blueLedPin, brightness);
        analogWrite(redLedPin, 0);
        analogWrite(yellowLedPin, 0);

        redState = false;
        yellowState = false;
        blueState = true;
    }
    else if (elapsedTime < redDuration + yellowDuration + blueDuration) {  
        // 🔵 파란 불 1초 동안 3번 깜빡이기 (167ms 간격)
        blueBlinking = true;
        analogWrite(blueLedPin, (millis() / 167) % 2 ? brightness : 0);
    } 
    else if (elapsedTime < redDuration + yellowDuration + blueDuration + extraYellowDuration) {  
        // 🟡 노란 불 ON
        analogWrite(redLedPin, 0);
        analogWrite(yellowLedPin, brightness);
        analogWrite(blueLedPin, 0);

        redState = false;
        yellowState = true;
        blueState = false;
    } 
    else {
        previousMillis = millis(); // 🔥 사이클 재시작
    }

    // ✅ "Normal" 모드에서도 `BlueBlink` 값을 유지하며 웹에 전송
    Serial.print("{\"Mode\":\"Normal\",");

    Serial.print("\"Red\":");
    Serial.print(redState ? 1 : 0);
    Serial.print(",\"Yellow\":");
    Serial.print(yellowState ? 1 : 0);
    Serial.print(",\"Blue\":");
    Serial.print(blueState ? 1 : 0);
    Serial.print(",\"BlueBlink\":");
    Serial.print(blueBlinking ? 1 : 0);  // 🔹 파란 LED 깜빡임 정보 유지
    Serial.print(",\"Brightness\":");
    Serial.print(brightness);  // ✅ 밝기 값도 웹에서 반영될 수 있도록 전송
    Serial.println("}");
}

// 🔹 **파란불 깜빡이기 Task**
void blueBlinkTaskCallback() {
    blinkState = !blinkState;
    analogWrite(blueLedPin, blinkState ? brightness : 0);
    Serial.println(blinkState ? "Blue LED ON" : "Blue LED OFF");

    if (blueBlinkTask.isLastIteration()) {
        analogWrite(blueLedPin, brightness);
    }
}

void blinkTaskCallback() {
    static bool ledState = false;

    if (blinkMode) {
        ledState = !ledState;

        analogWrite(redLedPin, ledState ? brightness : 0);
        analogWrite(yellowLedPin, ledState ? brightness : 0);
        analogWrite(blueLedPin, ledState ? brightness : 0);

        // 🔹 "All Blink" 상태 JSON 데이터 전송 (웹에서 동기화할 수 있도록)
        Serial.print("{\"Mode\":\"All Blink\",");

        Serial.print("\"RedBlink\":");
        Serial.print(ledState ? 1 : 0);
        Serial.print(",\"YellowBlink\":");
        Serial.print(ledState ? 1 : 0);
        Serial.print(",\"BlueBlink\":");
        Serial.print(ledState ? 1 : 0);
        Serial.println("}");
    }
}

void sendSerialData() {
    String currentLight = "Off";

    int redValue = redState ? 1 : 0;
    int yellowValue = yellowState ? 1 : 0;
    int blueValue = blueState ? 1 : 0;

    if (mode == "All Blink") {
        currentLight = "All Blinking";
    } else if (mode == "All Off") {
        currentLight = "Off";
    } else if (mode == "Red Only") {
        currentLight = "Red";
    } else if (redState) {
        currentLight = "Red";
    } else if (yellowState) {
        currentLight = "Yellow";
    } else if (blueBlinkStarted) {
        currentLight = "Blinking";
    } else if (blueState) {
        currentLight = "Blue";
    }

    // 🔹 JSON 형식으로 데이터 전송 (밝기 포함)
    Serial.print("{\"Light\":\"");
    Serial.print(currentLight);
    Serial.print("\",\"Red\":");
    Serial.print(redValue);
    Serial.print(",\"Yellow\":");
    Serial.print(yellowValue);
    Serial.print(",\"Blue\":");
    Serial.print(blueValue);
    Serial.print(",\"Mode\":\"");
    Serial.print(mode);
    Serial.print("\",\"Brightness\":");
    Serial.print(brightness);
    Serial.println("}");

    delay(20);  // ✅ 빠른 업데이트를 위해 딜레이 20ms
}

// 🔹 버튼 인터럽트 핸들러에서 데이터 전송 추가
void toggleRedOnlyMode() {
    redOnlyMode = !redOnlyMode;
    mode = redOnlyMode ? "Red Only" : "Normal";
    Serial.println(redOnlyMode ? "Red Only Mode ON" : "Red Only Mode OFF");
    sendSerialData();  // ✅ 데이터 즉시 전송
    if (redOnlyMode) {
        trafficLightTask.disable();
        blinkTask.disable();
        analogWrite(redLedPin, brightness);
        analogWrite(yellowLedPin, 0);
        analogWrite(blueLedPin, 0);
    } else {
        previousMillis = millis();
        trafficLightTask.enable();
    }
}

void toggleBlinkMode() {
    blinkMode = !blinkMode;
    mode = blinkMode ? "All Blink" : "Normal";
    Serial.println(blinkMode ? "All Blink Mode ON" : "Normal Mode ON");
    sendSerialData();  // ✅ 데이터 즉시 전송
    if (blinkMode) {
        trafficLightTask.disable();
        blinkTask.enable();
    } else {
        trafficLightTask.enable();
        blinkTask.disable();
    }
}

void toggleAllLedOff() {
    allLedOff = !allLedOff;
    mode = allLedOff ? "All Off" : "Normal";
    Serial.println(allLedOff ? "All LEDs Off" : "Traffic Light Mode ON");
    sendSerialData();  // ✅ 데이터 즉시 전송
    if (allLedOff) {
        trafficLightTask.disable();
        blinkTask.disable();
        analogWrite(redLedPin, 0);
        analogWrite(yellowLedPin, 0);
        analogWrite(blueLedPin, 0);
    } else {
        analogWrite(redLedPin, brightness);
        analogWrite(yellowLedPin, 0);
        analogWrite(blueLedPin, 0);
        previousMillis = millis();
        trafficLightTask.enable();
    }
}
