# Assignment_01
## 시연동영상입니다
https://youtu.be/HrNqMD0W_Vk?si=k8uvx_Hc8bIbQg1s



## 아두이노 관련 코드입니다


#include <Arduino.h>
#include <TaskScheduler.h>
#include <PinChangeInterrupt.h>

// 🔹 핀 설정
const int redLedPin = 9;       // 빨간 LED 핀
const int yellowLedPin = 10;   // 노란 LED 핀
const int blueLedPin = 11;     // 파란 LED 핀
const int button1Pin = 4;      // 4번 핀에 연결된 1번 버튼
const int button2Pin = 5;      // 5번 핀에 연결된 2번 버튼
const int button3Pin = 6;      // 6번 핀에 연결된 3번 버튼
const int potPin = A0;         // 아날로그 입력을 위한 가변 저항 핀

bool redState = false;         // 빨간 불 상태 변수
bool yellowState = false;      // 노란 불 상태 변수
bool blueState = false;        // 파란 불 상태 변수

// 🔹 TaskScheduler 객체 생성 (여러 작업을 동시에 실행하기 위한 스케줄러)
Scheduler runner;

// 🔹 Task 함수 선언 (주기적으로 실행될 작업을 처리하는 함수들)
void trafficLightTaskCallback();
void blueBlinkTaskCallback();
void blinkTaskCallback();
void adjustBrightnessTaskCallback();
void sendSerialData();  // ✅ p5.js에 데이터 전송

// 🔹 인터럽트 핸들러 함수 선언 (버튼을 눌렀을 때의 동작 정의)
void toggleRedOnlyMode();
void toggleBlinkMode();
void toggleAllLedOff();

// 🔹 Task 객체 생성 (각 작업을 스케줄러에 등록)
Task trafficLightTask(500, TASK_FOREVER, &trafficLightTaskCallback, &runner, false);  // 신호등 작업
Task blueBlinkTask(167, 6, &blueBlinkTaskCallback, &runner, false);                     // 파란불 깜빡이기 작업
Task blinkTask(500, TASK_FOREVER, &blinkTaskCallback, &runner, false);                 // LED 깜빡이기 작업
Task adjustBrightnessTask(10, TASK_FOREVER, &adjustBrightnessTaskCallback, &runner, true);  // 밝기 조정 작업
Task serialTask(100, TASK_FOREVER, &sendSerialData, &runner, true);  // ✅ 시리얼 데이터 전송 작업

// 🔹 상태 변수
volatile bool blinkMode = false;          // 모든 LED가 깜빡이는 모드
volatile bool redOnlyMode = false;        // 빨간불만 켜는 모드
volatile bool allLedOff = false;          // 모든 LED를 끄는 모드
bool blinkState = true;                   // LED 깜빡임 상태
bool blueBlinkStarted = false;            // 파란불 깜빡임 상태
int brightness = 255;                     // LED 밝기 (최대 255)
String mode = "Normal";                   // 현재 모드 (기본은 "Normal")

// 🔹 신호등 점등 시간 설정
unsigned long redDuration = 2000;         // 빨간불 지속 시간 (2초)
unsigned long yellowDuration = 500;       // 노란불 지속 시간 (0.5초)
unsigned long blueDuration = 3000;        // 파란불 지속 시간 (3초)
const unsigned long extraYellowDuration = 500;  // 파란불 후 추가 노란불 시간 (0.5초)
unsigned long previousMillis = 0;         // 시간 추적용 변수

void setup() {
    Serial.begin(9600);  // 시리얼 통신 시작

    pinMode(redLedPin, OUTPUT);       // 빨간 LED 핀을 출력으로 설정
    pinMode(yellowLedPin, OUTPUT);    // 노란 LED 핀을 출력으로 설정
    pinMode(blueLedPin, OUTPUT);      // 파란 LED 핀을 출력으로 설정
    pinMode(potPin, INPUT);           // 아날로그 입력 핀으로 설정

    pinMode(button1Pin, INPUT_PULLUP);  // 4번 핀에 버튼 1 연결 (내부 풀업 저항 사용)
    pinMode(button2Pin, INPUT_PULLUP);  // 5번 핀에 버튼 2 연결
    pinMode(button3Pin, INPUT_PULLUP);  // 6번 핀에 버튼 3 연결

    // 인터럽트 핸들러 등록: 버튼이 눌리면 각 모드 전환 함수 실행
    attachPCINT(digitalPinToPCINT(button1Pin), toggleRedOnlyMode, FALLING);  // 버튼 1: 빨간 LED만 켜기
    attachPCINT(digitalPinToPCINT(button2Pin), toggleBlinkMode, FALLING);  // 버튼 2: LED 3개 깜빡이기
    attachPCINT(digitalPinToPCINT(button3Pin), toggleAllLedOff, FALLING); // 버튼 3: 모든 LED 끄기

    previousMillis = millis();  // 시간 초기화
    trafficLightTask.enable();  // 신호등 작업 활성화
    adjustBrightnessTask.enable();  // 밝기 조정 작업 활성화
    serialTask.enable();  // 시리얼 전송 작업 활성화
}

void loop() {
    runner.execute();  // 스케줄러 실행 (등록된 모든 작업 처리)
}

// ✅ **가변저항 값을 읽어 LED 밝기 조절**
void adjustBrightnessTaskCallback() {
    int potValue = analogRead(potPin);  // 가변저항 값 읽기
    brightness = map(potValue, 0, 1023, 5, 255);  // 읽은 값을 5~255 범위로 매핑하여 밝기 설정
}

void trafficLightTaskCallback() {
    if (blinkMode || redOnlyMode || allLedOff) return;  // 해당 모드일 경우 신호등 제어 건너뛰기

    unsigned long elapsedTime = millis() - previousMillis;  // 경과 시간 계산
    bool blueBlinking = false;  // 파란불 깜빡임 상태

    // 🔴 빨간 불 켜기
    if (elapsedTime < redDuration) {
        analogWrite(redLedPin, brightness);
        analogWrite(yellowLedPin, 0);
        analogWrite(blueLedPin, 0);

        redState = true;
        yellowState = false;
        blueState = false;
    }
    // 🟡 노란 불 켜기
    else if (elapsedTime < redDuration + yellowDuration) {
        analogWrite(redLedPin, 0);
        analogWrite(yellowLedPin, brightness);
        analogWrite(blueLedPin, 0);

        redState = false;
        yellowState = true;
        blueState = false;
    }
    // 🔵 파란 불 켜기
    else if (elapsedTime < redDuration + yellowDuration + blueDuration - 1000) {
        analogWrite(blueLedPin, brightness);
        analogWrite(redLedPin, 0);
        analogWrite(yellowLedPin, 0);

        redState = false;
        yellowState = false;
        blueState = true;
    }
    // 🔵 파란 불 1초 동안 깜빡이기
    else if (elapsedTime < redDuration + yellowDuration + blueDuration) {
        blueBlinking = true;
        analogWrite(blueLedPin, (millis() / 167) % 2 ? brightness : 0);  // 167ms 간격으로 깜빡이기
    }
    // 🟡 노란 불 다시 켜기
    else if (elapsedTime < redDuration + yellowDuration + blueDuration + extraYellowDuration) {
        analogWrite(redLedPin, 0);
        analogWrite(yellowLedPin, brightness);
        analogWrite(blueLedPin, 0);

        redState = false;
        yellowState = true;
        blueState = false;
    } 
    else {
        previousMillis = millis();  // 사이클 재시작
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
    Serial.print(blueBlinking ? 1 : 0);  // 파란 LED 깜빡임 상태 전송
    Serial.print(",\"Brightness\":");
    Serial.print(brightness);  // 밝기 값 전송
    Serial.println("}");
}

// 🔹 **파란불 깜빡이기 Task**
void blueBlinkTaskCallback() {
    blinkState = !blinkState;  // 깜빡임 상태 전환
    analogWrite(blueLedPin, blinkState ? brightness : 0);  // 파란 LED 깜빡이기

    if (blueBlinkTask.isLastIteration()) {  // 마지막 반복일 때는 LED 끄기
        analogWrite(blueLedPin, brightness);
    }
}

void blinkTaskCallback() {
    static bool ledState = false;  // LED 깜빡임 상태

    if (blinkMode) {
        ledState = !ledState;  // LED 상태 전환

        analogWrite(redLedPin, ledState ? brightness : 0);
        analogWrite(yellowLedPin, ledState ? brightness : 0);
        analogWrite(blueLedPin, ledState ? brightness : 0);

        // "All Blink" 상태 JSON 데이터 전송
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
    String currentLight = "Off";  // 현재 점등된 신호등 상태

    int redValue = redState ? 1 : 0;
    int yellowValue = yellowState ? 1 : 0;
    int blueValue = blueState ? 1 : 0;

    // 현재 상태에 따른 신호등 상태 문자열 설정
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

    // JSON 형식으로 데이터 전송
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

    delay(20);  // 시리얼 전송 후 20ms 딜레이
}

// 🔹 버튼 인터럽트 핸들러에서 데이터 전송 추가
void toggleRedOnlyMode() {
    redOnlyMode = !redOnlyMode;  // 빨간 불만 켜기 모드 토글
    mode = redOnlyMode ? "Red Only" : "Normal";
    Serial.println(redOnlyMode ? "Red Only Mode ON" : "Red Only Mode OFF");
    sendSerialData();  // 데이터 즉시 전송
    if (redOnlyMode) {
        trafficLightTask.disable();  // 신호등 작업 비활성화
        blinkTask.disable();         // LED 깜빡이기 작업 비활성화
        analogWrite(redLedPin, brightness);  // 빨간 LED 켜기
        analogWrite(yellowLedPin, 0);        // 노란 LED 끄기
        analogWrite(blueLedPin, 0);          // 파란 LED 끄기
    } else {
        previousMillis = millis();  // 경과 시간 초기화
        trafficLightTask.enable();  // 신호등 작업 활성화
    }
}

void toggleBlinkMode() {
    blinkMode = !blinkMode;  // 모든 LED가 깜
